# AGENTS.md

This file contains guidelines for agentic coding agents working on the QuestCraft repository.

## Build & Development Commands

```bash
# Start development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

**Important:** No linting or testing commands currently exist. This repository lacks ESLint, Prettier, and testing frameworks.

## Tech Stack & Setup

- **Framework:** React 19.1.1 with TypeScript 5.8.2
- **Build Tool:** Vite 7.1.2
- **Path Alias:** `@/*` maps to root directory
- **Type Checking:** TypeScript compiler with ES2022 target
- **Styling:** Tailwind CSS classes for UI components

## Code Style Guidelines

### Imports

```typescript
// Type imports first
import type { QuestConfig, Player, GamePhase } from './types';

// React imports next
import React, { useState, useCallback, useEffect } from 'react';

// External dependencies
import { GoogleGenAI } from "@google/genai";

// Local imports (group by directory)
import { statsService } from './services/statsService';
import { getLocalizedString } from '../utils/localization';
```

- Use `import type {...}` for type-only imports
- Group imports: types → React → external → local
- Use relative paths for local imports (`./services/`, `../utils/`)

### Formatting

- **Indentation:** 4 spaces (no tabs)
- **Semicolons:** Not used consistently
- **Trailing commas:** Required on multiline arrays/objects
- **Line length:** Target ~100 characters, but flexibility is acceptable

```typescript
const Component: React.FC<Props> = ({ prop1, prop2, prop3 }) => {
    const [state, setState] = useState<Type>(defaultValue);
    
    return (
        <div className="flex flex-col space-y-4">
            {/* JSX content */}
        </div>
    );
};
```

### Types

- **All types centralized** in `types.ts` (179 lines of interfaces/enums)
- **Use `interface`** for object shapes and class types
- **Use `type`** for unions, primitives, and computed types
- **Always import types** with `import type {...}` syntax

```typescript
// ✅ Correct
interface Player {
    id: number;
    name: string;
    resources: Record<string, number>;
}

type GamePhase = 'SETUP' | 'TURN_START' | 'SCENARIO_CHOICE' | 'GAME_OVER';

// ✅ Type-only import
import type { Player, GamePhase } from './types';
```

### Naming Conventions

- **Components:** PascalCase (`GamePage`, `StatusBar`, `Header`)
- **Hooks:** camelCase with `use` prefix (`useTranslation`, `useGameState`)
- **Services:** camelCase with descriptive names (`settingsService`, `statsService`)
- **Constants:** UPPER_SNAKE_CASE (`APP_SETTINGS_STORAGE_KEY`, `STATS_UPDATED_EVENT`)
- **Event Names:** lowercase with descriptive purpose (`'statsupdated'`, `'settingsupdated'`)
- **Variables/Functions:** camelCase (`getCurrentPlayer`, `handleExitGame`)
- **Enums:** PascalCase with UPPER_SNAKE_CASE values (`BoardLocationType.PROPERTY`)

### Error Handling

**Critical patterns for localStorage/sessionStorage operations:**

```typescript
const saveToStorage = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error(`Failed to save ${key} to localStorage`, e);
        // Continue gracefully - don't crash the app
    }
};

const loadFromStorage = <T>(key: string, defaultValue: T): T => {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
        console.error(`Failed to parse ${key} from localStorage`, e);
        return defaultValue; // Always provide fallback
    }
};
```

- **Always wrap** storage operations in try-catch
- **Provide meaningful error messages** with context
- **Return sensible defaults** when operations fail
- **Use custom error classes** for domain-specific errors (see `TokenLimitExceededError`)

### State Management Patterns

**React State:**
- Use `useState` for component-local state
- Use `useCallback` for event handlers to prevent unnecessary re-renders
- Use `useEffect` for side effects with proper cleanup

**Persistent State:**
```typescript
// Service pattern - singletons exported as objects
export const settingsService = {
    getSettings: (): AppSettings => { /* ... */ },
    saveSettings: (settings: AppSettings): void => { /* ... */ },
};

// Event-driven updates
const dispatchUpdateEvent = () => {
    window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
};
```

**Best Practices:**
- **Never store API keys** in localStorage - use sessionStorage or environment variables
- **Dispatch events** when service state changes (see `STATS_UPDATED_EVENT`, `SETTINGS_UPDATED_EVENT`)
- **Use TypeScript interfaces** for all state objects
- **Provide defaults** when loading from storage

### Localization

**Two-part localization system:**

```typescript
// For UI strings - use translation hook
const { t } = useTranslation();
const title = t('questCraftTitle'); // Looks up in locales/en.json

// For localized data - use utility function
const questName = getLocalizedString(config.name, language); // Fallbacks to 'en' if needed
```

**Key Points:**
- **Supported languages:** en, es, hi, ta (defined in types.ts:149)
- **Translation files:** JSON files in `locales/` directory
- **Fallback strategy:** Always fall back to English ('en') if current language lacks translation
- **Pluralization:** Not implemented - use separate keys if needed
- **Variable substitution:** Use `{placeholder}` syntax in translation strings

### React Component Patterns

```typescript
interface ComponentProps {
    requiredProp: string;
    optionalProp?: number;
    onAction: (data: SomeType) => void;
}

const Component: React.FC<ComponentProps> = ({ requiredProp, optionalProp, onAction }) => {
    const [localState, setLocalState] = useState<Type>(initialValue);
    
    const handleAction = useCallback((data: SomeType) => {
        // Handler logic
        onAction(data);
    }, [onAction]);
    
    useEffect(() => {
        // Side effect logic
        return () => {
            // Cleanup
        };
    }, [dependencies]);
    
    return (
        <div className="tailwind-classes">
            {/* JSX content */}
        </div>
    );
};
```

**Requirements:**
- Use `React.FC` type annotation for functional components
- Define props interfaces at the top of component files
- Use `useCallback` for event handlers passed to children
- Use `useEffect` with dependency arrays
- Provide proper TypeScript types for all props and state

## Project Structure

```
/
├── components/          # React UI components
│   ├── GamePage.tsx    # Main game interface
│   ├── SettingsDrawer.tsx
│   └── ...
├── services/           # Singleton services
│   ├── aiService.ts    # AI integration (Gemini, OpenAI, etc.)
│   ├── settingsService.ts # App settings management
│   ├── statsService.ts  # Usage statistics
│   └── i18n.ts        # Internationalization
├── utils/              # Utility functions
│   └── localization.ts # String localization helpers
├── locales/           # Translation files
│   ├── en.json        # English (default)
│   ├── es.json        # Spanish
│   ├── hi.json        # Hindi
│   └── ta.json        # Tamil
├── types.ts           # Central TypeScript type definitions
├── constants.tsx      # React components used as constants (icons)
├── quests/           # Quest configuration JSON files
├── App.tsx           # Main application component
└── index.tsx         # Application entry point
```

## Important Notes

### No Testing Framework
- **No tests exist** in this repository
- **No testing commands** are available
- **Recommendation:** Consider adding Vitest or Jest + React Testing Library

### No Linting/Formatting
- **No ESLint configuration** exists
- **No Prettier configuration** exists
- **Recommendation:** Add code quality tools

### API Security
- **Never commit API keys** to the repository
- **Use environment variables** for development keys
- **Use sessionStorage** for user-provided API keys
- **Mask API keys in logs** using the `maskApiKey` utility function

### Logger Usage
- Import from `services/logger.ts`
- Respects `DEV_MODE` and `DEBUG_LEVEL` environment variables
- Use appropriate log levels: `logger.info()`, `logger.warn()`, `logger.error()`

### Event System
Services dispatch custom events for state changes:
- `STATS_UPDATED_EVENT` - When usage statistics change
- `SETTINGS_UPDATED_EVENT` - When app settings change
- `CONNECTIVITY_UPDATED_EVENT` - When AI connectivity status changes

### Performance Considerations
- React components use `useCallback` and `useMemo` where appropriate
- Event listeners are properly cleaned up in useEffect returns
- localStorage operations are minimized and cached when possible