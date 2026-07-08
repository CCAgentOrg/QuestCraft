// @ts-nocheck
// services/modelEvalService.ts
// Model evaluation framework for optimizing prompt selection

import { logger } from './logger';

export interface EvalConfig {
    tasks: string[];
    models: string[];
    metrics: ['latency' | 'quality' | 'hallucination_rate' | 'cost_per_result'];
}

export interface EvalResult {
    model: string;
    task: string;
    score: number;
    metrics: Record<string, number>;
}

export const modelEvalService = {
    // Run evaluation on community tier models
    evaluateFreeModels: async (config: EvalConfig): Promise<EvalResult[]> => {
        const results: EvalResult[] = [];
        
        for (const task of config.tasks) {
            logger.info(`[ModelEval] Evaluating task: ${task}`);
            
            for (const model of config.models) {
                // Call promptTester for this model + task
                const testResults = await promptTester.runTestSuite(
                    task,
                    [this.getTestCaseForTask(task)],
                    [model]
                );
                
                // Calculate score (0-100)
                const score = this.calculateScore(testResults);
                results.push({
                    model,
                    task,
                    score,
                    metrics: {
                        latency: testResults[0]?.latencyMs || 0,
                        quality: testResults[0]?.passed ? 1 : 0,
                        hallucination_rate: testResults.some(r => 
                            r.error?.includes('hallucination')
                        ) ? 1 : 0,
                        cost_per_result: this.estimateCost(model, testResults)
                    }
                });
            }
        }
        
        return results;
    },

    calculateScore: (testResults: TestResult[]): number => {
        // Weighted scoring: quality (40%), latency (30%), cost (30%)
        const passRate = testResults.filter(r => r.passed).length / testResults.length;
        const avgLatency = testResults.reduce((sum, r) => 
            sum + (r.latencyMs || 0), 0
        ) / testResults.length;
        const avgCost = testResults.reduce((sum, r) => 
            sum + (r.tokensUsed || 0) * 0.0001, // $0.10 per 1M tokens
            0
        ) / testResults.length;
        
        // Normalize scores (0-100 each category)
        const qualityScore = passRate * 40;
        const latencyScore = Math.max(0, 100 - (avgLatency / 100)) * 30; // Lower is better
        const costScore = Math.max(0, 100 - (avgCost / 0.01)) * 30; // Lower is better
        
        return Math.round(qualityScore + latencyScore + costScore);
    },

    estimateCost: (model: string, testResults: TestResult[]): number => {
        // Free models cost $0/M
        if (model.includes(':free')) {
            return 0;
        }
        // BYOLLM costs vary by provider
        // This would need to be configured per provider
        return 0.001; // Placeholder for paid models
    },

    getTestCaseForTask: (task: string): TestCase => {
        // Return appropriate test case for task type
        const testCases = require('../tests/promptTestCases');
        return testCases.find(t => t.name === task) || testCases[0];
    }
};