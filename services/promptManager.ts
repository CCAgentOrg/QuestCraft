// services/promptManager.ts
// Adaptive prompt management with model capability awareness

import type { ModelCapabilities, detectCapabilities, selectPromptVariant } from './modelCapabilityDetector';
import { loadPrompt as loadPromptFile } from './aiService';
import { logger } from './logger';

export interface PromptConfig {
    templateName: string;
    replacements: Record<string, string | number>;
    capabilities: ModelCapabilities;
    requireJsonOutput: boolean;
}

export interface ValidationResult {
    isValid: boolean;
    error?: string;
    extractedData?: any;
    data?: any;
}

export const promptManager = {
    // Enhanced prompt loading with capability adaptation
    loadAndAdapt: async (config: PromptConfig): Promise<string> => {
        const { templateName, replacements, capabilities, requireJsonOutput } = config;
        
        // Load base template
        let prompt = await loadPromptFile(templateName, replacements);
        
        // Adapt to model capabilities
        prompt = selectPromptVariant(prompt, capabilities, requireJsonOutput);
        
        // Add language constraint warning
        const requestedLangs = replacements.languageList?.length || 0;
        if (requestedLangs > 2 && !capabilities.supportsMultiLanguage) {
            const langList = replacements.languageList as string[];
            const limitedList = langList.slice(0, 2);
            const langCodes = limitedList.map(l => {
                const codeMatch = l.match(/'?languageCode'?([a-z]{2})'/)?.[1];
                return codeMatch || 'en';
            }).join(', ');
            
            prompt = `\n\n# LANGUAGE LIMITATION WARNING\nThis model has limited multilingual support. High-quality outputs will prioritize ${replacements.languageCode} with best-effort translations for: ${langCodes}.\n\n` + prompt;
        }
        
        return prompt;
    },

    // Robust JSON extraction from output
    extractJson: (output: string, capabilities: ModelCapabilities): ValidationResult => {
        if (!capabilities.requiresJsonOnly) {
            // Text model - return as-is or try basic extraction
            return { isValid: true, data: output };
        }
        
        // Try direct parse first
        try {
            const parsed = JSON.parse(output);
            return { isValid: true, data: parsed };
        } catch (e) {
            // Try markdown code block extraction
            const jsonMatch = output.match(/```json\n?([\s\S]*?)\n?```/s);
            if (jsonMatch) {
                try {
                    const extracted = JSON.parse(jsonMatch[1]);
                    return { isValid: true, data: extracted, method: 'markdown-extraction' };
                } catch (e2) {
                    // Try finding first { and last }
                    const startIdx = output.indexOf('{');
                    const endIdx = output.lastIndexOf('}');
                    if (startIdx >= 0 && endIdx > startIdx) {
                        try {
                            const extracted = JSON.parse(output.substring(startIdx, endIdx + 1));
                            return { isValid: true, data: extracted, method: 'bracket-extraction' };
                        } catch (e3) {
                            return { isValid: false, error: `JSON parse failed: ${e.message}` };
                        }
                    }
                }
            }
            return { isValid: false, error: 'No valid JSON found in output' };
        }
    },

    // Fallback prompt generator for error scenarios
    generateFallbackPrompt: (originalPrompt: string, errorType: string): string => {
        const fallbackTemplates = {
            'json-fail': `You failed to generate valid JSON. Please try again with this simplified request:\n\n${originalPrompt}`,
            'tool-refusal': `You refused to use a tool. Let's try without tool requirements:\n\n${originalPrompt}`,
            'context-overflow': `The previous response was too long. Please try with a shorter context. Focus on the core task:\n\nGenerate a scenario with title and two choices.`,
            'web-search-fail': `Web search was not available or returned no results. Proceeding with fictional generation instead. Note: To enable reality grounding, please use a model with web search capabilities or provide your own API key.`
        };
        return fallbackTemplates[errorType] || originalPrompt;
    }
};
