#!/bin/bash
# Automated prompt testing script

echo "🧪 Starting Prompt Testing Suite..."

# Test with community tier models (no web search expected)
echo "Testing community tier models..."
npm run test:prompts --models openai/gpt-oss-20b:free,xiaomi/mimo-v2-flash:free,meta-llama/llama-3.3-70b-instruct:free --no-search

# Test with BYOLLM models (with web search)
echo "Testing BYOLLM models with web search..."
npm run test:prompts --models openai/gpt-4o,google/gemini-2.5-pro,perplexity/pplx-7b-online --with-search

# Generate report
echo "Generating test report..."
node scripts/generate-test-report.js

echo "✅ Prompt testing complete!"