# Quest Maker Guide

Welcome, Quest Maker! This guide will walk you through creating your very own interactive board game using the QuestCraft engine. You can either use our AI-powered wizard or create a game manually.

## Method 1: The Quest Maker Wizard (Recommended)

The Quest Maker is an AI-powered, step-by-step tool that builds the entire game for you based on your ideas. It's the fastest and easiest way to bring your concepts to life.

### Prerequisite: Configure Your AI Provider
QuestCraft works out of the box using the **QuestCraft Community (Free Tier)**, which requires no setup or API key.

For advanced users who want to use specific models or their own private keys, QuestCraft is also compatible with Google Gemini and any service that offers an OpenAI-compatible API (like OpenAI, Groq, OpenRouter, Together AI, etc.).

**Important: Set Your API Key (Advanced)**

If you choose to use your own provider, you must provide an API key. This key **must** be provided through an `API_KEY` environment variable. The application is designed to read this variable securely and will never ask you to input it in the user interface. For more details on setting this up, please see the "Getting Started & Configuration" section in the [Introduction](./introduction).

**To configure your provider in the app:**

1.  Open the main navigation menu by clicking the hamburger icon (☰) in the top-left corner.
2.  Select **Settings** from the menu.
3.  In the "AI Configuration" section, select your desired provider from the dropdown menu. The "Community Tier" is the default.
4.  If you select a different provider, the **Model Name** will be pre-filled with a recommended model, but you can change it to any compatible model you prefer (e.g., `gemini-2.5-flash` for Gemini, or `gpt-4o` for OpenAI).
5.  If you are using an OpenAI-compatible provider other than OpenAI itself (like OpenRouter or Groq), you must also ensure the correct **Base URL** for that service's API is entered.
6.  Click **"Save AI Settings"**.

#### A Note on Internationalization (i18n) and Model Selection
QuestCraft supports generating content in multiple languages (English, Spanish, Hindi, and Tamil). The quality of the generated content heavily depends on the AI model you select.

- **For High-Quality Multilingual Content:** We recommend using powerful models known for strong multilingual capabilities. If you are creating quests in a language other than English, selecting a capable model is crucial for good results.
- **Recommended Models:**
  - **Google Gemini:** `gemini-2.5-flash` is an excellent choice for multilingual tasks.
  - **OpenAI-compatible:** Models like `gpt-4o` or `gpt-4-turbo` generally provide high-quality translations and thematic content.
- **Considerations:** The free **Community Tier** uses a powerful open-source model but may not have the same multilingual fluency as top-tier proprietary models.

#### Configuring the "Ground in Reality" Feature

The **"Ground in Reality"** feature generates dynamic scenarios based on real-world events using web search. This powerful feature is now supported across multiple providers:

*   **For Google Gemini:** This feature is enabled by default and uses Google's built-in search capabilities.
*   **For OpenRouter:** You can use this feature by selecting a model that has web search capabilities. When you select 'OpenRouter' in the settings, a model dropdown will appear. Choose a model like `perplexity/llama-3-sonar-large-32k-online` to enable grounding.
*   **QuestCraft Community Tier:** This feature is **disabled** when using the free Community Tier to ensure a consistent and cost-free experience. The AI will generate fictional scenarios instead.
*   **For other providers:** If the model you select has built-in web search, it may work, but it is not officially guaranteed.

Now you're ready to create!

### Step-by-Step Guide
1.  **Launch the Wizard:** Navigate to the Quest Maker page. You can do this from the main navigation menu (☰ -> Quest Maker) or by clicking **"🚀 Create a New Quest"** on the home screen.
2.  **Describe Your Idea:** In the text box, describe the game you want to create. The more detail you provide, the better the AI's result will be.
    > **Example Idea:**
    > "A game about the challenges of being a freelance artist. Players must balance three resources: **Money** from clients, personal **Well-being** to avoid burnout, and technical **Skills** to stay relevant in the industry."
3.  **Check "Ground in Reality" (Optional):** If you want your quest's scenarios to be based on real-world events, check the box. Make sure you have configured a compatible provider (e.g., Gemini or a search-enabled OpenRouter model) in the settings.
4.  **Generate the Outline:** Click the **"Generate Outline"** button. The AI will process your idea and generate a complete quest configuration, including resources, board spaces, and cards.
5.  **Review and Refine:** The wizard will guide you through several screens where you can review and edit every aspect of the AI-generated quest.
6.  **Finish and Play:** On the final screen, your quest is ready! You can:
    -   **Download quest.json:** Save the generated file to your computer for later use or sharing.
    -   **Load & Play:** Immediately load the quest into the game engine and start playing.

## Method 2: Manual JSON Creation (Advanced)

For ultimate control, you can create or edit a `quest.json` file manually.
1.  **Get a Template:** The easiest way to start is by downloading the JSON from a pre-made quest or one generated by the wizard.
2.  **Edit the File:** Use the [Quest JSON Schema Guide](./quest-schema) as a reference to modify the file in any text editor.
3.  **Load the Quest:** On the main screen, find the "Load from JSON" section, paste your entire JSON content into the text area, and click **"Load Custom Quest"**.
    
## Monitoring AI Interactions

All requests made by the Quest Maker to your configured AI provider are recorded in the **AI Audit Log**. You can access this log in two ways:
1.  Navigate to the **Settings** page and click "View AI Audit Log".
2.  Click the **AI Audit Log** button in the status bar at the bottom of the screen.

The log is useful for reviewing prompts and responses, which helps in debugging and understanding the AI's behavior.