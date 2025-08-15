
import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsService } from './settingsService';
import type { LanguageCode } from '../types';

interface LanguageContextType {
    language: LanguageCode;
    setLanguage: (lang: LanguageCode) => void;
    t: (key: string, replacements?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useTranslation = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};

interface LanguageProviderProps {
    children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
    const [language, setLanguageState] = useState<LanguageCode>(settingsService.getLanguage());
    const [translations, setTranslations] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadTranslations = async (lang: LanguageCode) => {
            try {
                const response = await fetch(`/locales/${lang}.json`);
                if (!response.ok) {
                    throw new Error(`Failed to load translations for ${lang}`);
                }
                const data = await response.json();
                setTranslations(data);
            } catch (error) {
                console.error(error);
                // Fallback to English if the selected language file fails to load
                if (lang !== 'en') {
                    loadTranslations('en');
                }
            }
        };
        loadTranslations(language);
    }, [language]);

    const setLanguage = (lang: LanguageCode) => {
        settingsService.saveLanguage(lang);
        setLanguageState(lang);
    };

    const t = (key: string, replacements: Record<string, string | number> = {}): string => {
        let translation = translations[key] || key;
        Object.entries(replacements).forEach(([placeholder, value]) => {
            translation = translation.replace(`{${placeholder}}`, String(value));
        });
        return translation;
    };

    const value = {
        language,
        setLanguage,
        t,
    };

    return React.createElement(LanguageContext.Provider, { value: value }, children);
};