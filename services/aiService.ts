

import { GoogleGenAI } from "@google/genai";
import type { QuestConfig, Player, BoardLocation, ManagedScenario, AiProviderSettings } from '../types';
import { auditLogService } from './auditLogService';
import { statsService } from './statsService';
import { settingsService } from './settingsService';
import { 
    questConfigSchema, 
    dynamicScenarioSchema, 
    scenarioArraySchema,
    aiChoiceSchema
} from './schemas';
import { getLocalizedString } from "../utils/localization";

const LANGUAGE_MAP = {
    en: "English",
    es: "Spanish",
    hi: "Hindi",
    ta: "Tamil"
};

const API_KEY_ERROR = "API key is not configured. As per project guidelines, this app requires the 'API_KEY' to be set as an environment variable.";

// --- Helper to mask API keys for logging ---
const maskApiKey = (key: string): string => {
    if (!key || key.length < 8) return 'Invalid or Not Set';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

// --- Prompt Loading ---
const promptCache = new Map<string, string>();
const loadPrompt = async (path: string, replacements: Record<string, string | number> = {}): Promise<string> => {
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
            const status = e?.response?.status || e?.status;
            const isRateLimitError = status === 429;
            const isServerError = status >= 500 && status <= 599;
            const isNetworkError = e.message?.includes('Failed to fetch');

            if ((isRateLimitError || isServerError || isNetworkError) && retries < maxRetries) {
                retries++;
                console.warn(`API call failed. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`, e.message);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; 
            } else {
                console.error("API call failed after multiple retries or with a non-retryable error.", e);
                throw e;
            }
        }
    }
};

// --- Service Functions ---

export const testConnection = async (settings: AiProviderSettings): Promise<void> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error(API_KEY_ERROR);
    }
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
            if (!settings.baseUrl || !settings.model) {
                throw new Error("Base URL or Model Name is missing.");
            }
            const response = await fetch(`${settings.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: settings.model,
                    messages: [{ role: 'user', content: 'test' }],
                    max_tokens: 1
                })
            });
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `API request failed with status ${response.status}.`;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage += ` Message: ${errorJson.error?.message || errorText}`;
                } catch (e) {
                     errorMessage += ` Response: ${errorText}`;
                }
                const error = new Error(errorMessage);
                (error as any).status = response.status;
                throw error;
            }
            await response.json();
        }
    };
    // Don't retry tests aggressively
    await withRetry(apiCall, 1, 0); 
};


export const enhanceQuestIdea = async (idea: string): Promise<string> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error(API_KEY_ERROR);
    
    const settings = settingsService.getAiSettings();
    const maskedSettings = { ...settings, apiKey: maskApiKey(apiKey) };
    const isGemini = settings.providerId === 'gemini';

    const prompt = await loadPrompt('prompts/enhance-idea.txt', { idea });

    const logDetails = {
        mode: 'Enhance Idea' as const,
        prompt: prompt,
        requestDetails: { action: 'enhance_idea', idea: idea, settings: maskedSettings },
    };

    try {
        const apiCall = async (): Promise<string> => {
            if (!isGemini) {
                const response = await fetch(`${settings.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: settings.model,
                        messages: [{ role: 'user', content: prompt }],
                    })
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    const error = new Error(`API request failed: ${response.status} ${errorText}`);
                    (error as any).status = response.status;
                    throw error;
                }
                const jsonResponse = await response.json();
                return jsonResponse.choices[0].message.content;
            } else {
                const ai = new GoogleGenAI({ apiKey });
                const response = await ai.models.generateContent({
                    model: settings.model,
                    contents: prompt,
                });
                statsService.updateTokens(response.usageMetadata);
                return response.text;
            }
        };

        const text = await withRetry(apiCall);
        if (!text) throw new Error("The API returned an empty response.");
        
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
    groundingInReality: boolean
): Promise<QuestConfig> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error(API_KEY_ERROR);

    const settings = settingsService.getAiSettings();
    const languageCode = settingsService.getLanguage();
    const languageName = LANGUAGE_MAP[languageCode];
    const maskedSettings = { ...settings, apiKey: maskApiKey(apiKey) };
    const isGemini = settings.providerId === 'gemini';
    
    const promptReplacements = { numLocations, positivity, groundingInReality: String(groundingInReality), languageCode, languageName };
    const userPrompt = `Generate a quest based on this idea: "${idea}"`;

    const logDetails = {
        mode: 'Quest Maker' as const,
        prompt: userPrompt,
        systemInstruction: '',
        requestDetails: { action: 'generate_outline', idea, numLocations, positivity, groundingInReality, language: languageCode, settings: maskedSettings },
    };

    try {
        const apiCall = async (): Promise<string> => {
            if (!isGemini) {
                const schemaString = JSON.stringify(questConfigSchema, null, 2).replace(/"/g, '\"');
                const systemInstruction = await loadPrompt('prompts/quest-outline-system-openai.txt', { ...promptReplacements, schema: schemaString });
                logDetails.systemInstruction = systemInstruction;

                const response = await fetch(`${settings.baseUrl}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({
                        model: settings.model,
                        messages: [{ role: 'system', content: systemInstruction }, { role: 'user', content: userPrompt }],
                        response_format: { type: "json_object" }
                    })
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    const error = new Error(`API request failed: ${response.status} ${errorText}`);
                    (error as any).status = response.status;
                    throw error;
                }
                const jsonResponse = await response.json();
                return jsonResponse.choices[0].message.content;

            } else {
                const systemInstruction = await loadPrompt('prompts/quest-outline-system.txt', promptReplacements);
                logDetails.systemInstruction = systemInstruction;

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
                statsService.updateTokens(response.usageMetadata);
                return response.text;
            }
        };

        const text = await withRetry(apiCall);
        if (!text) throw new Error("The API returned an empty response.");
        
        auditLogService.addLog({ ...logDetails, response: text, error: null });
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        const jsonText = jsonMatch ? jsonMatch[1] : text;
        const json = JSON.parse(jsonText);

        json.positivity = positivity;
        json.groundingInReality = groundingInReality;
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
    
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error(API_KEY_ERROR);

    const settings = settingsService.getAiSettings();
    const languageCode = settingsService.getLanguage();
    const languageName = LANGUAGE_MAP[languageCode];
    const maskedSettings = { ...settings, apiKey: maskApiKey(apiKey) };
    const isGemini = settings.providerId === 'gemini';
    const isGrounded = !!questConfig.groundingInReality;
    const resourceNames = questConfig.resources.map(r => getLocalizedString(r.name, 'en').toLowerCase()).join(', ');
    
    const promptReplacements = {
        questDescription: getLocalizedString(questConfig.description, 'en'),
        locationName: getLocalizedString(location.name, 'en'),
        locationDescription: getLocalizedString(location.description, 'en'),
        resourceNames,
        numScenarios,
        languageCode,
        languageName
    };
    
    const logDetails = {
        mode: 'Pregenerated Scenarios' as const, prompt: '',
        requestDetails: { questName: getLocalizedString(questConfig.name, 'en'), location: getLocalizedString(location.name, 'en'), numScenarios, grounded: isGrounded, language: languageCode, settings: maskedSettings },
    };

    try {
        const apiCall = async (): Promise<string> => {
            if (isGrounded) {
                 if (isGemini) {
                    const ai = new GoogleGenAI({ apiKey });
                    const prompt = await loadPrompt('prompts/pregenerated-scenarios-grounded.txt', promptReplacements);
                    logDetails.prompt = prompt;
                    const response = await ai.models.generateContent({ model: settings.model, contents: prompt, config: { tools: [{ googleSearch: {} }] } });
                    statsService.updateTokens(response.usageMetadata);
                    return response.text;
                 } else {
                    const schemaString = JSON.stringify(scenarioArraySchema, null, 2).replace(/"/g, '\"');
                    const systemInstruction = await loadPrompt('prompts/pregenerated-scenarios-grounded-openai.txt', { ...promptReplacements, schema: schemaString });
                    logDetails.prompt = systemInstruction;
                    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify({
                            model: settings.model,
                            messages: [{ role: 'system', content: systemInstruction }],
                            response_format: { type: "json_object" }
                        })
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        const error = new Error(`API request failed: ${response.status} ${errorText}`);
                        (error as any).status = response.status;
                        throw error;
                    }
                    const jsonResponse = await response.json();
                    return jsonResponse.choices[0].message.content;
                }

            } else { // Fictional flow
                if (!isGemini) {
                    const schemaString = JSON.stringify(scenarioArraySchema, null, 2).replace(/"/g, '\"');
                    const systemInstruction = await loadPrompt('prompts/pregenerated-scenarios-fictional-openai.txt', { ...promptReplacements, schema: schemaString });
                    logDetails.prompt = systemInstruction;
                    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify({
                            model: settings.model,
                            messages: [{ role: 'system', content: systemInstruction }],
                            response_format: { type: "json_object" }
                        })
                    });
                     if (!response.ok) {
                        const errorText = await response.text();
                        const error = new Error(`API request failed: ${response.status} ${errorText}`);
                        (error as any).status = response.status;
                        throw error;
                    }
                    const jsonResponse = await response.json();
                    return jsonResponse.choices[0].message.content;
                } else {
                    const prompt = await loadPrompt('prompts/pregenerated-scenarios-fictional.txt', promptReplacements);
                    logDetails.prompt = prompt;
                    const ai = new GoogleGenAI({ apiKey });
                    const response = await ai.models.generateContent({
                        model: settings.model, contents: prompt,
                        config: { responseMimeType: "application/json", responseSchema: scenarioArraySchema }
                    });
                    statsService.updateTokens(response.usageMetadata);
                    return response.text;
                }
            }
        };
        
        const text = await withRetry(apiCall);
        if (!text) throw new Error("The API returned an empty response.");
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
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error(API_KEY_ERROR);

    const settings = settingsService.getAiSettings();
    const languageCode = settingsService.getLanguage();
    const languageName = LANGUAGE_MAP[languageCode];
    const maskedSettings = { ...settings, apiKey: maskApiKey(apiKey) };
    const isGemini = settings.providerId === 'gemini';
    const isGrounded = !!questConfig.groundingInReality;
    
    const resourceNames = questConfig.resources.map(r => getLocalizedString(r.name, 'en').toLowerCase()).join(', ');
    const promptReplacements = {
        questDescription: getLocalizedString(questConfig.description, 'en'),
        locationName: getLocalizedString(location.name, 'en'),
        locationDescription: getLocalizedString(location.description, 'en'),
        resourceNames,
        languageCode,
        languageName
    };

    const logDetails = {
        mode: (isGrounded ? 'Dynamic Scenario (Grounded)' : 'Dynamic Scenario (Fictional)') as any,
        prompt: '',
        requestDetails: { questName: getLocalizedString(questConfig.name, 'en'), location: getLocalizedString(location.name, 'en'), grounded: isGrounded, language: languageCode, settings: maskedSettings },
    };

    try {
        let scenarioData: any;
        let source: any = null;

        const apiCall = async (): Promise<string> => {
            if (isGrounded) {
                if (isGemini) {
                    const ai = new GoogleGenAI({ apiKey });
                    const prompt = await loadPrompt('prompts/dynamic-scenario-grounded.txt', promptReplacements);
                    logDetails.prompt = prompt;
                    const response = await ai.models.generateContent({ model: settings.model, contents: prompt, config: { tools: [{ googleSearch: {} }] } });
                    statsService.updateTokens(response.usageMetadata);
                    source = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.[0]?.web;
                    return response.text;
                } else { // Grounded, OpenAI-compatible
                    const schemaString = JSON.stringify(dynamicScenarioSchema, null, 2).replace(/"/g, '\"');
                    const systemInstruction = await loadPrompt('prompts/dynamic-scenario-grounded-openai.txt', { ...promptReplacements, schema: schemaString });
                    logDetails.prompt = systemInstruction;
                     const response = await fetch(`${settings.baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify({ model: settings.model, messages: [{ role: 'system', content: systemInstruction }], response_format: { type: "json_object" } })
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        const error = new Error(`API request failed: ${response.status} ${errorText}`);
                        (error as any).status = response.status;
                        throw error;
                    }
                    const jsonResponse = await response.json();
                    return jsonResponse.choices[0].message.content;
                }
            } else { // Fictional flow
                if (!isGemini) {
                    const schemaString = JSON.stringify(dynamicScenarioSchema, null, 2).replace(/"/g, '\"');
                    const systemInstruction = await loadPrompt('prompts/dynamic-scenario-fictional-openai.txt', { ...promptReplacements, schema: schemaString });
                    logDetails.prompt = systemInstruction;
                    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                        body: JSON.stringify({ model: settings.model, messages: [{ role: 'system', content: systemInstruction }], response_format: { type: "json_object" } })
                    });
                    if (!response.ok) {
                        const errorText = await response.text();
                        const error = new Error(`API request failed: ${response.status} ${errorText}`);
                        (error as any).status = response.status;
                        throw error;
                    }
                    const jsonResponse = await response.json();
                    return jsonResponse.choices[0].message.content;
                } else {
                    const prompt = await loadPrompt('prompts/dynamic-scenario-fictional.txt', promptReplacements);
                    logDetails.prompt = prompt;
                    const ai = new GoogleGenAI({ apiKey });
                    const response = await ai.models.generateContent({
                        model: settings.model, contents: prompt,
                        config: { responseMimeType: "application/json", responseSchema: dynamicScenarioSchema }
                    });
                    statsService.updateTokens(response.usageMetadata);
                    return response.text;
                }
            }
        };

        const text = await withRetry(apiCall);
        if (!text) throw new Error("API returned empty response.");
        
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
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error(API_KEY_ERROR);

    const settings = settingsService.getAiSettings();
    if (settings.providerId !== 'gemini') {
        // Fallback for non-gemini providers to keep it simple
        console.warn("AI Player choice is only supported for Gemini provider. Falling back to random choice.");
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
    };

    try {
        const apiCall = async (): Promise<string> => {
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: settings.model,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: aiChoiceSchema,
                }
            });
            statsService.updateTokens(response.usageMetadata);
            return response.text;
        };

        const text = await withRetry(apiCall);
        if (!text) throw new Error("API returned empty response for AI choice.");

        auditLogService.addLog({ ...logDetails, response: text, error: null });
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
        const jsonText = jsonMatch ? jsonMatch[1] : text;
        const json = JSON.parse(jsonText);
        const choiceIndex = json.choiceIndex;

        if (choiceIndex === 0 || choiceIndex === 1) {
            return choiceIndex;
        }
        
        console.warn("AI returned invalid choice index, picking randomly.", json);
        return Math.floor(Math.random() * 2);

    } catch(e: any) {
        auditLogService.addLog({ ...logDetails, response: '', error: e.message });
        throw e;
    }
};