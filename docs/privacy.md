# Privacy & Data Safety

At QuestCraft, we are deeply committed to your privacy and the security of your data. This page explains what data the application handles, where it's stored, and how you can control it.

## Client-Side Architecture

The most important thing to understand about QuestCraft is that it is primarily a **client-side application**. This means:

-   **No Servers for Core Gameplay:** We do not operate any backend servers to run the game or store your data when you use your own API key. The application runs directly in your web browser.
-   **No Data Collection:** We do not collect, track, or store any of your personal information or gameplay data on our servers. What happens in your browser stays in your browser.

## QuestCraft Community Gateway

To provide a zero-setup experience, QuestCraft offers a "Community Gateway" AI provider. This is the only time the application communicates with a backend service operated by us.

-   **What it is:** The Community Gateway is a backend service that acts as a **stateless proxy**. Its only job is to receive your AI request, securely add a shared API key, and forward it to our third-party AI provider, [OpenRouter](https://openrouter.ai).
-   **Data Handling:** When you use the Community Tier, your prompts (e.g., game ideas, chat messages, scenario generation requests) are sent to our backend.
-   **Our Privacy Promise:** Our backend is **stateless**. We **do not log, store, or monitor** any of the content from your prompts or the AI's responses. The data passes through our service and is not retained in any way. For details on how OpenRouter handles the data it receives, please refer to their privacy policy.
-   **For Maximum Privacy:** If you prefer that your data is never sent through our backend, you can switch to any other provider in the **Settings** menu and provide your own personal API key. When you use your own key, all AI requests are sent **directly from your browser to the AI provider** (e.g., Google, OpenAI), completely bypassing our Community Gateway.

## Data Stored in Your Browser (`localStorage`)

To provide a seamless experience, QuestCraft uses your browser's `localStorage`. This is a standard web feature that allows websites to store data on your own computer. Here is a complete list of what we store:

1.  **Application Settings (`questcraft-app-settings`):**
    *   **What it is:** Your selected AI provider (e.g., Google Gemini), model name, and preferred language. Your API key is **not** stored here.
    *   **How it's used:** This configures the AI service and sets the display language for the application.

2.  **Game State (`questcraft-game-state`):**
    *   **What it is:** A complete snapshot of your current game in progress, including player data, positions, resources, and the current game phase.
    *   **How it's used:** This allows you to close or refresh your browser and seamlessly resume your game exactly where you left off.

3.  **Active Quest (`questcraft-active-quest`):**
    *   **What it is:** The full JSON configuration of the quest you are currently playing.
    *   **How it's used:** Ensures the correct quest is loaded when you resume a game.

4.  **Custom Quests (`questcraft-custom-quests`):**
    *   **What it is:** The full JSON configuration for any quests you create with the Quest Maker or load manually.
    *   **How it's used:** This allows you to save your creations and play them later without needing to generate them again or paste the JSON every time.

5.  **AI Audit Log (`questcraft-ai-audit-log`):**
    *   **What it is:** A log of all requests sent to the AI provider, including prompts, responses, and errors.
    *   **How it's used:** This provides transparency and helps you debug the AI's behavior.

6.  **Usage Statistics (`questcraft-usage-stats`):**
    *   **What it is:** An aggregated count of token usage, estimated cost, and time played.
    *   **How it's used:** This helps you keep track of your API usage.

## How to Control Your Data

You have complete control over the data stored in your browser.

-   **Viewing & Clearing Logs:** You can view the AI Audit Log from the **Settings** menu and clear all logs from there.
-   **Deleting Custom Quests:** You can manage and delete your saved custom quests from the **Settings** menu.
-   **Complete Reset:** The **"Reset Application & Clear All Data"** button in the **Settings** menu will completely wipe all of the above data from your browser's `localStorage`, returning the app to its default state.

Your privacy is paramount. By offering both a convenient Community Gateway and a direct-to-provider API key option, we aim to give you both a powerful tool and complete control over your information.