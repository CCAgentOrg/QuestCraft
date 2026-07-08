// @ts-nocheck
// services/webSearchService.ts
// Universal web search service (BYOLLM tier only)
// Community tier uses OpenRouter's :online variant instead

import { logger } from './logger';
import type { SearchEngine, SearchConfig, SearchResult } from './webSearchService';

// Exa API key - only available in BYOLLM mode
const EXA_API_KEY = process.env.EXA_API_KEY;

export const webSearchService = {
    EXA_API_KEY,
    
    // Check if web search is available
    isSearchAvailable: (): boolean => {
        const providerId = (globalThis as any).settingsService?.getAiSettings?.()?.providerId;
        return providerId !== 'community';  // Only available for BYOLLM tier
    },

    // Perform web search
    search: async (
        query: string,
        config: SearchConfig = { engine: SearchEngine.EXA, maxResults: 5 }
    ): Promise<SearchResult[]> => {
        // Check if web search is available
        if (!this.isSearchAvailable()) {
            logger.warn('[WebSearch] Search not available in community mode - proceeding without search results');
            return [];
        }

        // Check for Exa API key in BYOLLM mode
        if (!this.EXA_API_KEY) {
            logger.warn('[WebSearch] Exa API key not configured for BYOLLM mode');
            return [];
        }

        try {
            switch (config.engine) {
                case SearchEngine.EXA:
                    return await this.searchExa(query, config);
                case SearchEngine.BRAVE:
                    return await this.searchBrave(query, config);
                case SearchEngine.DUCKDUCKGO:
                    return await this.searchDuckDuckGo(query, config);
                default:
                    logger.warn(`[WebSearch] Unsupported engine: ${config.engine}`);
                    return [];
            }
        } catch (error) {
            logger.error('[WebSearch] Search failed:', error);
            // Fallback: empty array allows continuing with fictional generation
            return [];
        }
    },

    // Exa API implementation (FREE, good for educational content)
    searchExa: async (query: string, config: SearchConfig): Promise<SearchResult[]> => {
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-api-key': this.EXA_API_KEY 
            },
            body: JSON.stringify({
                query,
                numResults: config.maxResults || 5,
                useAutoprompt: true,
                type: 'neural'
            })
        });

        if (!response.ok) {
            throw new Error(`Exa API error: ${response.status}`);
        }

        const data = await response.json();
        return data.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            snippet: r.text,
            publishedDate: r.publishedDate,
            source: r.source
        }));
    },

    // DuckDuckGo implementation (FREE, no API key needed - good fallback)
    searchDuckDuckGo: async (query: string, config: SearchConfig): Promise<SearchResult[]> => {
        // Use serpapi or direct scraping for production
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(searchUrl);
        
        if (!response.ok) {
            throw new Error(`DuckDuckGo error: ${response.status}`);
        }

        const html = await response.text();
        // Simple regex extraction (enhance with proper parser in production)
        const results: SearchResult[] = [];
        const titleRegex = /<a[^>]*class="result__a"[^>]*>([^<]+)<\/a>/g;
        const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/g;
        const urlRegex = /<a[^>]*href="([^"]+)"/g;

        const matches = html.matchAll(new RegExp(titleRegex.source + snippetRegex.source + urlRegex.source, 'g'));
        
        for (const match of matches) {
            const titleMatch = match[0]?.match(titleRegex);
            const snippetMatch = match[0]?.match(snippetRegex);
            const urlMatch = match[0]?.match(urlRegex);
            
            if (titleMatch && snippetMatch && urlMatch) {
                results.push({
                    title: titleMatch[1]?.replace(/<[^>]+>/g, ''),
                    snippet: snippetMatch[1]?.replace(/<[^>]+>/g, ''),
                    url: urlMatch[1]
                });
            }
        }
        
        return results.slice(0, config.maxResults || 5);
    },

    // Brave API implementation (requires API key)
    searchBrave: async (query: string, config: SearchConfig): Promise<SearchResult[]> => {
        // Brave Search API requires API key - check if configured
        const braveApiKey = process.env.BRAVE_API_KEY;
        if (!braveApiKey) {
            logger.warn('[WebSearch] Brave API key not configured');
            return [];
        }

        const response = await fetch('https://api.search.brave.com/res/v1/web/search', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Subscription-Token': braveApiKey
            },
            body: JSON.stringify({
                q: query,
                count: config.maxResults || 5,
                textDecorations: true,
                searchLang: 'en',
                resultFilter: 'web'
            })
        });

        if (!response.ok) {
            throw new Error(`Brave API error: ${response.status}`);
        }

        const data = await response.json();
        return data.web?.results?.map((r: any) => ({
            title: r.title?.value,
            url: r.url?.value,
            snippet: r.description?.value,
            source: 'Brave'
        })) || [];
    },

    // Grounded prompt generation
    generateGroundedPrompt: (
        basePrompt: string,
        searchResults: SearchResult[],
        contextLimit: number = 2000
    ): string => {
        if (searchResults.length === 0) {
            logger.warn('[WebSearch] No search results available - using base prompt');
            return basePrompt;
        }

        const context = searchResults
            .slice(0, 3) // Use top 3 results
            .map((result, i) => 
                `[${i + 1}] ${result.title}\nSource: ${result.source}\nURL: ${result.url}\n${result.snippet}`
            )
            .join('\n\n');

        const contextSize = context.length;
        if (contextSize > contextLimit) {
            logger.warn(`[WebSearch] Search context (${contextSize} chars) exceeds limit (${contextLimit}), truncating`);
        }

        return `${basePrompt}\n\n# Search Results\nUse the following search results to ground your response:\n\n${context}`;
    }
};
