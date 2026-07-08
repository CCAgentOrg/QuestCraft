// @ts-nocheck
// services/promptTester.ts
// Automated prompt testing framework

import { promptManager } from './promptManager';
import { detectCapabilities } from './modelCapabilityDetector';
import { logger } from './logger';

export interface TestCase {
    name: string;
    input: Record<string, any>;
    expectedSchema?: any;
    validators: {
        hasRequiredFields?: string[];
        minLanguageCount?: number;
        notContainsHallucinations?: boolean;
    };
}

export interface TestResult {
    testCase: string;
    model: string;
    passed: boolean;
    latencyMs: number;
    output: string;
    extractedData?: any;
    error?: string;
    tokensUsed?: number;
}

export interface TestReport {
    testDate: string;
    models: string[];
    summary: {
        totalTests: number;
        overallPassRate: number;
        bestPerformingModel?: string;
    };
    results: TestResult[];
}

export const promptTester = {
    // Automated test suite runner
    runTestSuite: async (
        promptTemplate: string,
        testCases: TestCase[],
        models: string[]
    ): Promise<TestReport> => {
        const results: TestResult[] = [];
        
        for (const model of models) {
            const capabilities = detectCapabilities(model);
            
            logger.info(`[PromptTester] Testing model: ${model}`);
            
            for (const testCase of testCases) {
                const adaptedPrompt = await promptManager.loadAndAdapt({
                    templateName: promptTemplate,
                    replacements: testCase.input,
                    capabilities,
                    requireJsonOutput: capabilities.requiresJsonOnly
                });
                
                const startTime = Date.now();
                let testResult: TestResult;
                
                try {
                    // Call model (abstract interface, implemented per provider)
                    const modelOutput = await this.callModel(model, adaptedPrompt);
                    const latency = Date.now() - startTime;
                    
                    // Validate output
                    testResult = this.validateOutput(
                        modelOutput,
                        testCase,
                        capabilities,
                        latency
                    );
                } catch (error: any) {
                    testResult = {
                        testCase: testCase.name,
                        model,
                        passed: false,
                        latencyMs: 0,
                        output: '',
                        error: error.message
                    };
                }
                
                results.push(testResult);
            }
        }
        
        return this.generateSummary(results);
    },

    // Output validation
    validateOutput: (
        output: string,
        testCase: TestCase,
        capabilities: ModelCapabilities,
        latency: number
    ): TestResult => {
        const result: any = {
            testCase: testCase.name,
            model, // Set by caller
            passed: true,
            latencyMs: latency,
            output,
            error: undefined
        };
        
        // JSON validation
        if (testCase.expectedSchema && capabilities.supportsJsonSchema) {
            const parseResult = promptManager.extractJson(output, capabilities);
            if (!parseResult.isValid) {
                return { ...result, passed: false, error: parseResult.error };
            }
            result.extractedData = parseResult.data;
        }
        
        // Field validation
        if (testCase.validators?.hasRequiredFields) {
            for (const field of testCase.validators.hasRequiredFields) {
                if (!output.includes(field)) {
                    return { ...result, passed: false, error: `Missing required field: ${field}` };
                }
            }
        }
        
        // Language count validation
        if (testCase.validators?.minLanguageCount) {
            const langPattern = /"en":|"es":|"hi":|"ta":/g;
            const matchCount = (output.match(langPattern) || []).length;
            if (matchCount < testCase.validators.minLanguageCount) {
                return { ...result, passed: false, error: `Expected ${testCase.validators.minLanguageCount} languages, found ${matchCount}` };
            }
        }
        
        // Hallucination check (basic)
        if (testCase.validators?.notContainsHallucinations) {
            const badPatterns = [
                /sourceUrl:\s*"https?:\/\/fake-url\.com/,
                /sourceUrl:\s*"example\.com/,
                /description:\s*"Lorem ipsum/i
            ];
            for (const pattern of badPatterns) {
                if (pattern.test(output)) {
                    return { ...result, passed: false, error: 'Detected hallucination' };
                }
            }
        }
        
        return result;
    },

    generateSummary: (results: TestResult[]): TestReport => {
        const models = [...new Set(results.map(r => r.model))];
        const totalTests = results.length;
        const passedTests = results.filter(r => r.passed).length;
        
        // Find best performing model
        const modelStats: Record<string, { passRate: number; avgLatency: number }> = {};
        for (const model of models) {
            const modelResults = results.filter(r => r.model === model);
            modelStats[model] = {
                passRate: modelResults.length > 0 
                    ? (modelResults.filter(r => r.passed).length / modelResults.length) 
                    : 0,
                avgLatency: modelResults.length > 0
                    ? modelResults.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / modelResults.length
                    : 0
            };
        }
        
        const bestModel = Object.entries(modelStats)
            .sort((a, b) => b[1].passRate - a[1].passRate || b[1].avgLatency - a[1].avgLatency)
            .slice(0, 1)[0]?.[0];
        
        return {
            testDate: new Date().toISOString(),
            models,
            summary: {
                totalTests,
                overallPassRate: passedTests / totalTests,
                bestPerformingModel: bestModel
            },
            results
        };
    },

    // Model calling interface (to be implemented per provider)
    callModel: async (model: string, prompt: string): Promise<{ output: string; tokens?: number }> => {
        // This is abstract - implemented in aiService.ts for each provider
        throw new Error('callModel must be implemented by provider service');
    }
};