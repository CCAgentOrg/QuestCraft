import type { AppStats } from '../types';
import type { UsageMetadata } from '@google/genai';

const STATS_STORAGE_KEY = 'questcraft-usage-stats';
export const STATS_UPDATED_EVENT = 'statsupdated';

const GEMINI_FLASH_INPUT_COST_PER_MILLION = 0.35;
const GEMINI_FLASH_OUTPUT_COST_PER_MILLION = 0.70;

const defaultStats: AppStats = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    timePlayedInSeconds: 0,
};

const dispatchUpdateEvent = () => {
    window.dispatchEvent(new Event(STATS_UPDATED_EVENT));
};

export const statsService = {
    getStats: (): AppStats => {
        try {
            const statsJson = localStorage.getItem(STATS_STORAGE_KEY);
            return statsJson ? JSON.parse(statsJson) : { ...defaultStats };
        } catch (e) {
            console.error("Failed to parse usage stats from localStorage", e);
            return { ...defaultStats };
        }
    },
    updateTokens: (usageMetadata?: UsageMetadata) => {
        if (!usageMetadata) return;

        const stats = statsService.getStats();
        const inputTokens = usageMetadata.promptTokenCount || 0;
        const totalTokens = usageMetadata.totalTokenCount || 0;

        // Defensively calculate output tokens. In some SDK versions or responses,
        // candidatesTokenCount might be missing. Deriving it from total and prompt
        // counts is more robust.
        const outputTokens = Math.max(0, totalTokens - inputTokens);

        stats.totalInputTokens += inputTokens;
        stats.totalOutputTokens += outputTokens;

        const inputCost = (stats.totalInputTokens / 1_000_000) * GEMINI_FLASH_INPUT_COST_PER_MILLION;
        const outputCost = (stats.totalOutputTokens / 1_000_000) * GEMINI_FLASH_OUTPUT_COST_PER_MILLION;
        stats.totalCost = inputCost + outputCost;

        try {
            localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
            dispatchUpdateEvent();
        } catch (e) {
            console.error("Failed to save usage stats to localStorage", e);
        }
    },
    incrementTimePlayed: () => {
        const stats = statsService.getStats();
        stats.timePlayedInSeconds += 1;
        try {
            localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
            dispatchUpdateEvent();
        } catch (e) {
            console.error("Failed to save usage stats to localStorage", e);
        }
    },
    resetStats: () => {
        try {
            localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(defaultStats));
            dispatchUpdateEvent();
        } catch (e) {
            console.error("Failed to reset usage stats in localStorage", e);
        }
    }
};