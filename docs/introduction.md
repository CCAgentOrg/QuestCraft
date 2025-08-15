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

-   **Create with AI:** Use the Quest Maker wizard to generate entire, playable board games from a simple text description of your idea.
-   **Generate Dynamic Scenarios:** Use Google Search grounding (with Gemini) or search-enabled models (via OpenRouter) to create challenges based on real-world, up-to-the-minute events.
-   **Play and Customize:** Load pre-made quests, play your AI-generated creations, or load any custom `quest.json` file from a URL or by pasting its content.
-   **Run Anywhere:** The app is completely serverless and runs in your browser. No backend, no databases, no complex setup.
-   **Stay in Control:** Your game state is saved locally, and an AI Audit Log provides full transparency into all AI interactions.
-   **Multi-language Support:** Generate and play quests in multiple languages, including English, Spanish, Hindi, and Tamil.

## Getting Started & Configuration

QuestCraft is designed for ease of use. To run it and use its AI features, you need to configure one essential environment variable.

### Environment Variables

Before running the application, you must provide your AI provider's API key. QuestCraft is configured using a `.env` file in the project's root directory.

1.  **Create a `.env` file:** Copy the provided `.env.sample` file to a new file named `.env`.
2.  **Set your API Key:** In the `.env` file, set the `API_KEY` variable.

```
# .env file
API_KEY="YOUR_AI_PROVIDER_API_KEY_HERE"
```

The application is built to read this key directly from the environment; it will **never** ask you to enter it in the UI.

Additionally, you can configure the following optional variable:

-   `MAKER_MODE_DISABLED`: Set this to `true` to hide the "Quest Maker" and related features. This is useful if you want to deploy a version of QuestCraft for players only, without the game creation tools. By default, this is `false`.

### AI Provider Setup

Once your `API_KEY` is set, you can select which AI service you want to use from the **Settings** menu within the application. For detailed instructions, please see the [Quest Maker Guide](./maker-guide).
