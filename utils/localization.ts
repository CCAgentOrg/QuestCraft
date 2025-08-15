
import type { LocalizedString, LanguageCode } from '../types';

export const getLocalizedString = (
    localizedString: LocalizedString | string | undefined, 
    lang: LanguageCode,
    defaultLang: LanguageCode = 'en'
): string => {
    if (!localizedString) {
        return '';
    }
    if (typeof localizedString === 'string') {
        return localizedString;
    }
    if (localizedString[lang]) {
        return localizedString[lang];
    }
    if (localizedString[defaultLang]) {
        return localizedString[defaultLang];
    }
    // Fallback to the first available language
    const firstKey = Object.keys(localizedString)[0];
    if (firstKey) {
        return localizedString[firstKey];
    }
    return '';
};
