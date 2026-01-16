// tests/promptTestCases.ts
// Test case definitions for prompt testing

import type { TestCase } from '../services/promptTester';

export const scenarioGenerationTests: TestCase[] = [
    {
        name: 'basic_scenario_structure',
        input: {
            questDescription: 'A game about environmental conservation',
            locationName: 'Forest Reserve',
            locationDescription: 'Protected wildlife sanctuary',
            resourceNames: 'Funding, Conservation, Awareness',
            languageCode: 'en',
            languageList: ['en', 'es']
        },
        expectedSchema: true,
        validators: {
            hasRequiredFields: ['title', 'description', 'choices'],
            minLanguageCount: 2
        }
    },
    {
        name: 'single_choice_scenario',
        input: {
            questDescription: 'Business management',
            locationName: 'Corporate Office',
            locationDescription: 'Modern business environment',
            resourceNames: 'Revenue, Innovation, Culture',
            languageCode: 'en',
            languageList: ['en']
        },
        expectedSchema: true,
        validators: {
            hasRequiredFields: ['title', 'description', 'choices']
        }
    },
    {
        name: 'grounded_scenario_with_sources',
        input: {
            questDescription: 'Public transportation',
            locationName: 'Metro Station',
            locationDescription: 'Urban transit hub',
            resourceNames: 'Budget, Efficiency, Satisfaction',
            languageCode: 'en',
            languageList: ['en'],
            groundingInReality: true // Flag to test grounded prompt
        },
        expectedSchema: true,
        validators: {
            hasRequiredFields: ['title', 'description', 'choices', 'sourceUrl']
        }
    }
];

export const promptVariationTests: TestCase[] = [
    {
        name: 'json_vs_text_output',
        input: {
            questDescription: 'Test quest',
            locationName: 'Test Location',
            locationDescription: 'Test description',
            resourceNames: 'Resource1, Resource2',
            languageCode: 'en'
        },
        validators: {
            notContainsHallucinations: true
        }
    },
    {
        name: 'multilingual_capability',
        input: {
            questDescription: 'International business',
            languageList: ['en', 'es', 'hi', 'ta'], // Request all 4
            languageCode: 'en'
        },
        validators: {
            minLanguageCount: 4
        }
    }
];