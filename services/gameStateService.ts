

import type { GameState } from '../types';
import { logger } from './logger';

const GAME_STATE_KEY = 'questcraft-game-state';

export const gameStateService = {
  save(state: GameState): void {
    try {
      logger.info('[GameState] Saving game state to localStorage.');
      logger.debug('[GameState] State being saved:', state);
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      logger.error("Failed to save game state to localStorage", e);
    }
  },

  load(): GameState | null {
    try {
      const stateJson = localStorage.getItem(GAME_STATE_KEY);
      if (stateJson) {
        logger.info('[GameState] Loaded game state from localStorage.');
        const state = JSON.parse(stateJson);
        logger.debug('[GameState] Loaded state:', state);
        return state;
      }
      logger.info('[GameState] No game state found in localStorage.');
      return null;
    } catch (e) {
      logger.error("Failed to load game state from localStorage", e);
      return null;
    }
  },

  clear(): void {
    try {
      logger.info('[GameState] Clearing game state from localStorage.');
      localStorage.removeItem(GAME_STATE_KEY);
    } catch (e) {
      logger.error("Failed to clear game state from localStorage", e);
    }
  }
};
