
import type { GameState, Player } from '../types';

const GAME_STATE_KEY = 'questcraft-game-state';

export const gameStateService = {
  save(state: GameState): void {
    try {
      localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save game state to localStorage", e);
    }
  },

  load(): GameState | null {
    try {
      const stateJson = localStorage.getItem(GAME_STATE_KEY);
      return stateJson ? JSON.parse(stateJson) : null;
    } catch (e) {
      console.error("Failed to load game state from localStorage", e);
      return null;
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(GAME_STATE_KEY);
    } catch (e) {
      console.error("Failed to clear game state from localStorage", e);
    }
  }
};
