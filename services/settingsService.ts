
import type { AiProviderSettings, AiProviderId, AppSettings, LanguageCode } from '../types';

export const APP_SETTINGS_STORAGE_KEY = 'questcraft-app-settings';

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
        defaultModel: 'google/gemini-flash-1.5',
        baseUrl: 'https://openrouter.ai/api/v1',
        isCustom: false,
        isGemini: false,
    },
    groq: {
        id: 'groq',
        name: 'Groq',
        defaultModel: 'llama3-8b-8192',
        baseUrl: 'https://api.groq.com/openai/v1',
        isCustom: false,
        isGemini: false,
    },
    together: {
        id: 'together',
        name: 'Together AI',
        defaultModel: 'meta-llama/Llama-3-8b-chat-hf',
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

export const defaultSettings: AppSettings = {
    ai: {
        providerId: 'gemini',
        model: PROVIDER_CONFIGS.gemini.defaultModel,
        baseUrl: PROVIDER_CONFIGS.gemini.baseUrl,
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
            localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));
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
    }
};
