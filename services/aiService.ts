import { GoogleGenAI, Chat } from "@google/genai";
import type { QuestConfig, Player, BoardLocation, ManagedScenario, AiProviderSettings, LanguageCode, AiProviderId } from '../types';
import { auditLogService } from './auditLogService';
import { statsService } from './statsService';
import { settingsService, getProviderApiKeyFromEnv, PROVIDER_CONFIGS } from './settingsService';
import { 
    questConfigSchema, 
    dynamicScenarioSchema, 
    scenarioArraySchema,
    aiChoiceSchema
} from './schemas';
import { getLocalizedString } from "../utils/localization";
import { logger } from "./logger";

export class TokenLimitExceededError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TokenLimitExceededError';
    }
}

const LANGUAGE_MAP: Record<LanguageCode, string> = {
    en: "English",
    es: "Spanish",
    hi: "Hindi",
    ta: "Tamil"
};

const getApiKey = (providerId: AiProviderId): string => {
    // 1. User-provided session key takes highest priority
    const sessionApiKey = settingsService.getSessionApiKey();
    if (sessionApiKey) {
        return sessionApiKey;
    }

    // 2. Provider-specific environment key from settingsService
    const envApiKey = getProviderApiKeyFromEnv(providerId);
    if (envApiKey) {
        return envApiKey;
    }
    
    // 3. No key found
    const providerName = PROVIDER_CONFIGS[providerId]?.name || providerId;
    const keyName = `${providerId.toUpperCase()}_API_KEY`;
    throw new Error(`${providerName} API key is not configured. Please set the ${keyName} environment variable or enter one in the Settings menu.`);
};

const preflightCheck = () => {
    // Only check the limit if the user is NOT using their own override key or the community gateway
    const providerId = settingsService.getAiSettings().providerId;
    const isUsingOverrideKey = !!settingsService.getSessionApiKey();
    if (!isUsingOverrideKey && providerId !== 'community') {
        if (statsService.isTokenLimitExceeded()) {
            const { limit } = statsService.getTokenUsage();
            throw new TokenLimitExceededError(`You have used the shared API key's quota of ${limit.toLocaleString()} tokens. To continue, please go to Settings and provide your own personal API key.`);
        }
    }
};

/**
 * Helper function to process streaming text responses from the Community Gateway.
 * @param response The fetch Response object.
 * @returns A promise that resolves to the full text content of the stream.
 */
async function processCommunityGatewayStream(response: Response): Promise<string> {
    if (!response.ok) {
        throw new Error(`Community Gateway Error: ${await response.text()}`);
    }
    if (!response.body) {
        throw new Error('Community Gateway stream response has no body.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponseText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponseText += decoder.decode(value, { stream: true });
    }
    return fullResponseText;
}


// --- Helper to mask API keys for logging ---
const maskApiKey = (key: string): string => {
    if (!key || key.length < 8) return 'Invalid or Not Set';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

// --- Prompt Loading ---
const promptCache = new Map<string, string>();
export const loadPrompt = async (path: string, replacements: Record<string, string | number> = {}): Promise<string> => {
    let template = promptCache.get(path);
    if (!template) {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Failed to fetch prompt: ${path}`);
            template = await response.text();
            promptCache.set(path, template);
        } catch (error) {
            console.error(error);
            return `Generate content based on the user's request.`;
        }
    }
    return Object.entries(replacements).reduce((prompt, [key, value]) => {
        return prompt.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }, template);
};


// --- Retry Logic ---
const withRetry = async <T>(apiCall: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> => {
    let retries = 0;
    let delay = initialDelay;

    while (true) {
        try {
            return await apiCall();
        } catch (e: any) {
             if (e instanceof TokenLimitExceededError) {
                throw e; // Do not retry on token limit errors
            }
            const status = e?.response?.status || e?.status;
            const isRateLimitError = status === 429;
            const isServerError = status >= 500 && status <= 599;
            const isNetworkError = e.message?.includes('Failed to fetch');

            if ((isRateLimitError || isServerError || isNetworkError) && retries < maxRetries) {
                retries++;
                logger.warn(`API call failed with retryable error. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`, e.message);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; 
            } else {
                logger.error("API call failed after multiple retries or with a non-retryable error.", e);
                throw e;
            }
        }
    }
};

// --- OpenAI-compatible API Helper ---
const fetchOpenAICompatible = async (settings: AiProviderSettings, body: object): Promise<any> => {
    const apiKey = getApiKey(settings.providerId);
    if (!settings.baseUrl || !settings.model) {
        throw new Error("Base URL or Model Name is missing for OpenAI-compatible provider.");
    }

    logger.debug(`[AI] Making OpenAI-compatible request to ${settings.baseUrl}/chat/completions`);
    logger.finest('[AI] OpenAI-compatible request body:', body);

    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    const responseText = await response.text();
    logger.finest('[AI] OpenAI-compatible response text:', responseText);

    if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}.`;
        if (responseText) {
            try {
                const errorJson = JSON.parse(responseText);
                errorMessage += ` Message: ${errorJson.error?.message || responseText}`;
            } catch (e) {
                errorMessage += ` Response: ${responseText}`;
            }
        }
        logger.error(`[AI] OpenAI-compatible request failed with status ${response.status}`, responseText);
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        throw error;
    }

    if (!responseText) {
        throw new Error("The API returned a successful but empty response.");
    }

    try {
        return JSON.parse(responseText);
    } catch (e) {
        const snippet = responseText.length > 100 ? responseText.substring(0, 100) + '...' : responseText;
        throw new Error(`Failed to parse valid JSON from API response. Response text begins with: "${snippet}"`);
    }
};

// --- Service Functions ---

export const testConnection = async (settings: AiProviderSettings): Promise<void> => {
    logger.info(`[AI] Testing connection for provider: ${settings.providerId}`);
    
    if (settings.providerId === 'community') {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'testConnection' })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Community Gateway connection failed: ${errorText}`);
        }
        return;
    }

    const apiKey = getApiKey(settings.providerId);
    const isGemini = settings.providerId === 'gemini';
    const apiCall = async () => {
        if (isGemini) {
            if (!settings.model) throw new Error("Model Name is missing.");
            const ai = new GoogleGenAI({ apiKey });
            await ai.models.generateContent({
                model: settings.model,
                contents: 'test',
                config: { thinkingConfig: { thinkingBudget: 0 } }
            });
        } else {
            // OpenAI-compatible
            await fetchOpenAICompatible(settings, {
                model: settings.model,
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1
            });
        }
    };
    // Don't retry tests aggressively
    await withRetry(apiCall, 1, 0); 
};


export const enhanceQuestIdea = async (idea: string): Promise<string> => {
    logger.info('[AI] Starting enhanceQuestIdea call...');
    const settings = settingsService.getAiSettings();
    preflightCheck();
    
    const isCommunity = settings.providerId === 'community';
    const apiKey = isCommunity ? 'N/A' : getApiKey(settings.providerId);
    const maskedSettings = { ...settings, apiKey: isCommunity ? 'N/A' : maskApiKey(apiKey) };
    const isGemini = settings.providerId === 'gemini';

    const prompt = await loadPrompt('prompts/enhance-idea.txt', { idea });
    logger.debug('[AI] Enhance idea prompt:', prompt);

    const logDetails = {
        mode: 'Enhance Idea' as const,
        prompt: prompt,
        requestDetails: { action: 'enhance_idea', idea: idea, settings: maskedSettings },
        model: settings.model,
        inputTokens: undefined as number | undefined,
        outputTokens: undefined as number | undefined,
    };

    try {
        const apiCall = async (): Promise<string> => {
            if (isCommunity) {
                logger.info('[AI] Calling Community Gateway for enhance idea...');
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'enhanceQuestIdea', payload: { idea } })
                });
                const text = await processCommunityGatewayStream(response);
                // Token usage from community tier is not available due to streaming
                logDetails.inputTokens = undefined;
                logDetails.outputTokens = undefined;
                return text;
            } else if (!isGemini) {
                logger.info(`[AI] Calling OpenAI-compatible model for enhance idea: ${settings.model}`);
                const jsonResponse = await fetchOpenAICompatible(settings, {
                    model: settings.model,
                    messages: [{ role: 'user', content: prompt }],
                });
                
                if (jsonResponse.usage) {
                    logDetails.inputTokens = jsonResponse.usage.prompt_tokens || 0;
                    logDetails.outputTokens = jsonResponse.usage.completion_tokens || 0;
                    statsService.updateTokens({ inputTokens: logDetails.inputTokens, outputTokens: logDetails.outputTokens });
                }
                return jsonResponse.choices[0].message.content;
            } else {
                logger.info(`[AI] Calling Gemini model for enhance idea: ${settings.model}`);
                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: settings.model,
                    contents: prompt,
                });
                if (response.usageMetadata) {
                    const inputTokens = response.usageMetadata.promptTokenCount || 0;
                    const totalTokens = response.usageMetadata.totalTokenCount || 0;
                    const outputTokens = Math.max(0, totalTokens - inputTokens);
                    logDetails.inputTokens = inputTokens;
                    logDetails.outputTokens = outputTokens;
                    statsService.updateTokens({ inputTokens, outputTokens });
                }
                return response.text;
            }
        };

        const text = await withRetry(apiCall);
        if (!text) throw new Error("The API returned an empty response.");
        
        logger.info('[AI] enhanceQuestIdea call successful.');
        logger.finest('[AI] Enhanced idea response:', text);
        auditLogService.addLog({ ...logDetails, response: text, error: null });
        return text.trim();

    } catch (e: any) {
        auditLogService.addLog({ ...logDetails, response: '', error: e.message });
        throw e;
    }
};

export const generateRandomQuestIdea = async (): Promise<string> => {
    logger.info('[AI] Starting generateRandomQuestIdea call...');
    const settings = settingsService.getAiSettings();
    preflightCheck();
    
    const isCommunity = settings.providerId === 'community';
    const apiKey = isCommunity ? 'N/A' : getApiKey(settings.providerId);
    const maskedSettings = { ...settings, apiKey: isCommunity ? 'N/A' : maskApiKey(apiKey) };
    const isGemini = settings.providerId === 'gemini';

    const prompt = await loadPrompt('prompts/random-idea.txt');
    logger.debug('[AI] Random idea prompt:', prompt);

    const logDetails = {
        mode: 'Enhance Idea' as const, // Re-using this mode is fine for logging
        prompt: prompt,
        requestDetails: { action: 'generate_random_idea', settings: maskedSettings },
        model: settings.model,
        inputTokens: undefined as number | undefined,
        outputTokens: undefined as number | undefined,
    };

    try {
        const apiCall = async (): Promise<string> => {
            if (isCommunity) {
                logger.info('[AI] Calling Community Gateway for random idea...');
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'generateRandomQuestIdea', payload: {} })
                });
                const text = await processCommunityGatewayStream(response);
                return text;
            } else if (!isGemini) {
                logger.info(`[AI] Calling OpenAI-compatible model for random idea: ${settings.model}`);
                const jsonResponse = await fetchOpenAICompatible(settings, {
                    model: settings.model,
                    messages: [{ role: 'user', content: prompt }],
                });
                
                if (jsonResponse.usage) {
                    logDetails.inputTokens = jsonResponse.usage.prompt_tokens || 0;
                    logDetails.outputTokens = jsonResponse.usage.completion_tokens || 0;
                    statsService.updateTokens({ inputTokens: logDetails.inputTokens, outputTokens: logDetails.outputTokens });
                }
                return jsonResponse.choices[0].message.content;
            } else {
                logger.info(`[AI] Calling Gemini model for random idea: ${settings.model}`);
                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: settings.model,
                    contents: prompt,
                });
                if (response.usageMetadata) {
                    const inputTokens = response.usageMetadata.promptTokenCount || 0;
                    const totalTokens = response.usageMetadata.totalTokenCount || 0;
                    const outputTokens = Math.max(0, totalTokens - inputTokens);
                    logDetails.inputTokens = inputTokens;
                    logDetails.outputTokens = outputTokens;
                    statsService.updateTokens({ inputTokens, outputTokens });
                }
                return response.text;
            }
        };

        const text = await withRetry(apiCall);
        if (!text) throw new Error("The API returned an empty response.");
        
        logger.info('[AI] generateRandomQuestIdea call successful.');
        logger.finest('[AI] Random idea response:', text);
        auditLogService.addLog({ ...logDetails, response: text, error: null });
        return text.trim();

    } catch (e: any) {
        auditLogService.addLog({ ...logDetails, response: '', error: e.message });
        throw e;
    }
};

export const generateQuestOutline = async (
    idea: string,
    numLocations: number,
    positivity: number,
    groundingInReality: boolean,
    supportedLanguages: LanguageCode[]
): Promise<QuestConfig> => {
    logger.info('[AI] Starting generateQuestOutline call...');
    const settings = settingsService.getAiSettings();
    preflightCheck();

    const isCommunity = settings.providerId === 'community';
    const apiKey = isCommunity ? 'N/A' : getApiKey(settings.providerId);
    const maskedSettings = { ...settings, apiKey: isCommunity ? 'N/A' : maskApiKey(apiKey) };
    const isGemini = settings.providerId === 'gemini';

    const languageCode = settingsService.getLanguage();
    const languageName = LANGUAGE_MAP[languageCode];
    const languageList = (supportedLanguages.length > 0 ? supportedLanguages : ['en'])
        .map(code => `${LANGUAGE_MAP[code]} ('${code}')`).join(', ');

    const promptReplacements = { numLocations, positivity, groundingInReality: String(groundingInReality), languageCode, languageName, languageList };
    const userPrompt = `Generate a quest based on this idea: "${idea}"`;

    const logDetails = {
        mode: 'Quest Maker' as const,
        prompt: userPrompt,
        systemInstruction: '',
        requestDetails: { action: 'generate_outline', idea, numLocations, positivity, groundingInReality, supportedLanguages, settings: maskedSettings },
        model: settings.model,
        inputTokens: undefined as number | undefined,
        outputTokens: undefined as number | undefined,
    };

    try {
        const apiCall = async (): Promise<string> => {
            if (isCommunity) {
                logger.info('[AI] Calling Community Gateway for quest outline...');
                 const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'generateQuestOutline', 
                        payload: { idea, numLocations, positivity, groundingInReality, supportedLanguages, languageCode } 
                    })
                });
                const jsonText = await processCommunityGatewayStream(response);
                logDetails.inputTokens = undefined;
                logDetails.outputTokens = undefined;
                return jsonText;
            } else if (!isGemini) {
                const schemaString = JSON.stringify(questConfigSchema, null, 2).replace(/"/g, '\"');
                const systemInstruction = await loadPrompt('prompts/quest-outline-system-openai.txt', { ...promptReplacements, schema: schemaString });
                logDetails.systemInstruction = systemInstruction;
                logger.info(`[AI] Calling OpenAI-compatible model for quest outline: ${settings.model}`);

                const jsonResponse = await fetchOpenAICompatible(settings, {
                    model: settings.model,
                    messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: userPrompt }],
                    response_format: { type: "json_object" }
                });

                if (jsonResponse.usage) {
                    logDetails.inputTokens = jsonResponse.usage.prompt_tokens || 0;
                    logDetails.outputTokens = jsonResponse.usage.completion_tokens || 0;
                    statsService.updateTokens({ inputTokens: logDetails.inputTokens, outputTokens: logDetails.outputTokens });
                }
                return jsonResponse.choices[0].message.content;
            } else {
                const systemInstruction = await loadPrompt('prompts/quest-outline-system.txt', promptReplacements);
                logDetails.systemInstruction = systemInstruction;
                logger.info(`[AI] Calling Gemini model for quest outline: ${settings.model}`);

                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: settings.model,
                    contents: userPrompt,
                    config: {
                        systemInstruction,
                        responseMimeType: "application/json",
                        responseSchema: questConfigSchema,
                    }
                });
                if (response.usageMetadata) {
                    const inputTokens = response.usageMetadata.promptTokenCount || 0;
                    const totalTokens = response.usageMetadata.totalTokenCount || 0;
                    const outputTokens = Math.max(0, totalTokens - inputTokens);
                    logDetails.inputTokens = inputTokens;
                    logDetails.outputTokens = outputTokens;
                    statsService.updateTokens({ inputTokens, outputTokens });
                }
                return response.text;
            }
        };

        const text = await withRetry(apiCall);
        if (!text) throw new Error("The API returned an empty response.");
        
        logger.info('[AI] generateQuestOutline call successful.');
        logger.finest('[AI] Quest outline response:', text);
        auditLogService.addLog({ ...logDetails, response: text, error: null });
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        const jsonText = jsonMatch ? jsonMatch[1] : text;
        const json = JSON.parse(jsonText);

        json.positivity = positivity;
        json.groundingInReality = groundingInReality;
        json.supportedLanguages = supportedLanguages;
        if (json.board && Array.isArray(json.board.locations)) {
            const jailIndex = json.board.locations.findIndex((loc: any) => loc.type === 'JAIL');
            json.board.jailPosition = jailIndex !== -1 ? jailIndex : Math.floor(json.board.locations.length / 2);
        }
        return json as QuestConfig;

    } catch (e: any) {
        auditLogService.addLog({ ...logDetails, response: '', error: e.message });
        throw e;
    }
};

export const generatePregeneratedScenarios = async (
    questConfig: Omit<QuestConfig, 'pregeneratedScenarios'>,
    location: BoardLocation,
    numScenarios: number,
): Promise<ManagedScenario[]> => {
    if (numScenarios <= 0) return [];
    
    logger.info(`[AI] Starting generatePregeneratedScenarios for location "${getLocalizedString(location.name, 'en')}"...`);
    const settings = settingsService.getAiSettings();
    preflightCheck();

    const isCommunity = settings.providerId === 'community';
    const apiKey = isCommunity ? 'N/A' : getApiKey(settings.providerId);
    const maskedSettings = { ...settings, apiKey: isCommunity ? 'N/A' : maskApiKey(apiKey) };
    const isGemini = settings.providerId === 'gemini';

    const languageCode = settingsService.getLanguage();
    const isGrounded = !!questConfig.groundingInReality;
    const resourceNames = questConfig.resources.map(r => getLocalizedString(r.name, 'en').toLowerCase()).join(', ');
    const supportedLanguages = questConfig.supportedLanguages || ['en', 'es', 'hi', 'ta'];
    
    const logDetails = {
        mode: 'Pregenerated Scenarios' as const, 
        prompt: '',
        requestDetails: { questName: getLocalizedString(questConfig.name, 'en'), location: getLocalizedString(location.name, 'en'), numScenarios, grounded: isGrounded, language: languageCode, settings: maskedSettings },
        model: settings.model,
        inputTokens: undefined as number | undefined,
        outputTokens: undefined as number | undefined,
    };

    try {
        const apiCall = async (): Promise<string> => {
            if (isCommunity) {
                 logger.info('[AI] Calling Community Gateway for pre-gen scenarios...');
                 const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'generatePregeneratedScenarios', 
                        payload: { questConfig, location, numScenarios, languageCode } 
                    })
                });
                const jsonText = await processCommunityGatewayStream(response);
                logDetails.inputTokens = undefined;
                logDetails.outputTokens = undefined;
                return jsonText;
            }
            
            // This part remains unchanged as it handles non-community providers
            const languageName = LANGUAGE_MAP[languageCode];
            const languageList = supportedLanguages.map(code => `${LANGUAGE_MAP[code]} ('${code}')`).join(', ');
            const promptReplacements = {
                questDescription: getLocalizedString(questConfig.description, 'en'),
                locationName: getLocalizedString(location.name, 'en'),
                locationDescription: getLocalizedString(location.description, 'en'),
                resourceNames,
                numScenarios,
                languageCode,
                languageName,
                languageList,
            };

            if (isGrounded) {
                 if (isGemini) {
                    const ai = new GoogleGenAI({ apiKey });
                    const prompt = await loadPrompt('prompts/pregenerated-scenarios-grounded.txt', promptReplacements);
                    logDetails.prompt = prompt;
                    logger.info(`[AI] Calling Gemini (grounded) for pre-gen scenarios: ${settings.model}`);
                    const response = await ai.models.generateContent({ model: settings.model, contents: prompt, config: { tools: [{ googleSearch: {} }] } });
                    if (response.usageMetadata) {
                        const inputTokens = response.usageMetadata.promptTokenCount || 0;
                        const totalTokens = response.usageMetadata.totalTokenCount || 0;
                        const outputTokens = Math.max(0, totalTokens - inputTokens);
                        logDetails.inputTokens = inputTokens;
                        logDetails.outputTokens = outputTokens;
                        statsService.updateTokens({ inputTokens, outputTokens });
                    }
                    return response.text;
                 } else {
                    const schemaString = JSON.stringify(scenarioArraySchema, null, 2).replace(/"/g, '\"');
                    const systemInstruction = await loadPrompt('prompts/pregenerated-scenarios-grounded-openai.txt', { ...promptReplacements, schema: schemaString });
                    logDetails.prompt = systemInstruction;
                    logger.info(`[AI] Calling OpenAI-compatible (grounded) for pre-gen scenarios: ${settings.model}`);
                    const jsonResponse = await fetchOpenAICompatible(settings, {
                        model: settings.model,
                        messages: [{ role: 'system', content: systemInstruction }],
                        response_format: { type: "json_object" }
                    });
                     if (jsonResponse.usage) {
                        logDetails.inputTokens = jsonResponse.usage.prompt_tokens || 0;
                        logDetails.outputTokens = jsonResponse.usage.completion_tokens || 0;
                        statsService.updateTokens({ inputTokens: logDetails.inputTokens, outputTokens: logDetails.outputTokens });
                    }
                    return jsonResponse.choices[0].message.content;
                }

            } else { // Fictional flow
                if (!isGemini) {
                    const schemaString = JSON.stringify(scenarioArraySchema, null, 2).replace(/"/g, '\"');
                    const systemInstruction = await loadPrompt('prompts/pregenerated-scenarios-fictional-openai.txt', { ...promptReplacements, schema: schemaString });
                    logDetails.prompt = systemInstruction;
                    logger.info(`[AI] Calling OpenAI-compatible (fictional) for pre-gen scenarios: ${settings.model}`);
                    const jsonResponse = await fetchOpenAICompatible(settings, {
                        model: settings.model,
                        messages: [{ role: 'system', content: systemInstruction }],
                        response_format: { type: "json_object" }
                    });
                     if (jsonResponse.usage) {
                        logDetails.inputTokens = jsonResponse.usage.prompt_tokens || 0;
                        logDetails.outputTokens = jsonResponse.usage.completion_tokens || 0;
                        statsService.updateTokens({ inputTokens: logDetails.inputTokens, outputTokens: logDetails.outputTokens });
                    }
                    return jsonResponse.choices[0].message.content;
                } else {
                    const prompt = await loadPrompt('prompts/pregenerated-scenarios-fictional.txt', promptReplacements);
                    logDetails.prompt = prompt;
                    const ai = new GoogleGenAI({ apiKey });
                    logger.info(`[AI] Calling Gemini (fictional) for pre-gen scenarios: ${settings.model}`);
                    const response = await ai.models.generateContent({
                        model: settings.model, contents: prompt,
                        config: { responseMimeType: "application/json", responseSchema: scenarioArraySchema }
                    });
                    if (response.usageMetadata) {
                        const inputTokens = response.usageMetadata.promptTokenCount || 0;
                        const totalTokens = response.usageMetadata.totalTokenCount || 0;
                        const outputTokens = Math.max(0, totalTokens - inputTokens);
                        logDetails.inputTokens = inputTokens;
                        logDetails.outputTokens = outputTokens;
                        statsService.updateTokens({ inputTokens, outputTokens });
                    }
                    return response.text;
                }
            }
        };
        
        const text = await withRetry(apiCall);
        if (!text) throw new Error("The API returned an empty response.");
        logger.info('[AI] generatePregeneratedScenarios call successful.');
        logger.finest('[AI] Pre-gen scenarios response:', text);
        auditLogService.addLog({ ...logDetails, response: text, error: null });

        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        const jsonText = jsonMatch ? jsonMatch[1] : text;

        const parsed = JSON.parse(jsonText);
        const scenarios: Omit<ManagedScenario, 'id'|'custom'|'enabled'>[] = parsed.scenarios || [];
        
        return scenarios.map((s, i) => ({
            ...s, id: `${getLocalizedString(location.name, 'en').toLowerCase().replace(/\s+/g, '-')}-${i}`, custom: false, enabled: true,
        }));
    } catch (e: any) {
        auditLogService.addLog({ ...logDetails, response: '', error: e.message });
        throw e;
    }
};

export const generateDynamicScenario = async (questConfig: QuestConfig, player: Player, location: BoardLocation): Promise<ManagedScenario> => {
    logger.info(`[AI] Starting generateDynamicScenario for location "${getLocalizedString(location.name, 'en')}"...`);
    const settings = settingsService.getAiSettings();
    preflightCheck();
    
    const isCommunity = settings.providerId === 'community';
    const apiKey = isCommunity ? 'N/A' : getApiKey(settings.providerId);
    const maskedSettings = { ...settings, apiKey: isCommunity ? 'N/A' : maskApiKey(apiKey) };
    const isGemini = settings.providerId === 'gemini';
    const isGrounded = !!questConfig.groundingInReality;
    const languageCode = settingsService.getLanguage();
    
    const logDetails = {
        mode: (isGrounded ? 'Dynamic Scenario (Grounded)' : 'Dynamic Scenario (Fictional)') as any,
        prompt: '',
        requestDetails: { questName: getLocalizedString(questConfig.name, 'en'), location: getLocalizedString(location.name, 'en'), grounded: isGrounded, language: languageCode, settings: maskedSettings },
        model: settings.model,
        inputTokens: undefined as number | undefined,
        outputTokens: undefined as number | undefined,
    };

    try {
        let scenarioData: any;
        let source: any = null;

        const apiCall = async (): Promise<string> => {
             if (isCommunity) {
                logger.info('[AI] Calling Community Gateway for dynamic scenario...');
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'generateDynamicScenario', 
                        payload: { questConfig, player, location, languageCode } 
                    })
                });
                const jsonText = await processCommunityGatewayStream(response);
                logDetails.inputTokens = undefined;
                logDetails.outputTokens = undefined;
                return jsonText;
            }
            
            // This part remains unchanged for non-community providers
            const languageName = LANGUAGE_MAP[languageCode];
            const resourceNames = questConfig.resources.map(r => getLocalizedString(r.name, 'en').toLowerCase()).join(', ');
            const supportedLanguages = questConfig.supportedLanguages || ['en', 'es', 'hi', 'ta'];
            const languageList = supportedLanguages.map(code => `${LANGUAGE_MAP[code]} ('${code}')`).join(', ');
            const promptReplacements = {
                questDescription: getLocalizedString(questConfig.description, 'en'),
                locationName: getLocalizedString(location.name, 'en'),
                locationDescription: getLocalizedString(location.description, 'en'),
                resourceNames,
                languageCode,
                languageName,
                languageList,
            };

            if (isGrounded) {
                if (isGemini) {
                    const ai = new GoogleGenAI({ apiKey });
                    const prompt = await loadPrompt('prompts/dynamic-scenario-grounded.txt', promptReplacements);
                    logDetails.prompt = prompt;
                    logger.info(`[AI] Calling Gemini (grounded) for dynamic scenario: ${settings.model}`);
                    const response = await ai.models.generateContent({ model: settings.model, contents: prompt, config: { tools: [{ googleSearch: {} }] } });
                     if (response.usageMetadata) {
                        const inputTokens = response.usageMetadata.promptTokenCount || 0;
                        const totalTokens = response.usageMetadata.totalTokenCount || 0;
                        const outputTokens = Math.max(0, totalTokens - inputTokens);
                        logDetails.inputTokens = inputTokens;
                        logDetails.outputTokens = outputTokens;
                        statsService.updateTokens({ inputTokens, outputTokens });
                    }
                    source = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.[0]?.web;
                    return response.text;
                } else { // Grounded, OpenAI-compatible
                    const schemaString = JSON.stringify(dynamicScenarioSchema, null, 2).replace(/"/g, '\"');
                    const systemInstruction = await loadPrompt('prompts/dynamic-scenario-grounded-openai.txt', { ...promptReplacements, schema: schemaString });
                    logDetails.prompt = systemInstruction;
                    logger.info(`[AI] Calling OpenAI-compatible (grounded) for dynamic scenario: ${settings.model}`);
                     const jsonResponse = await fetchOpenAICompatible(settings, { model: settings.model, messages: [{ role: 'system', content: systemInstruction }], response_format: { type: "json_object" } });
                     if (jsonResponse.usage) {
                        logDetails.inputTokens = jsonResponse.usage.prompt_tokens || 0;
                        logDetails.outputTokens = jsonResponse.usage.completion_tokens || 0;
                        statsService.updateTokens({ inputTokens: logDetails.inputTokens, outputTokens: logDetails.outputTokens });
                    }
                    return jsonResponse.choices[0].message.content;
                }
            } else { // Fictional flow
                if (!isGemini) {
                    const schemaString = JSON.stringify(dynamicScenarioSchema, null, 2).replace(/"/g, '\"');
                    const systemInstruction = await loadPrompt('prompts/dynamic-scenario-fictional-openai.txt', { ...promptReplacements, schema: schemaString });
                    logDetails.prompt = systemInstruction;
                    logger.info(`[AI] Calling OpenAI-compatible (fictional) for dynamic scenario: ${settings.model}`);
                    const jsonResponse = await fetchOpenAICompatible(settings, { model: settings.model, messages: [{ role: 'system', content: systemInstruction }], response_format: { type: "json_object" } });
                     if (jsonResponse.usage) {
                        logDetails.inputTokens = jsonResponse.usage.prompt_tokens || 0;
                        logDetails.outputTokens = jsonResponse.usage.completion_tokens || 0;
                        statsService.updateTokens({ inputTokens: logDetails.inputTokens, outputTokens: logDetails.outputTokens });
                    }
                    return jsonResponse.choices[0].message.content;
                } else {
                    const prompt = await loadPrompt('prompts/dynamic-scenario-fictional.txt', promptReplacements);
                    logDetails.prompt = prompt;
                    const ai = new GoogleGenAI({ apiKey });
                    logger.info(`[AI] Calling Gemini (fictional) for dynamic scenario: ${settings.model}`);
                    const response = await ai.models.generateContent({
                        model: settings.model, contents: prompt,
                        config: { responseMimeType: "application/json", responseSchema: dynamicScenarioSchema }
                    });
                    if (response.usageMetadata) {
                        const inputTokens = response.usageMetadata.promptTokenCount || 0;
                        const totalTokens = response.usageMetadata.totalTokenCount || 0;
                        const outputTokens = Math.max(0, totalTokens - inputTokens);
                        logDetails.inputTokens = inputTokens;
                        logDetails.outputTokens = outputTokens;
                        statsService.updateTokens({ inputTokens, outputTokens });
                    }
                    return response.text;
                }
            }
        };

        const text = await withRetry(apiCall);
        if (!text) throw new Error("API returned empty response.");
        
        logger.info('[AI] generateDynamicScenario call successful.');
        logger.finest('[AI] Dynamic scenario response:', text);
        auditLogService.addLog({ ...logDetails, response: text, error: null });
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        const jsonText = jsonMatch ? jsonMatch[1] : text;
        scenarioData = JSON.parse(jsonText);
        
        if (isGrounded && !isGemini && scenarioData.sourceUrl) {
            source = { uri: scenarioData.sourceUrl, title: scenarioData.sourceTitle };
        }

        return {
            ...scenarioData, id: `dynamic-${Date.now()}`,
            sourceUrl: source?.uri, sourceTitle: source?.title,
            custom: true, enabled: true,
        };
    } catch(e: any) {
        auditLogService.addLog({ ...logDetails, response: '', error: e.message });
        throw e;
    }
};

export const getAIChoice = async (questConfig: QuestConfig, scenario: ManagedScenario, aiPlayer: Player): Promise<number> => {
    logger.info(`[AI] Starting getAIChoice for player "${aiPlayer.name}"...`);
    const settings = settingsService.getAiSettings();
    preflightCheck();
    const apiKey = getApiKey(settings.providerId);
    
    if (settings.providerId !== 'gemini') {
        // Fallback for non-gemini providers to keep it simple
        logger.warn("AI Player choice is only supported for Gemini provider. Falling back to random choice.");
        return Math.floor(Math.random() * 2);
    }

    const maskedSettings = { ...settings, apiKey: maskApiKey(apiKey) };
    
    const promptReplacements = {
        questDescription: getLocalizedString(questConfig.description, 'en'),
        aiPlayerResources: JSON.stringify(aiPlayer.resources),
        scenarioTitle: getLocalizedString(scenario.title, 'en'),
        scenarioDescription: getLocalizedString(scenario.description, 'en'),
        choice0_text: getLocalizedString(scenario.choices[0].text, 'en'),
        choice0_outcome_explanation: getLocalizedString(scenario.choices[0].outcome.explanation, 'en'),
        choice0_resource_changes: JSON.stringify(scenario.choices[0].outcome.resourceChanges),
        choice1_text: getLocalizedString(scenario.choices[1].text, 'en'),
        choice1_outcome_explanation: getLocalizedString(scenario.choices[1].outcome.explanation, 'en'),
        choice1_resource_changes: JSON.stringify(scenario.choices[1].outcome.resourceChanges),
    };

    const prompt = await loadPrompt('prompts/ai-player-choice.txt', promptReplacements);
    
    const logDetails = {
        mode: 'AI Player Choice' as const,
        prompt: prompt,
        requestDetails: { 
            questName: getLocalizedString(questConfig.name, 'en'), 
            scenarioTitle: getLocalizedString(scenario.title, 'en'),
            aiPlayer: {id: aiPlayer.id, name: aiPlayer.name, resources: aiPlayer.resources},
            settings: maskedSettings 
        },
        model: settings.model,
        inputTokens: undefined as number | undefined,
        outputTokens: undefined as number | undefined,
    };

    try {
        const apiCall = async (): Promise<string> => {
            const ai = new GoogleGenAI({ apiKey });
            logger.info(`[AI] Calling Gemini for AI player choice: ${settings.model}`);
            const response = await ai.models.generateContent({
                model: settings.model,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: aiChoiceSchema,
                }
            });
            if (response.usageMetadata) {
                const inputTokens = response.usageMetadata.promptTokenCount || 0;
                const totalTokens = response.usageMetadata.totalTokenCount || 0;
                const outputTokens = Math.max(0, totalTokens - inputTokens);
                logDetails.inputTokens = inputTokens;
                logDetails.outputTokens = outputTokens;
                statsService.updateTokens({ inputTokens, outputTokens });
            }
            return response.text;
        };

        const text = await withRetry(apiCall);
        if (!text) throw new Error("API returned empty response for AI choice.");
        
        logger.info('[AI] getAIChoice call successful.');
        logger.finest('[AI] AI choice response:', text);
        auditLogService.addLog({ ...logDetails, response: text, error: null });
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        const jsonText = jsonMatch ? jsonMatch[1] : text;
        const json = JSON.parse(jsonText);
        const choiceIndex = json.choiceIndex;

        if (choiceIndex === 0 || choiceIndex === 1) {
            logger.debug(`[AI] Player "${aiPlayer.name}" chose option ${choiceIndex}. Reasoning: ${json.reasoning}`);
            return choiceIndex;
        }
        
        logger.warn("AI returned invalid choice index, picking randomly.", json);
        return Math.floor(Math.random() * 2);

    } catch(e: any) {
        auditLogService.addLog({ ...logDetails, response: '', error: e.message });
        throw e;
    }
};


let chatInstance: Chat | null = null;
let currentSystemInstruction: string | undefined = undefined;

export const chatManager = {
    initialize: (systemInstruction: string) => {
        const settings = settingsService.getAiSettings();
        if (settings.providerId === 'community') {
            // Community provider uses stateless API endpoint, no instance to initialize
            chatInstance = null;
            currentSystemInstruction = systemInstruction;
            return;
        }
        if (settings.providerId !== 'gemini') {
            logger.warn('[AI Chat] Chat is only supported for Gemini provider.');
            chatInstance = null;
            currentSystemInstruction = undefined;
            return;
        }

        if (chatInstance && systemInstruction === currentSystemInstruction) {
            return;
        }

        try {
            logger.info('[AI Chat] Initializing new chat instance.');
            logger.finest('[AI Chat] System Instruction:', systemInstruction);
            const apiKey = getApiKey(settings.providerId);
            
            const ai = new GoogleGenAI({ apiKey });
            chatInstance = ai.chats.create({
                model: settings.model || 'gemini-2.5-flash',
                config: { systemInstruction },
            });
            currentSystemInstruction = systemInstruction;
        } catch (e) {
            logger.error("Failed to initialize chat:", e);
            chatInstance = null;
        }
    },

    sendMessageStream: async function* (message: string, history: {role: 'user' | 'model', content: string}[]): AsyncGenerator<string, void, unknown> {
        const settings = settingsService.getAiSettings();
        if (settings.providerId !== 'gemini' && settings.providerId !== 'community') {
            yield "Chat is only available with the Google Gemini or Community Gateway provider. Please change your provider in the Settings menu.";
            return;
        }
        
        logger.info('[AI Chat] Sending chat message.');
        const logDetails = {
            mode: 'Chat' as const,
            prompt: message,
            systemInstruction: currentSystemInstruction,
            requestDetails: { action: 'chat_message' },
            model: settings.model,
        };

        try {
            preflightCheck();
            let responseStream;
            if (settings.providerId === 'community') {
                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'chat',
                        payload: { message, history, systemInstruction: currentSystemInstruction }
                    })
                });
                if (!response.ok || !response.body) {
                    throw new Error(`Community Gateway Error: ${await response.text()}`);
                }
                responseStream = response.body;
            } else {
                 if (!chatInstance) throw new Error("Chat not initialized.");
                 const result = await chatInstance.sendMessageStream({ message });
                 responseStream = result;
            }
            
            let fullResponse = "";
            const reader = responseStream.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunkText = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
                fullResponse += chunkText;
                yield chunkText;
            }

            logger.info('[AI Chat] Stream finished.');
            logger.finest('[AI Chat] Full response:', fullResponse);
            auditLogService.addLog({ ...logDetails, response: fullResponse, error: null });
        } catch (e: any) {
            logger.error('[AI Chat] Error during sendMessageStream', e);
            auditLogService.addLog({ ...logDetails, response: '', error: e.message });
            if (e instanceof TokenLimitExceededError) {
                yield e.message;
            } else {
                yield `An error occurred: ${e.message}`;
            }
        }
    },
};