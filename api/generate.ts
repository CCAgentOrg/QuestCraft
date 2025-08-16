import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import type { Stream } from 'openai/streaming';

export const config = {
  runtime: 'edge',
};

// --- Custom stream helpers to replace removed 'ai' package exports ---

/**
 * A re-implementation of the Vercel AI SDK's OpenAIStream to convert the
 * OpenAI SDK's response stream into a format suitable for StreamingTextResponse.
 * @param res The stream from the OpenAI API response.
 * @returns A ReadableStream of Uint8Array encoded text chunks.
 */
function OpenAIStream(res: Stream<OpenAI.Chat.Completions.ChatCompletionChunk>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of res) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          controller.enqueue(encoder.encode(text));
        }
      }
      controller.close();
    },
  });
}

/**
 * A re-implementation of the Vercel AI SDK's StreamingTextResponse to create a
 * streaming Response object with appropriate headers for text streaming.
 */
class StreamingTextResponse extends Response {
  constructor(stream: ReadableStream, init?: ResponseInit) {
    super(stream, {
      ...init,
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ...init?.headers,
      },
    });
  }
}


// --- Model Configuration ---
const COMMUNITY_MODEL = 'openai/gpt-oss-20b:free';

// --- Helper to load prompts from the /prompts directory ---
async function loadPrompt(fileName: string, replacements: Record<string, any> = {}): Promise<string> {
  // Edge functions can't access filesystem directly, so we use a different approach
  // In Vercel, top-level directories are available relative to the running function.
  try {
    const filePath = path.join('prompts', fileName);
    let template = await fs.readFile(filePath, 'utf-8');
    return Object.entries(replacements).reduce((prompt, [key, value]) => {
        return prompt.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }, template);
  } catch (error) {
     console.error(`Error loading prompt: ${fileName}`, error);
     // Fallback if file loading fails in edge environment for any reason
     return `Error: Could not load prompt template ${fileName}. Please check server logs.`;
  }
}

const getOpenAIClient = () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENROUTER_API_KEY environment variable.");
    }
    return new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://questcraft.ai",
        "X-Title": "QuestCraft",
      }
    });
};

const LANGUAGE_MAP: Record<string, string> = {
    en: "English",
    es: "Spanish",
    hi: "Hindi",
    ta: "Tamil"
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { action, payload } = await req.json();
    const openai = getOpenAIClient();

    switch (action) {
      case 'testConnection':
        await openai.chat.completions.create({
          model: COMMUNITY_MODEL,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
        });
        return new Response('Connection successful', { status: 200 });

      case 'enhanceQuestIdea': {
        const prompt = await loadPrompt('enhance-idea.txt', { idea: payload.idea });
        const response = await openai.chat.completions.create({
          model: COMMUNITY_MODEL,
          messages: [{ role: 'user', content: prompt }],
        });
        const result = response.choices[0].message.content;
        const usage = { inputTokens: response.usage?.prompt_tokens, outputTokens: response.usage?.completion_tokens };
        return new Response(JSON.stringify({ result, usage }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'generateQuestOutline': {
        const { idea, numLocations, positivity, groundingInReality, supportedLanguages, languageCode } = payload;
        const languageName = LANGUAGE_MAP[languageCode] || 'English';
        const languageList = (supportedLanguages.length > 0 ? supportedLanguages : ['en'])
          .map((code: string) => `${LANGUAGE_MAP[code]} ('${code}')`).join(', ');

        const prompt = `Generate a quest based on this idea: "${idea}"`;
        const systemPrompt = await loadPrompt('quest-outline-system-openai.txt', {
             numLocations, positivity, 
             // "Ground in Reality" is disabled for community tier
             groundingInReality: false, 
             languageCode, languageName, languageList, schema: "{}"
        });

        const response = await openai.chat.completions.create({
          model: COMMUNITY_MODEL,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        });

        const result = JSON.parse(response.choices[0].message.content || '{}');
        const usage = { inputTokens: response.usage?.prompt_tokens, outputTokens: response.usage?.completion_tokens };
        return new Response(JSON.stringify({ result, usage }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'generatePregeneratedScenarios':
      case 'generateDynamicScenario': {
        const { questConfig, location, numScenarios, languageCode } = payload;
        const isDynamic = action === 'generateDynamicScenario';
        
        // IMPORTANT: "Ground in Reality" feature is disabled for the free community tier.
        // We force the generation to be fictional.
        const isGrounded = false; 

        const languageName = LANGUAGE_MAP[languageCode] || 'English';
        const resourceNames = questConfig.resources.map((r: any) => r.name.en.toLowerCase()).join(', ');
        const languageList = (questConfig.supportedLanguages || ['en'])
            .map((code: string) => `${LANGUAGE_MAP[code]} ('${code}')`).join(', ');

        const replacements = {
            questDescription: questConfig.description.en,
            locationName: location.name.en,
            locationDescription: location.description.en,
            resourceNames,
            numScenarios: isDynamic ? 1 : numScenarios,
            languageCode, languageName, languageList, schema: "{}"
        };

        const promptFile = 'pregenerated-scenarios-fictional-openai.txt';
        
        const systemPrompt = await loadPrompt(promptFile, replacements);

        const response = await openai.chat.completions.create({
          model: COMMUNITY_MODEL,
          messages: [{ role: 'system', content: systemPrompt }],
          response_format: { type: 'json_object' },
        });

        let result = JSON.parse(response.choices[0].message.content || '{}');
        if (isDynamic) {
            result = result.scenarios ? result.scenarios[0] : {};
        }
        
        const usage = { inputTokens: response.usage?.prompt_tokens, outputTokens: response.usage?.completion_tokens };
        return new Response(JSON.stringify({ result, usage }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      case 'chat': {
          const { message, history, systemInstruction } = payload;
          const messages = [
              { role: 'system', content: systemInstruction },
              ...history,
              { role: 'user', content: message }
          ];
          
          const response = await openai.chat.completions.create({
              model: COMMUNITY_MODEL,
              stream: true,
              messages: messages as any,
          });

          const stream = OpenAIStream(response);
          return new StreamingTextResponse(stream);
      }

      default:
        return new Response(`Unknown action: ${action}`, { status: 400 });
    }
  } catch (error: any) {
    console.error(error);
    return new Response(error.message || 'An unexpected error occurred.', {
      status: 500,
    });
  }
}