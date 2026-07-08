// @ts-nocheck
// services/questPreGenerator.ts
// Pre-generate scenarios for quest (batch web searches at startup)

import type { QuestConfig, BoardLocation, LanguageCode } from '../types';
import { generateDynamicScenario, generatePregeneratedScenarios } from './aiService';
import { webSearchService } from './webSearchService';
import { statsService } from './statsService';
import { logger } from './logger';

export interface PreGenerationResult {
    questConfig: QuestConfig;
    scenarios: Record<string, ManagedScenario[]>; // Indexed by location name
    metadata: {
        totalScenarios: number;
        generationTimeMs: number;
        webSearchesPerformed: number;
        webSearchFailures: number;
    };
}

export const questPreGenerator = {
    // Pre-generate all scenarios for a quest
    preGenerateQuest: async (
        questConfig: QuestConfig,
        language: LanguageCode,
        useGrounding: boolean,
        onProgress?: (message: string, percentage: number) => void
    ): Promise<PreGenerationResult> => {
        const startTime = Date.now();
        
        if (onProgress) {
            onProgress('Starting scenario pre-generation...', 0);
        }
        
        const scenarios: Record<string, ManagedScenario[]> = {};
        let totalScenarios = 0;
        let webSearchesPerformed = 0;
        let webSearchFailures = 0;
        
        const propertyLocations = questConfig.board.locations.filter(
            loc => loc.type === 'PROPERTY'
        );
        
        // Batching strategy: Perform all searches in parallel, then generate scenarios
        // This reduces total time for user (no waiting between scenarios)
        const numScenariosPerLocation = useGrounding ? 3 : 2;
        
        if (propertyLocations.length > 0) {
            onProgress?.(
                `Preparing web searches for ${propertyLocations.length} locations...`,
                5
            );
            
            // Batch 1: Perform all web searches in parallel
            const searchPromises = propertyLocations.map(async (location) => {
                const searchQuery = `${questConfig.description.en} ${location.description.en}`;
                return webSearchService.search(searchQuery, {
                    engine: 'exa', // Default to Exa (free, good for facts)
                    maxResults: 5
                });
            });
            
            const searchResultsArray = await Promise.all(searchPromises);
            
            // Track web search stats
            let totalResults = 0;
            for (const results of searchResultsArray) {
                totalResults += results.length;
                webSearchesPerformed += 1;
                if (results.length === 0) {
                    webSearchFailures += 1;
                }
            }
            statsService.trackWebSearch(totalResults, false);
            
            onProgress?.(
                `Web search complete. Generating scenarios for ${propertyLocations.length} locations...`,
                20
            );
            
            // Batch 2: Generate all scenarios in parallel
            const generationPromises = propertyLocations.map(async (location, idx) => {
                try {
                    const generated = await generatePregeneratedScenarios({
                        questConfig,
                        location,
                        numScenarios: numScenariosPerLocation,
                        languageCode,
                        useGrounding
                    });
                    
                    if (generated && generated.length > 0) {
                        scenarios[location.name.en] = generated;
                        totalScenarios += generated.length;
                    } else {
                        webSearchFailures += 1;
                    }
                } catch (error: any) {
                    logger.warn(`[PreGenerator] Failed for ${location.name.en}, trying without grounding:`, error);
                    
                    // Fallback: generate without grounding
                    try {
                        const generated = await generatePregeneratedScenarios({
                            questConfig,
                            location,
                            numScenarios: numScenariosPerLocation,
                            languageCode,
                            useGrounding: false // Disable grounding for this attempt
                        });
                        
                        if (generated && generated.length > 0) {
                            scenarios[location.name.en] = generated;
                            totalScenarios += generated.length;
                        }
                    } catch (fallbackError) {
                        logger.error(`[PreGenerator] Complete failure for ${location.name.en}:`, fallbackError);
                        // Create placeholder scenario
                        scenarios[location.name.en] = [{
                            id: `fallback_${location.name.en}`,
                            title: { en: `Scenario for ${location.name.en}` },
                            description: { en: `A scenario at ${location.description.en}` },
                            choices: [
                                {
                                    text: { en: 'Option A' },
                                    outcome: {
                                        explanation: { en: 'Proceed with current resources' },
                                        resourceChanges: []
                                    }
                                },
                                {
                                    text: { en: 'Option B' },
                                    outcome: {
                                        explanation: { en: 'Adjust strategy' },
                                        resourceChanges: []
                                    }
                                }
                            ]
                        }];
                    }
                }
            });
            
            await Promise.all(generationPromises);
        } else {
            logger.warn('[PreGenerator] No property locations to pre-generate');
        }
        
        const generationTime = Date.now() - startTime;
        
        if (onProgress) {
            onProgress('Pre-generation complete!', 100);
        }
        
        return {
            questConfig,
            scenarios,
            metadata: {
                totalScenarios,
                generationTimeMs: generationTime,
                webSearchesPerformed,
                webSearchFailures
            }
        };
    },

    // Cache pre-generated scenarios in localStorage
    cacheScenarios: (
        questName: string,
        scenarios: Record<string, ManagedScenario[]>
    ): void => {
        const cacheKey = `questcraft-pregen-${questName}`;
        try {
            localStorage.setItem(cacheKey, JSON.stringify(scenarios));
            logger.info(`[PreGenerator] Cached ${Object.keys(scenarios).length} locations`);
        } catch (e) {
            logger.error(`[PreGenerator] Failed to cache scenarios:`, e);
        }
    },

    // Load cached scenarios
    loadCachedScenarios: (questName: string): Record<string, ManagedScenario[]> | null => {
        const cacheKey = `questcraft-pregen-${questName}`;
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            logger.error(`[PreGenerator] Failed to load cached scenarios:`, e);
            return null;
        }
    }
};