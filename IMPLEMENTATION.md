# Robust Prompt System & Web Search Implementation

This document describes the implementation of QuestCraft's enhanced prompt system and universal web search integration for the BYOLLM tier (user-provided API keys).

---

## Overview

This implementation provides:

1. **Model capability detection** - Automatic adaptation of prompts based on model capabilities
2. **Universal web search** - Works across all BYOLLM providers via Exa and DuckDuckGo APIs
3. **Pre-generation strategy** - Batch web searches upfront for faster game start
4. **Testing framework** - Automated testing and model evaluation
5. **Community tier constraints** - No web search (per requirements), clear user experience

---

## Architecture

### New Files Created

**Core Services:**
- `services/modelCapabilityDetector.ts` - Model capability registry and detection
- `services/promptManager.ts` - Adaptive prompt loading with fallback mechanisms
- `services/webSearchService.ts` - Universal web search abstraction (Exa + DuckDuckGo fallback)
- `services/statsService.ts` - Enhanced with web search tracking

**Testing Infrastructure:**
- `services/promptTester.ts` - Automated test suite runner
- `services/modelEvalService.ts` - Model evaluation and scoring
- `services/questPreGenerator.ts` - Batch pre-generation with progress tracking
- `tests/promptTestCases.ts` - Test case definitions

**Scripts:**
- `scripts/test-prompts.sh` - Shell script for running test suites
- `scripts/generate-test-report.js` - Test report generator

**Modified Files:**
- `types.ts` - Added web search interfaces
- `services/statsService.ts` - Added web search tracking methods
- `package.json` - Added test scripts

---

## Key Features

### 1. Model-Aware Prompts

**Capability Detection:**
```typescript
const capabilities = detectCapabilities('openai/gpt-4o');
// Returns: {
//   supportsJsonSchema: true,
//   supportsTools: true,
//   canDoWebSearch: true,
//   qualityTier: 'high',
//   supportsMultiLanguage: true
// }
```

**Adaptive Prompt Variants:**
- Removes JSON schema references for models that don't support them
- Adds tool instructions for models with capability
- Adds thinking instructions for models with `supportsThinking`
- Language constraint warnings for limited multilingual support

**Robust JSON Extraction:**
- Direct JSON.parse (fastest)
- Markdown code block extraction
- Bracket boundary extraction
- Fallback mechanisms for all failure modes

### 2. Universal Web Search (BYOLLM Only)

**Multi-Engine Support:**
```typescript
webSearchService.search(query, {
    engine: SearchEngine.EXA,      // $4/1000 results
    engine: SearchEngine.DUCKDUCKGO  // Free, no API key
    engine: SearchEngine.BRAVE       // Free, requires key
});
```

**Grounding Integration:**
```typescript
const prompt = webSearchService.generateGroundedPrompt(
    basePrompt,
    searchResults,  // Top 3 results
    2000            // Context limit
);

// Automatically injects search results into prompt
```

**Cost Tracking:**
```typescript
statsService.trackWebSearch(resultsCount, failed);
// Tracks: webSearchRequests, webSearchResults, webSearchFailures
```

### 3. Pre-Generation Strategy

**Batch Search Approach:**
```typescript
// All searches run in parallel (no user waiting)
const searchPromises = propertyLocations.map(loc => 
    webSearchService.search(query, { engine: 'exa' })
);
const searchResultsArray = await Promise.all(searchPromises);
```

**Progress Feedback:**
```
onProgress('Starting web searches...', 5);
onProgress('Generating scenarios...', 25);
onProgress('Pre-generation complete!', 100);
```

**Graceful Fallback:**
- If web search fails for a location, automatically retries without grounding
- Creates placeholder scenarios with clear user feedback
- Tracks failures for monitoring

### 4. Testing Framework

**Automated Test Suite:**
```bash
npm run test:prompts --models model1,model2,model3 --no-search
npm run test:prompts --models gpt-4o,gemini-2.5-pro --with-search
```

**Test Coverage:**
- Basic scenario structure
- JSON vs text output
- Single vs dual choice
- Multilingual support
- Hallucination detection
- Required field validation

**Scoring System:**
- Quality score (40% weight) - Pass rate
- Latency score (30% weight) - Response time
- Cost score (30% weight) - Token usage
- Overall score (0-100) - Combined metric

**Report Generation:**
- Summary statistics
- Model-by-model breakdown
- Best performing model recommendation
- Detailed test results with errors

---

## Model Capabilities Registry

| Model | Native Search | JSON Schema | Thinking | Max Context | Quality Tier |
|--------|--------------|-------------|-------------|--------------|
| OpenAI GPT-4o | ✅ | ✅ | ✅ | 128K | High |
| OpenAI GPT-4o-mini | ✅ | ✅ | ✅ | 128K | High |
| Google Gemini 2.5 Pro | ✅ | ✅ | ✅ | 1M+ | High |
| Google Gemini 2.5 Flash | ✅ | ✅ | ✅ | 1M+ | High |
| Perplexity PPLX 7B | ✅ | ❌ | ✅ | 128K | Medium |
| DeepSeek R1 | ❌ | ❌ | ✅ | 164K | Medium |
| Community gpt-oss-20b | ❌ | ❌ | ❌ | 131K | Medium |

---

## Web Search Implementation

### BYOLLM Tier (User-Provided Keys)

**Engines Available:**
1. **Exa** - $4 per 1,000 results (recommended for facts)
2. **DuckDuckGo** - Free, no API key (good fallback)
3. **Brave** - Free, requires API key (optional)

**Cost Structure:**
- Exa: ~$0.004 per result
- Average scenario (3 results × 2 locations): ~$0.024
- Full quest (20 locations): ~$0.16

**Search Result Format:**
```typescript
interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    publishedDate?: string;
    source: string;
}
```

### Community Tier (Free, No Web Search)

**Important:**
- `:online` variant is NOT used (per requirements)
- All scenarios generated in FICTIONAL mode only
- No web search costs incurred
- Clear user experience: No waiting for searches

**Alternative:**
- If user wants reality grounding, prompt to provide own API key (BYOLLM tier)

---

## Usage Examples

### For Developers

**Testing a new prompt:**
```typescript
const testCases = require('../tests/promptTestCases').scenarioGenerationTests;

const results = await promptTester.runTestSuite(
    'prompts/dynamic-scenario-grounded.txt',
    testCases,
    ['openai/gpt-4o', 'google/gemini-2.5-pro', 'perplexity/pplx-7b-online']
);
```

**Enabling web search for a quest:**
```typescript
// In Quest Maker Wizard or GamePage
const result = await questPreGenerator.preGenerateQuest(
    questConfig,
    languageCode,
    true  // Enable reality grounding
);
```

**Tracking web search costs:**
```typescript
const stats = statsService.getWebSearchStats();
console.log(`Web searches: ${stats.requests}`);
console.log(`Results retrieved: ${stats.results}`);
console.log(`Failures: ${stats.failures}`);
```

---

## Next Steps

1. **Integration** - Wire new services into existing aiService.ts for actual model calls
2. **UI Updates** - Add pre-generation step to Quest Maker Wizard
3. **Monitoring** - Add web search cost display to Settings/Status Bar
4. **CI/CD** - Set up automated testing pipeline
5. **Documentation** - Update AGENTS.md with new patterns

---

## Benefits

- **Better prompts**: Automatic adaptation to model capabilities
- **Higher success rate**: Robust JSON extraction with fallbacks
- **Reality grounding**: Universal web search works across all BYOLLM providers
- **Faster gameplay**: Pre-generates scenarios, no waiting
- **Cost transparency**: Clear tracking of web search vs AI tokens
- **Continuous improvement**: Automated testing catches regressions early