# Welcome to QuestCraft!

QuestCraft is an interactive board game engine powered by generative AI. It transforms educational topics, training materials, or any creative idea into a playable, Monopoly-style board game that runs entirely in your browser. Our goal is to make learning and content creation more engaging and hands-on through the power of play and generative AI.

The application is structured into logical pages for a seamless user experience, including a home screen, a game area, a dedicated Quest Maker, and settings. It features a fully responsive design that adapts beautifully to both desktop and mobile devices, with a convenient tab-based interface for gameplay on smaller screens. Best of all, your game progress is automatically saved to your browser, so you can leave and come back to your quest at any time.

## The Problem We Solve

Traditional learning methods often fall short when teaching complex, decision-driven skills.
-   **Static Content:** Slideshows and documents are passive and can't simulate real-world consequences.
-   **High Barrier to Entry:** Creating interactive tutorials usually requires custom code, backend servers, and significant development time.
-   **Lack of Engagement:** Learners can quickly become disengaged with non-interactive content.

QuestCraft tackles these challenges by providing a zero-setup, highly engaging platform for scenario-based learning.

## Key Features

-   **Zero-Friction Start:** Jump right in with the **QuestCraft Community Tier**. It's a free, built-in AI provider that works out of the box with no API key required, powered by leading open-source models.
-   **Create with AI:** Use the Quest Maker wizard to generate entire, playable board games from a simple text description of your idea.
-   **Generate Dynamic Scenarios:** Use Google Search grounding (with Gemini) or search-enabled models (via OpenRouter) to create challenges based on real-world, up-to-the-minute events.
-   **Play and Customize:** Load pre-made quests, play your AI-generated creations, or load any custom `quest.json` file from a URL or by pasting its content.
-   **Run Anywhere:** The app is completely serverless and runs in your browser. No backend, no databases, no complex setup.
-   **Stay in Control:** Your game state is saved locally, and an AI Audit Log provides full transparency into all AI interactions.
-   **Multi-language Support:** Generate and play quests in multiple languages, including English, Spanish, Hindi, and Tamil.

## Getting Started & Configuration

QuestCraft is designed for ease of use. By default, it uses the **QuestCraft Community Tier**, which requires no setup. For advanced users who wish to use their own AI models and API keys, configuration is managed through environment variables.

### Environment Variables

For advanced users, all application configuration is managed through a `.env` file in the project's root directory.

1.  **Create a `.env` file:** In the root of the project, find the `.env.sample` file. Make a copy of this file and rename it to `.env`.
2.  **Configure your variables:** Open the new `.env` file and set the values as needed. All available options are documented with comments in the `.env.sample` file.

#### Essential Configuration (Advanced): API Keys

By default, you do not need an API key. If you want to use your own private models, you need an API key. This key **must** be provided through an environment variable; the application will **never** ask you to enter it in the UI for security reasons.

You can provide a generic key:
```
# .env
# This key will be used for any AI provider selected in the settings.
API_KEY="YOUR_GENERIC_AI_PROVIDER_API_KEY_HERE"
```

Or, you can provide provider-specific keys, which is recommended. A specific key will always be used over the generic `API_KEY` if it's available for the selected provider.

```
# .env
# Example: Using different keys for different services
GEMINI_API_KEY="your_google_gemini_api_key"
OPENAI_API_KEY="your_openai_api_key"
OPENROUTER_API_KEY="your_openrouter_api_key"
GROQ_API_KEY="your_groq_api_key"
TOGETHER_API_KEY="your_together_api_key"
```

#### Other Configuration Options

The `.env.sample` file documents other useful variables for controlling application behavior and debugging, including:

-   `MAKER_MODE_DISABLED`: To deploy a "player-only" version of the app.
-   `TOKEN_LIMIT`: To set a usage limit for a shared API key in a public demo.
-   `DEV_MODE` & `DEBUG_LEVEL`: To enable detailed console logging for development and troubleshooting.

### AI Provider Setup

By default, the app uses the **QuestCraft Community Tier**. If you have set up your own API key in the `.env` file, you can select a different AI service from the **Settings** menu. For detailed instructions, please see the [Quest Maker Guide](./maker-guide).