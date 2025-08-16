import type { AppStats } from '../types';

const STATS_STORAGE_KEY = 'questcraft-usage-stats';
export const STATS_UPDATED_EVENT = 'statsupdated';

const GEMINI_FLASH_INPUT_COST_PER_MILLION = 0.35;
const GEMINI_FLASH_OUTPUT_COST_PER_MILLION = 0.70;

const getTokenLimit = (): number => {
    const limitStr = process.env.TOKEN_LIMIT;
    if (limitStr) {
        const limit = parseInt(limitStr, 10);
        return isNaN(limit) || limit <= 0 ? 1_000_000 : limit;
    }
    return 1_000_000;
};

const dispatchUpdateEvent = () => {
    window.dispatchEvent(new Event(STATS_UPDATED_EVENT));
};

export const statsService = {
    getStats: (): AppStats => {
        const defaultStats: AppStats = {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCost: 0,
            timePlayedInSeconds: 0,
        };
        try {
            const statsJson = localStorage.getItem(STATS_STORAGE_KEY);
            return statsJson ? JSON.parse(statsJson) : { ...defaultStats };
        } catch (e) {
            console.error("Failed to parse usage stats from localStorage", e);
            return { ...defaultStats };
        }
    },
    updateTokens: (usage?: { inputTokens: number; outputTokens: number }) => {
        if (!usage || (usage.inputTokens === 0 && usage.outputTokens === 0)) return;

        const stats = statsService.getStats();
        
        stats.totalInputTokens += usage.inputTokens || 0;
        stats.totalOutputTokens += usage.outputTokens || 0;

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
    isTokenLimitExceeded: (): boolean => {
        const stats = statsService.getStats();
        const totalTokens = (stats.totalInputTokens || 0) + (stats.totalOutputTokens || 0);
        const limit = getTokenLimit();
        return totalTokens >= limit;
    },

    getTokenUsage: (): { used: number; limit: number } => {
        const stats = statsService.getStats();
        const used = (stats.totalInputTokens || 0) + (stats.totalOutputTokens || 0);
        const limit = getTokenLimit();
        return { used, limit };
    },
    resetStats: () => {
        try {
            const defaultStats: AppStats = {
                totalInputTokens: 0,
                totalOutputTokens: 0,
                totalCost: 0,
                timePlayedInSeconds: 0,
            };
            localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(defaultStats));
            dispatchUpdateEvent();
        } catch (e) {
            console.error("Failed to reset usage stats in localStorage", e);
        }
    }
};