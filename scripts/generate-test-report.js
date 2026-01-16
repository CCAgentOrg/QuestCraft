// scripts/generate-test-report.js
// Generate test reports from prompt testing results

const fs = require('fs');
const path = require('path');

// Look for test results in common locations
const testResultsPath = path.join(__dirname, '../test-results.json');

console.log('Looking for test results...');

let results = [];

try {
    if (fs.existsSync(testResultsPath)) {
        const data = fs.readFileSync(testResultsPath, 'utf8');
        results = JSON.parse(data);
        console.log(`Found ${results.length} test results`);
    } else {
        console.log('No test results found - using empty array');
        results = [];
    }
} catch (error) {
    console.error('Error reading test results:', error);
    process.exit(1);
}

if (results.length === 0) {
    console.log('\n📊 No test data available');
    process.exit(0);
}

// Generate report
const report = generateReport(results);
console.log('\n' + '='.repeat(50));
console.log('📊 PROMPT TESTING REPORT');
console.log('='.repeat(50));
console.log(report);
console.log('='.repeat(50));

// Save report
const reportPath = path.join(__dirname, 'test-report.txt');
fs.writeFileSync(reportPath, report, 'utf8');
console.log(`\n✅ Report saved to: ${reportPath}`);

function generateReport(results) {
    const models = [...new Set(results.map(r => r.model))];
    
    let report = `\nDate: ${new Date().toISOString()}\n\n`;
    
    // Summary section
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const overallPassRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;
    
    report += '📊 SUMMARY\n';
    report += `  Total Tests: ${totalTests}\n`;
    report += `  Passed: ${passedTests} (${overallPassRate}%)\n`;
    report += `  Failed: ${totalTests - passedTests}\n\n`;
    
    // Best model
    const modelStats = calculateModelStats(results, models);
    const bestModel = Object.entries(modelStats)
        .sort((a, b) => b[1].score - a[1].score)[0]?.[0];
    
    if (bestModel) {
        report += `  🏆 Best Model: ${bestModel}\n`;
        report += `     Overall Score: ${modelStats[bestModel]?.score}\n`;
        report += `     Pass Rate: ${modelStats[bestModel]?.passRate}%\n\n`;
    }
    
    // Model-by-model breakdown
    report += '📈 MODEL PERFORMANCE\n';
    report += '\n';
    
    for (const model of models) {
        const modelResults = results.filter(r => r.model === model);
        
        report += `${model}\n`;
        report += `  Tests: ${modelResults.length}\n`;
        report += `  Passed: ${modelResults.filter(r => r.passed).length}\n`;
        report += `  Pass Rate: ${(modelResults.filter(r => r.passed).length / modelResults.length * 100).toFixed(1)}%\n`;
        report += `  Avg Latency: ${formatLatency(calculateAvgLatency(modelResults))}\n`;
        report += `  Avg Cost per Test: ${formatCost(calculateAvgCost(modelResults))}\n`;
        report += `  Overall Score: ${modelStats[model]?.score}\n`;
        report += '\n';
    }
    
    // Detailed test results
    report += '📝 DETAILED RESULTS\n';
    report += '\n';
    
    for (const result of results) {
        report += `[${result.testCase}] ${result.model}\n`;
        if (result.passed) {
            report += `  ✅ PASSED (${result.latencyMs}ms)\n`;
        } else {
            report += `  ❌ FAILED\n`;
            report += `     Error: ${result.error}\n`;
            if (result.latencyMs > 0) {
                report += `     Latency: ${result.latencyMs}ms\n`;
            }
        }
    }
    
    return report;
}

function calculateModelStats(results, models) {
    const stats = {};
    
    for (const model of models) {
        const modelResults = results.filter(r => r.model === model);
        
        if (modelResults.length === 0) {
            stats[model] = {
                score: 0,
                passRate: 0,
                avgLatency: Infinity
            };
            continue;
        }
        
        const passRate = modelResults.filter(r => r.passed).length / modelResults.length;
        const avgLatency = calculateAvgLatency(modelResults);
        const avgCost = calculateAvgCost(modelResults);
        const score = calculateScore(passRate, avgLatency, avgCost);
        
        stats[model] = {
            score,
            passRate,
            avgLatency,
            avgCost
        };
    }
    
    return stats;
}

function calculateAvgLatency(results) {
    if (results.length === 0) return 0;
    
    const sum = results.reduce((acc, r) => acc + (r.latencyMs || 0), 0);
    return (sum / results.length).toFixed(0);
}

function calculateAvgCost(results) {
    if (results.length === 0) return 0;
    
    const sum = results.reduce((acc, r) => acc + (r.tokensUsed || 0), 0);
    return ((sum / results.length) * 0.0001).toFixed(4); // $0.10 per 1M tokens
}

function calculateScore(passRate, avgLatency, avgCost) {
    // Weighted scoring: quality (40%), latency (30%), cost (30%)
    const qualityScore = passRate * 40;
    const latencyScore = Math.max(0, 100 - (avgLatency / 100)) * 30;
    const costScore = Math.max(0, 100 - (avgCost / 0.01)) * 30;
    
    return Math.round(qualityScore + latencyScore + costScore);
}

function formatLatency(ms) {
    if (!ms || ms === 0) return 'N/A';
    return `${ms}ms`;
}

function formatCost(cost) {
    if (cost === 0) return '$0.0000';
    return `$${cost.toFixed(4)}`;
}