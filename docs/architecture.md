# QuestCraft: Architecture & Design

This document outlines the architectural decisions, design patterns, and core principles behind the QuestCraft application.

## 1. Core Philosophy

-   **Configuration Over Code:** The entire game experience should be defined in a declarative JSON file (`quest.json`). This separates the game *content* from the game *engine*, making it easy for non-developers to create quests.
-   **AI-Powered Creation:** Radically simplify the content creation process by leveraging the power of generative AI models like Google's Gemini and those compatible with the OpenAI API. This lowers the barrier to entry for creating rich, educational games.
-   **Zero-Setup & Serverless:** The application must run entirely in the browser and be hostable on any static file server. This ensures maximum portability and ease of use.

## 2. High-Level Architecture

QuestCraft is a **client-side Single-Page Application (SPA)** built with modern web technologies.

-   **Framework:** **React** with **TypeScript** for a robust and scalable component-based UI.
-   **Dependencies:** Uses an `importmap` in `index.html` to load libraries like React and `@google/genai` directly from a CDN (esm.sh). OpenAI-compatible API calls are made using the native `fetch` API.
-   **Styling:** **Tailwind CSS** is used for utility-first styling, loaded via its CDN script for simplicity.

### Configuration

The application is configured through two primary mechanisms:

-   **Environment Variables:** Critical settings like the `API_KEY` for AI services and the `MAKER_MODE_DISABLED` flag are managed via environment variables (typically in a `.env` file). This keeps sensitive keys out of the codebase and allows for different deployment configurations.
-   **`localStorage`:** User-specific settings, such as the chosen AI provider and model, are stored in the browser's `localStorage` via the `settingsService`. This provides persistence for user preferences across sessions.

### Data Flow

The application follows a simple, unidirectional data flow:

**Creation Flow:**
`User Idea` -> `QuestMakerPage.tsx` -> `aiService.ts` -> **Generative AI API (Gemini, OpenRouter, etc.)** -> `quest.json` (as state)

**Gameplay Flow:**
`quest.json` (loaded into `App.tsx`) -> `GamePage.tsx` -> User Interaction -> State Update in `GamePage.tsx` -> `gameStateService.ts` -> `localStorage`

## 3. Key Components & Services

-   **`App.tsx`**: The root component that acts as the application's **main router and layout manager**. It controls which page (`Welcome`, `Game`, `Maker`, `Docs`, `Settings`) is currently displayed. It also handles the persistence of the active quest configuration and navigation state to `localStorage`, and manages global UI elements like the header, hamburger menu, and drawers.

-   **`GamePage.tsx`**: A self-contained component that manages the entire lifecycle of an active game. It initializes players, handles the game loop (dice rolls, player movement, actions), and manages all game-related state. It uses the `gameStateService` to persist progress. A key feature is its **responsive design**, which switches from a three-column desktop layout to a touch-friendly tabbed interface on mobile devices.

-   **`services/aiService.ts`**: This service is the central hub for all AI interactions. It is responsible for:
    -   Reading the user's provider settings (Gemini, OpenRouter, etc.) from `settingsService`.
    -   Selecting the correct API implementation (the native `@google/genai` SDK for Gemini, or a `fetch`-based client for OpenAI-compatible APIs).
    -   Preparing the prompts and request bodies appropriate for the selected provider.
    -   Normalizing the response from different APIs into a consistent format for the application.
    -   Implementing robust retry logic with exponential backoff to handle rate limits and transient network errors.
    -   Integrating with the `auditLogService` to log every request and response.
    -   **Grounding in Reality:** This feature is now provider-agnostic. The service checks if the quest is "grounded" and selects the appropriate prompt.
        -   For **Gemini**, it uses a prompt that invokes the **built-in Google Search tool**.
        -   For **OpenAI-compatible providers (like OpenRouter)**, it sends a prompt instructing the model to use its **own web search capabilities**. This relies on the user having selected a search-enabled model (e.g., `perplexity/llama-3-sonar-large-32k-online`) in the settings.
        
-   **`services/gameStateService.ts`**: A dedicated service for persisting the active game state to `localStorage`. This allows players to refresh the page or navigate away and resume their game exactly where they left off. It handles saving, loading, and clearing the game state.

-   **`services/i18n.ts`**: Manages internationalization for the application. It loads translation files (`.json`) for different languages and provides a `useTranslation` hook for components to access localized strings.

-   **`services/settingsService.ts`**: A service to manage application settings, primarily the user's selected AI provider, API keys, and models. It uses `localStorage` for persistence.

-   **`services/auditLogService.ts`**: A simple service that handles reading from and writing to `localStorage`. It provides a centralized way to manage the AI interaction logs, including adding new entries and clearing the log.

-   **`prompts/`**: This directory contains plain text files for all the major prompts sent to the AI providers.
    -   **Why?** Externalizing prompts from the code allows developers to easily customize and tune the AI's behavior, tone, and instructions without needing to modify the application's logic. This is a key part of making the engine adaptable.
    -   The `aiService` loads these files at runtime and injects dynamic values (like quest themes or location names) before sending them to the API.
    -   Separate files exist for different providers and features (e.g., `...-grounded-openai.txt`) to account for differences in how APIs handle instructions and tool use.

-   **`components/`**: The directory contains all the React components.
    -   **Structural Components**: `Header.tsx` provides the top navigation bar, while `HamburgerMenu.tsx` provides the main slide-in navigation panel, creating a consistent experience across all pages.
    -   **Page Components**: `WelcomeScreen.tsx`, `GamePage.tsx`, `QuestMakerPage.tsx`, `DocsPage.tsx`, and `SettingsPage.tsx` represent the main sections of the application.
    -   **Game Components**: `GameBoard.tsx`, `PlayerDashboard.tsx`, and `ActionPanel.tsx` are the core UI elements within `GamePage.tsx`.
    -   **Utility Components**: `Drawer.tsx`, `AIAuditLogDrawer.tsx`, and `StatusBar.tsx` provide global UI functionality.

## 4. State Management & Persistence

The application uses a mix of local component state (via `React.useState`) and `localStorage` for persistence.

-   **Component State:** UI state (like open menus or form inputs) and active game state are managed within their respective components (`App.tsx`, `GamePage.tsx`).
-   **State Persistence:** To ensure a seamless user experience, key data is saved to the browser's `localStorage`:
    -   **Game State:** The `gameStateService` saves the entire state of an active game (players, positions, resources, current phase) to `localStorage`. This allows for game resumption.
    -   **Quest & App State:** The `App.tsx` component saves the configuration of the currently loaded quest, as well as the user's last visited page, so the app can be restored to a familiar state on reload.
    -   **Settings & Logs:** Services like `settingsService` and `auditLogService` use `localStorage` to persist user settings and AI interaction logs across sessions.