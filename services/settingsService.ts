
import type { AiProviderSettings, AiProviderId, AppSettings, LanguageCode } from '../types';
import { logger } from './logger';

export const APP_SETTINGS_STORAGE_KEY = 'questcraft-app-settings';
export const SESSION_API_KEY_STORAGE_KEY = 'questcraft-session-api-key';
export const SETTINGS_UPDATED_EVENT = 'settingsupdated';

const dispatchUpdateEvent = () => {
    window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
};

export interface AiProviderConfig {
    id: AiProviderId;
    name: string;
    defaultModel: string;
    baseUrl?: string;
    isCustom: boolean;
    isGemini: boolean;
}

export const PROVIDER_CONFIGS: Record<AiProviderId, AiProviderConfig> = {
    gemini: {
        id: 'gemini',
        name: 'Google Gemini',
        defaultModel: 'gemini-2.5-flash',
        isCustom: false,
        isGemini: true,
    },
    openai: {
        id: 'openai',
        name: 'OpenAI',
        defaultModel: 'gpt-4o',
        baseUrl: 'https://api.openai.com/v1',
        isCustom: false,
        isGemini: false,
    },
    openrouter: {
        id: 'openrouter',
        name: 'OpenRouter',
        defaultModel: 'perplexity/llama-3-sonar-large-32k-online',
        baseUrl: 'https://openrouter.ai/api/v1',
        isCustom: false,
        isGemini: false,
    },
    groq: {
        id: 'groq',
        name: 'Groq',
        defaultModel: 'llama3-70b-8192',
        baseUrl: 'https://api.groq.com/openai/v1',
        isCustom: false,
        isGemini: false,
    },
    together: {
        id: 'together',
        name: 'Together AI',
        defaultModel: 'meta-llama/Llama-3-70b-chat-hf',
        baseUrl: 'https://api.together.ai/v1',
        isCustom: false,
        isGemini: false,
    },
    custom: {
        id: 'custom',
        name: 'Custom (OpenAI-compatible)',
        defaultModel: '',
        baseUrl: '',
        isCustom: true,
        isGemini: false,
    }
};

const ENV_API_KEYS: Partial<Record<AiProviderId, string | undefined>> = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    groq: process.env.GROQ_API_KEY,
    together: process.env.TOGETHER_API_KEY,
};

export const getProviderApiKeyFromEnv = (providerId: AiProviderId): string | undefined => {
    // Check for provider-specific key first
    const specificKey = ENV_API_KEYS[providerId];
    if (specificKey) {
        return specificKey;
    }
    // Fallback to generic API_KEY for backward compatibility
    return process.env.API_KEY;
};

export const defaultSettings: AppSettings = {
    ai: {
        providerId: 'gemini',
        model: PROVIDER_CONFIGS.gemini.defaultModel,
        baseUrl: PROVIDER_CONFIGS.gemini.baseUrl,
        aiRequestDelayMs: 1100,
    },
    language: 'en',
};

export const settingsService = {
    getSettings: (): AppSettings => {
        try {
            const settingsJson = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
            const saved = settingsJson ? JSON.parse(settingsJson) : {};
            
            const savedAi = saved.ai || {};
            // Clean up legacy apiKey from storage if it exists
            delete savedAi.apiKey;

            const merged: AppSettings = {
                ai: { ...defaultSettings.ai, ...savedAi },
                language: saved.language || defaultSettings.language
            };
            
            if (!PROVIDER_CONFIGS[merged.ai.providerId]) {
                merged.ai.providerId = 'gemini';
            }
            return merged;
        } catch (e) {
            console.error("Failed to parse app settings from localStorage", e);
            return { ...defaultSettings };
        }
    },
    saveSettings: (settings: AppSettings): void => {
        try {
            const settingsToSave = JSON.parse(JSON.stringify(settings));
            if (settingsToSave.ai) {
                delete settingsToSave.ai.apiKey;
            }
            logger.info('[Settings] Saving app settings to localStorage.', settingsToSave);
            localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));
            dispatchUpdateEvent();
        } catch (e) {
            console.error("Failed to save app settings to localStorage", e);
        }
    },

    getAiSettings: (): AiProviderSettings => {
        return settingsService.getSettings().ai;
    },
    saveAiSettings: (aiSettings: AiProviderSettings): void => {
        const currentSettings = settingsService.getSettings();
        const aiSettingsToSave = { ...aiSettings };
        // Ensure apiKey is never part of the saved object.
        delete (aiSettingsToSave as any).apiKey;
        settingsService.saveSettings({ ...currentSettings, ai: aiSettingsToSave });
    },
    
    getLanguage: (): LanguageCode => {
        return settingsService.getSettings().language;
    },
    saveLanguage: (language: LanguageCode): void => {
        const currentSettings = settingsService.getSettings();
        settingsService.saveSettings({ ...currentSettings, language });
    },

    getSessionApiKey: (): string | null => {
        try {
            return sessionStorage.getItem(SESSION_API_KEY_STORAGE_KEY);
        } catch (e) {
            console.error("Failed to get session API key from sessionStorage", e);
            return null;
        }
    },
    saveSessionApiKey: (apiKey: string): void => {
        try {
            logger.info('[Settings] Saving session API key to sessionStorage.');
            sessionStorage.setItem(SESSION_API_KEY_STORAGE_KEY, apiKey);
            dispatchUpdateEvent();
        } catch (e) {
            console.error("Failed to save session API key to sessionStorage", e);
        }
    },
    clearSessionApiKey: (): void => {
        try {
            logger.info('[Settings] Clearing session API key from sessionStorage.');
            sessionStorage.removeItem(SESSION_API_KEY_STORAGE_KEY);
            dispatchUpdateEvent();
        } catch (e) {
            console.error("Failed to clear session API key from sessionStorage", e);
        }
    }
};
