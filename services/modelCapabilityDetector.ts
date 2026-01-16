// services/modelCapabilityDetector.ts
// Model capability detection for adaptive prompt generation

import type { AiProviderId } from '../types';

export interface ModelCapabilities {
    supportsJsonSchema: boolean;
    supportsTools: boolean;
    supportsThinking: boolean;
    maxContextTokens: number;
    prefersMarkdown: boolean;
    requiresJsonOnly: boolean;
    canDoWebSearch: boolean;  // Native web search capability
    supportsStreaming: boolean;
    qualityTier: 'high' | 'medium' | 'basic';
    supportsMultiLanguage: boolean;
}

// Capability registry for all models
export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
    // OpenAI Models
    'openai/gpt-4o': {
        supportsJsonSchema: true,
        supportsTools: true,
        supportsThinking: true,
        maxContextTokens: 128000,
        prefersMarkdown: false,
        requiresJsonOnly: true,
        canDoWebSearch: true,  // Native via API
        supportsStreaming: true,
        qualityTier: 'high',
        supportsMultiLanguage: true
    },
    'openai/gpt-4o-mini': {
        supportsJsonSchema: true,
        supportsTools: true,
        supportsThinking: true,
        maxContextTokens: 128000,
        prefersMarkdown: false,
        requiresJsonOnly: true,
        canDoWebSearch: true,
        supportsStreaming: true,
        qualityTier: 'high',
        supportsMultiLanguage: true
    },
    'openai/gpt-oss-120b': {
        supportsJsonSchema: false,  // Open-source models vary
        supportsTools: true,
        supportsThinking: true,
        maxContextTokens: 131072,
        prefersMarkdown: false,
        requiresJsonOnly: false,  // More flexible
        canDoWebSearch: false,  // No native search
        supportsStreaming: true,
        qualityTier: 'medium',
        supportsMultiLanguage: true
    },
    'openai/gpt-oss-20b': {
        supportsJsonSchema: false,
        supportsTools: true,
        supportsThinking: true,
        maxContextTokens: 131072,
        prefersMarkdown: false,
        requiresJsonOnly: false,
        canDoWebSearch: false,  // No native search
        supportsStreaming: true,
        qualityTier: 'medium',
        supportsMultiLanguage: false  // Limited multilingual support
    },
  
    // Google Models
    'google/gemini-2.5-flash': {
        supportsJsonSchema: true,
        supportsTools: true,
        supportsThinking: true,
        maxContextTokens: 1048576,
        prefersMarkdown: true,
        requiresJsonOnly: false,
        canDoWebSearch: true,  // Via google_search tool
        supportsStreaming: true,
        qualityTier: 'high',
        supportsMultiLanguage: true
    },
    'google/gemini-2.5-pro': {
        supportsJsonSchema: true,
        supportsTools: true,
        supportsThinking: true,
        maxContextTokens: 1048576,
        prefersMarkdown: true,
        requiresJsonOnly: false,
        canDoWebSearch: true,
        supportsStreaming: true,
        qualityTier: 'high',
        supportsMultiLanguage: true
    },
    'google/gemma-3-27b-it': {
        supportsJsonSchema: false,
        supportsTools: true,
        supportsThinking: false,
        maxContextTokens: 8192,
        prefersMarkdown: true,
        requiresJsonOnly: false,
        canDoWebSearch: false,
        supportsStreaming: true,
        qualityTier: 'basic',
        supportsMultiLanguage: true
    },
  
    // DeepSeek (via OpenRouter)
    'tngtech/deepseek-r1t2-chimera:free': {
        supportsJsonSchema: false,
        supportsTools: false,
        supportsThinking: true,
        maxContextTokens: 64000,
        prefersMarkdown: false,
        requiresJsonOnly: false,
        canDoWebSearch: false,
        supportsStreaming: true,
        qualityTier: 'medium',
        supportsMultiLanguage: true
    },
    'tngtech/deepseek-r1t2-chimera:free': {
        supportsJsonSchema: false,
        supportsTools: false,
        supportsThinking: true,
        maxContextTokens: 164000,
        prefersMarkdown: false,
        requiresJsonOnly: false,
        canDoWebSearch: false,
        supportsStreaming: true,
        qualityTier: 'medium',
        supportsMultiLanguage: true
    },
  
    // Community Model
    'openai/gpt-oss-20b:free': {
        supportsJsonSchema: false,
        supportsTools: false,
        supportsThinking: false,
        maxContextTokens: 131072,
        prefersMarkdown: false,
        requiresJsonOnly: false,
        canDoWebSearch: false,  // CRITICAL: No web search in community tier
        supportsStreaming: true,
        qualityTier: 'medium',
        supportsMultiLanguage: false
    },
  
    // Default for unknown models
    'default': {
        supportsJsonSchema: false,
        supportsTools: false,
        supportsThinking: false,
        maxContextTokens: 4096,
        prefersMarkdown: true,
        requiresJsonOnly: false,
        canDoWebSearch: false,
        supportsStreaming: false,
        qualityTier: 'basic',
        supportsMultiLanguage: false
    }
};

export const detectCapabilities = (modelId: string): ModelCapabilities => {
    return MODEL_CAPABILITIES[modelId] || MODEL_CAPABILITIES.default;
};

// Helper to select best prompt variant based on capabilities
export const selectPromptVariant = (
    basePrompt: string,
    capabilities: ModelCapabilities,
    requireJsonOutput: boolean
): string => {
    let prompt = basePrompt;
  
    // Remove JSON schema for models that don't support it
    if (!capabilities.supportsJsonSchema && !requireJsonOutput) {
        prompt = prompt.replace(/# JSON Schema[\s\S]*?\n?/g, '');
    }
  
    // Add tool instructions for capable models
    if (capabilities.supportsTools && !prompt.includes('# Available Tools')) {
        prompt += '\n\n# Available Tools\nWhen appropriate, use web_search tool to get current information.';
    }
  
    // Add thinking instructions for capable models
    if (capabilities.supportsThinking && capabilities.prefersMarkdown) {
        if (!prompt.includes('Thinking')) {
            prompt = prompt.replace(
                '# Your Task',
                '# Your Task\n\n**Thinking Instructions:**\nFirst, think through the problem step-by-step in <thinking> tags. Then provide your final answer.'
            );
        }
    }
  
    return prompt;
};