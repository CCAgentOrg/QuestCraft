

import { Type } from "@google/genai";

const localizedStringSchema = {
    type: Type.OBJECT,
    properties: {
        en: { type: Type.STRING, description: "The text in English." },
        es: { type: Type.STRING, description: "The text in Spanish." },
        hi: { type: Type.STRING, description: "The text in Hindi." },
        ta: { type: Type.STRING, description: "The text in Tamil." },
    },
    required: ['en', 'es', 'hi', 'ta']
};

export const resourceChangeSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, description: "The lowercase English name of the resource to change." },
        value: { type: Type.INTEGER, description: "The amount to change the resource by (can be negative)." },
    },
    required: ['name', 'value']
};

export const resourceDefinitionSchema = {
    type: Type.OBJECT,
    properties: {
        name: { ...localizedStringSchema, description: "Display name of the resource, e.g., 'Money' or 'Credibility'." },
        icon: { type: Type.STRING, description: "The name of the icon component. Must be one of: 'MoneyIcon', 'TimeIcon', 'InfoIcon'." },
        barColor: { type: Type.STRING, description: "A Tailwind CSS background color class for the resource bar, e.g., 'bg-green-500'." },
        initialValue: { type: Type.INTEGER, description: "The starting value for this resource for all players, e.g., 100." },
        minimumValue: { type: Type.INTEGER, description: "The value at which a player goes bankrupt if this resource drops to it. Often 0." },
        maximumValue: { type: Type.INTEGER, description: "The maximum possible value for this resource." },
    },
    required: ['name', 'icon', 'barColor', 'initialValue']
};

export const boardLocationSchema = {
    type: Type.OBJECT,
    properties: {
        name: { ...localizedStringSchema, description: "The name of the space, e.g., 'Local Market' or 'Server Outage'." },
        description: { ...localizedStringSchema, description: "A short description used by the AI to generate relevant scenarios." },
        type: { type: Type.STRING, description: "The type of space. Must be one of: 'START', 'PROPERTY', 'CHANCE', 'COMMUNITY_CHEST', 'UTILITY', 'TAX', 'JAIL', 'FREE_PARKING', 'GO_TO_JAIL'." },
        color: { type: Type.STRING, description: "For 'PROPERTY' spaces, a Tailwind CSS background color class for the color bar, e.g., 'bg-yellow-600'." },
    },
    required: ['name', 'description', 'type']
};

export const chanceCardSchema = {
    type: Type.OBJECT,
    properties: {
        description: { ...localizedStringSchema, description: "The text displayed on the card." },
        resourceChanges: {
            type: Type.ARRAY,
            description: "An array of objects representing resource changes.",
            items: resourceChangeSchema,
        },
    },
    required: ['description', 'resourceChanges']
};

export const footerSectionSchema = {
    type: Type.OBJECT,
    properties: {
        title: { ...localizedStringSchema, description: "The text for the button in the footer, e.g., 'Rules'." },
        content: { ...localizedStringSchema, description: "The content to display in the modal. Can contain simple HTML like `<ul>`, `<li>`, `<strong>`." },
    },
    required: ['title', 'content']
};

export const questConfigSchema = {
    type: Type.OBJECT,
    properties: {
        name: { ...localizedStringSchema, description: "The creative and thematic title of the quest." },
        description: { ...localizedStringSchema, description: "A short, one-sentence tagline describing the quest's theme." },
        positivity: { type: Type.NUMBER, description: "A value from 0.0 (very challenging/dystopian) to 1.0 (very optimistic/hopeful). Defaults to 0.5." },
        groundingInReality: { type: Type.BOOLEAN, description: "Set to true if the quest is based on real-world events. This will influence scenario generation." },
        resources: {
            type: Type.ARRAY,
            description: "An array of 2-4 core resources players manage.",
            items: resourceDefinitionSchema,
        },
        playerColors: {
            type: Type.ARRAY,
            description: "An array of four Tailwind CSS text color classes for player tokens, e.g., 'text-red-600'.",
            items: { type: Type.STRING }
        },
        board: {
            type: Type.OBJECT,
            properties: {
                jailPosition: { type: Type.INTEGER, description: "The index of the 'JAIL' space in the locations array." },
                locations: {
                    type: Type.ARRAY,
                    description: "An array of location objects that make up the board spaces.",
                    items: boardLocationSchema,
                }
            },
            required: ['jailPosition', 'locations']
        },
        chanceCards: {
            type: Type.ARRAY,
            description: "An array of 'Chance' cards.",
            items: chanceCardSchema
        },
        communityChestCards: {
            type: Type.ARRAY,
            description: "An optional array of 'Community Chest' style cards.",
            items: chanceCardSchema
        },
        footerSections: {
            type: Type.ARRAY,
            description: "Content for informational modals in the game footer. Must include 'Rules' and 'About' sections.",
            items: footerSectionSchema
        }
    },
    required: ['name', 'description', 'resources', 'playerColors', 'board', 'chanceCards', 'footerSections']
};

export const dynamicScenarioSchema = {
    type: Type.OBJECT,
    properties: {
        title: { ...localizedStringSchema, description: "A short, catchy title for the scenario." },
        description: { ...localizedStringSchema, description: "A paragraph describing the situation the player is in." },
        choices: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                required: ["text", "outcome"],
                properties: {
                    text: { ...localizedStringSchema, description: "The text for the choice button." },
                    outcome: {
                        type: Type.OBJECT,
                        required: ["explanation", "resourceChanges"],
                        properties: {
                            explanation: { ...localizedStringSchema, description: "Text explaining the outcome of the choice." },
                            resourceChanges: {
                                type: Type.ARRAY,
                                description: "An array of objects representing resource changes.",
                                items: resourceChangeSchema
                            }
                        }
                    }
                }
            }
        },
        sourceUrl: { type: Type.STRING, description: "Optional: The URL of a source article or reference for this event." },
        sourceTitle: { ...localizedStringSchema, description: "Optional: The title of the source article." }
    },
    required: ["title", "description", "choices"]
};

export const scenarioArraySchema = {
    type: Type.OBJECT,
    properties: {
        scenarios: {
            type: Type.ARRAY,
            description: "An array of generated scenarios.",
            items: dynamicScenarioSchema
        }
    },
    required: ["scenarios"]
};

export const aiChoiceSchema = {
    type: Type.OBJECT,
    properties: {
        choiceIndex: {
            type: Type.INTEGER,
            description: "The index of the chosen option (0 or 1)."
        },
        reasoning: {
            type: Type.STRING,
            description: "A brief explanation for the choice."
        }
    },
    required: ["choiceIndex", "reasoning"]
};