import React, { useState, useCallback, useEffect } from 'react';
import type { QuestConfig, Player, GamePhase, ManagedScenario, Choice, ChanceCard, BoardLocation, ResourceChange, GameState } from '../types';
import { BoardLocationType } from '../types';
import GameBoard from './GameBoard';
import { generateDynamicScenario, getAIChoice } from '../services/aiService';
import PlayerDashboard from './PlayerDashboard';
import ActionPanel from './ActionPanel';
import { useTranslation } from '../services/i18n';
import { getLocalizedString } from '../utils/localization';
import { gameStateService } from '../services/gameStateService';
import { BoardIcon, PlayerIcon, UtilityIcon } from '../constants';
import { logger } from '../services/logger';

interface GamePageProps {
    questConfig: QuestConfig;
    onExit: () => void;
    onOpenFooterDrawer: (drawerContent: { title: string, content: string }) => void;
}

const defaultGameState: Omit<GameState, 'players'> = {
    currentPlayerIndex: 0,
    gamePhase: 'SETUP',
    diceResult: null,
    activeScenario: null,
    activeChoiceOutcome: null,
    activeCard: null,
    activeLocation: null,
};

type MobileTab = 'board' | 'turn' | 'scenario';
type GameMode = 'single' | 'multi';

const TabButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`p-2 rounded-lg text-center text-xs font-medium transition-colors w-full ${
            isActive
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-700'
        }`}
    >
        {icon}
        <span className="block truncate">{label}</span>
    </button>
);


const GamePage: React.FC<GamePageProps> = ({ questConfig, onExit, onOpenFooterDrawer }) => {
    const { t, language } = useTranslation();
    
    // State for the setup screen
    const [gameMode, setGameMode] = useState<GameMode>('multi');
    const [numPlayers, setNumPlayers] = useState(2);
    const [playerNames, setPlayerNames] = useState<string[]>(['Player 1', 'Player 2']);

    // Core game state
    const [players, setPlayers] = useState<Player[]>([]);
    const [gameState, setGameState] = useState<Omit<GameState, 'players'>>(defaultGameState);
    const { currentPlayerIndex, gamePhase, diceResult, activeScenario, activeChoiceOutcome, activeCard, activeLocation } = gameState;
    const [gameError, setGameError] = useState<string | null>(null);
    
    // Mobile-specific state
    const [activeTab, setActiveTab] = useState<MobileTab>('board');
    
    // Load game state on mount
    useEffect(() => {
        const loadedState = gameStateService.load();
        if (loadedState && loadedState.players.length > 0) {
            setPlayers(loadedState.players);
            setGameState(loadedState);
        }
    }, []);

    // Save game state whenever it changes
    useEffect(() => {
        if (gamePhase !== 'SETUP') {
            gameStateService.save({ players, ...gameState });
        }
    }, [players, gameState, gamePhase]);

    // Auto-switch tab based on game phase for mobile
    useEffect(() => {
        if (gameError) {
            setActiveTab('scenario');
            return;
        }
        if (gamePhase === 'PLAYER_MOVE') {
            setActiveTab('board');
        } else if (
            gamePhase === 'SCENARIO_SOURCE_SELECTION' ||
            gamePhase === 'GENERATING_SCENARIO' ||
            gamePhase === 'CHANCE_CARD' ||
            gamePhase === 'COMMUNITY_CHEST_CARD' ||
            gamePhase === 'SCENARIO_CHOICE' ||
            gamePhase === 'SCENARIO_OUTCOME'
        ) {
            setActiveTab('scenario');
        }
    }, [gamePhase, gameError]);

    const updateGameState = (newState: Partial<Omit<GameState, 'players'>>) => {
        setGameState(prev => {
            const nextState = { ...prev, ...newState };
            if (prev.gamePhase !== nextState.gamePhase) {
                logger.info(`[Game] Game phase changed from ${prev.gamePhase} to ${nextState.gamePhase}`);
            }
            return nextState;
        });
    };

    const initializePlayers = useCallback((count: number, names: string[], mode: GameMode) => {
        const initialPlayers: Player[] = Array.from({ length: count }, (_, i) => ({
            id: i,
            name: names[i]?.trim() || `${t('player')} ${i + 1}`,
            color: questConfig.playerColors[i % questConfig.playerColors.length],
            position: 0,
            resources: questConfig.resources.reduce((acc, resource) => {
                acc[getLocalizedString(resource.name, 'en').toLowerCase()] = resource.initialValue;
                return acc;
            }, {} as Record<string, number>),
            inJail: false,
            jailTurns: 0,
            isBankrupt: false,
            isAI: mode === 'single' && i === 1,
        }));
        setPlayers(initialPlayers);
    }, [t, questConfig]);

    const handleStartGame = () => {
        const playerCount = gameMode === 'single' ? 2 : numPlayers;
        const names = gameMode === 'single' ? [playerNames[0], t('aiOpponent')] : playerNames;
        logger.info(`[Game] Starting new game with ${playerCount} players in ${gameMode} mode.`);
        initializePlayers(playerCount, names, gameMode);
        updateGameState({ gamePhase: 'TURN_START' });
    };

    const handleGameModeChange = (mode: GameMode) => {
        setGameMode(mode);
        if (mode === 'single') {
            setNumPlayers(2);
            setPlayerNames(['Player 1', t('aiOpponent')]);
        } else {
            setNumPlayers(2);
            setPlayerNames(['Player 1', 'Player 2']);
        }
    }
    
    const handleNumPlayersChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const count = parseInt(e.target.value, 10);
        setNumPlayers(count);
        setPlayerNames(prev => {
            const newNames = Array.from({ length: count }, (_, i) => prev[i] || `${t('player')} ${i + 1}`);
            return newNames;
        });
    };

    const handlePlayerNameChange = (index: number, name: string) => {
        setPlayerNames(prev => {
            const newNames = [...prev];
            newNames[index] = name;
            return newNames;
        });
    };

    const nextTurn = useCallback(() => {
        if (gameError) setGameError(null);
        updateGameState({
            activeScenario: null,
            activeChoiceOutcome: null,
            activeCard: null,
            activeLocation: null,
        });

        const activePlayersCount = players.filter(p => !p.isBankrupt).length;
        if (activePlayersCount <= 1) {
            updateGameState({ gamePhase: 'GAME_OVER' });
            return;
        }

        let nextIndex = (currentPlayerIndex + 1) % players.length;
        while (players[nextIndex]?.isBankrupt) {
            nextIndex = (nextIndex + 1) % players.length;
        }
        
        updateGameState({ currentPlayerIndex: nextIndex, gamePhase: 'TURN_START' });
    }, [currentPlayerIndex, players, updateGameState, gameError]);

    const applyResourceChanges = useCallback((changes: ResourceChange[]) => {
        setPlayers(prevPlayers => {
            const newPlayers = JSON.parse(JSON.stringify(prevPlayers));
            const player = newPlayers[currentPlayerIndex];
            if (!player) return newPlayers;

            for (const change of changes) {
                const resourceName = change.name.toLowerCase();
                const resourceDef = questConfig.resources.find(r => getLocalizedString(r.name, 'en').toLowerCase() === resourceName);

                if (player.resources[resourceName] !== undefined && resourceDef) {
                    let newValue = player.resources[resourceName] + change.value;
                    
                    if (resourceDef.maximumValue !== undefined) {
                        newValue = Math.min(newValue, resourceDef.maximumValue);
                    }
                    player.resources[resourceName] = newValue;
                }
            }

            const isBankrupt = questConfig.resources.some(resourceDef => {
                const resourceName = getLocalizedString(resourceDef.name, 'en').toLowerCase();
                const playerResourceValue = player.resources[resourceName];
                const minimumValue = resourceDef.minimumValue ?? 0;
                return playerResourceValue <= minimumValue;
            });
            
            if (isBankrupt && !player.isBankrupt) {
                player.isBankrupt = true;
                const activePlayers = newPlayers.filter((p: Player) => !p.isBankrupt);
                if (activePlayers.length <= 1) {
                    setTimeout(() => updateGameState({ gamePhase: 'GAME_OVER' }), 100);
                }
            }
            return newPlayers;
        });
    }, [currentPlayerIndex, questConfig, updateGameState]);
    
    const triggerDynamicScenario = useCallback(async (location: BoardLocation) => {
        updateGameState({ gamePhase: 'GENERATING_SCENARIO' });
        try {
            const dynamicScenario = await generateDynamicScenario(questConfig, players[currentPlayerIndex], location);
            updateGameState({ activeScenario: dynamicScenario, gamePhase: 'SCENARIO_CHOICE' });
        } catch (error: any) {
            logger.warn("Failed to generate dynamic scenario, checking for fallback.", error);
            const locationNameEn = getLocalizedString(location.name, 'en');
            const pregenScenarios = questConfig.pregeneratedScenarios?.[locationNameEn];

            if (pregenScenarios && pregenScenarios.length > 0) {
                logger.info("Fallback to pre-generated scenario is available.");
                const scenario = pregenScenarios[Math.floor(Math.random() * pregenScenarios.length)];
                updateGameState({ activeScenario: scenario, gamePhase: 'SCENARIO_CHOICE' });
            } else {
                logger.error("No fallback scenario available.");
                let errorMessage = `Failed to generate a dynamic event: ${error instanceof Error ? error.message : String(error)}.`;
                 if (error.name === 'TokenLimitExceededError') {
                    errorMessage = error.message;
                }
                setGameError(errorMessage);
            }
        }
    }, [questConfig, players, currentPlayerIndex, nextTurn, updateGameState]);

     const handleLocationAction = useCallback(async (location: BoardLocation) => {
        switch (location.type) {
            case BoardLocationType.PROPERTY:
            case BoardLocationType.UTILITY:
                const locationNameEn = getLocalizedString(location.name, 'en');
                const pregenScenarios = questConfig.pregeneratedScenarios?.[locationNameEn];
                const hasPregen = pregenScenarios && pregenScenarios.length > 0;
                
                if (questConfig.groundingInReality || !hasPregen) {
                    await triggerDynamicScenario(location);
                } else {
                    const currentPlayer = players[currentPlayerIndex];
                    if (currentPlayer?.isAI) {
                        handleSelectScenarioSource('pregen'); // AI prefers pre-written stories
                    } else {
                        updateGameState({ activeLocation: location, gamePhase: 'SCENARIO_SOURCE_SELECTION' });
                    }
                }
                break;
            case BoardLocationType.CHANCE:
                 if (questConfig.chanceCards.length > 0) {
                    const card = questConfig.chanceCards[Math.floor(Math.random() * questConfig.chanceCards.length)];
                    updateGameState({ activeCard: card, gamePhase: 'CHANCE_CARD' });
                    if(card.resourceChanges) applyResourceChanges(card.resourceChanges);
                } else {
                     nextTurn();
                }
                break;
            case BoardLocationType.COMMUNITY_CHEST:
                if (questConfig.communityChestCards && questConfig.communityChestCards.length > 0) {
                    const card = questConfig.communityChestCards[Math.floor(Math.random() * questConfig.communityChestCards.length)];
                    updateGameState({ activeCard: card, gamePhase: 'COMMUNITY_CHEST_CARD' });
                    if(card.resourceChanges) applyResourceChanges(card.resourceChanges);
                } else {
                    nextTurn();
                }
                break;
            case BoardLocationType.GO_TO_JAIL:
                setPlayers(ps => ps.map((p, i) => i === currentPlayerIndex ? { ...p, position: questConfig.board.jailPosition, inJail: true, jailTurns: 0 } : p));
                 setTimeout(nextTurn, 500);
                break;
            case BoardLocationType.TAX:
                 applyResourceChanges([{ name: 'money', value: -100 }]);
                 setTimeout(nextTurn, 500);
                 break;
            default:
                setTimeout(nextTurn, 500);
        }
    }, [questConfig, applyResourceChanges, nextTurn, players, currentPlayerIndex, triggerDynamicScenario, updateGameState]);

    const handleRollDice = useCallback(() => {
        if (gamePhase !== 'TURN_START') return;

        updateGameState({ gamePhase: 'DICE_ROLL' });
        const roll1 = Math.floor(Math.random() * 6) + 1;
        const roll2 = Math.floor(Math.random() * 6) + 1;
        updateGameState({ diceResult: [roll1, roll2] });

        setTimeout(() => {
            updateGameState({ gamePhase: 'PLAYER_MOVE' });
            const totalRoll = roll1 + roll2;
            const currentPlayer = players[currentPlayerIndex];
            const newPosition = (currentPlayer.position + totalRoll) % questConfig.board.locations.length;
            
            setPlayers(ps => ps.map((p, i) => i === currentPlayerIndex ? { ...p, position: newPosition } : p));
            
            setTimeout(() => {
                const location = questConfig.board.locations[newPosition];
                handleLocationAction(location);
            }, 500);
        }, 500);
    }, [gamePhase, players, currentPlayerIndex, questConfig, handleLocationAction, updateGameState]);
    
    const handleScenarioChoice = useCallback((choice: Choice) => {
        updateGameState({ activeChoiceOutcome: choice.outcome, gamePhase: 'SCENARIO_OUTCOME' });
        applyResourceChanges(choice.outcome.resourceChanges);
    }, [applyResourceChanges, updateGameState]);
    
    const handleAIChoice = useCallback(async (scenario: ManagedScenario) => {
        try {
            const choiceIndex = await getAIChoice(questConfig, scenario, players[currentPlayerIndex]);
            const chosenChoice = scenario.choices[choiceIndex];
            setTimeout(() => {
                handleScenarioChoice(chosenChoice);
            }, 1500); // Simulate thinking
        } catch (e: any) {
            console.error("AI choice failed, picking randomly.", e);
            if (e.name === 'TokenLimitExceededError') {
                setGameError(e.message);
                return;
            }
            const randomChoice = scenario.choices[Math.floor(Math.random() * 2)];
             setTimeout(() => {
                handleScenarioChoice(randomChoice);
            }, 500);
        }
    }, [questConfig, players, currentPlayerIndex, handleScenarioChoice]);

    useEffect(() => {
        const currentPlayer = players[currentPlayerIndex];
        if (gamePhase === 'TURN_START' && currentPlayer?.isAI) {
            setTimeout(() => handleRollDice(), 1500);
        } else if (gamePhase === 'SCENARIO_CHOICE' && activeScenario && currentPlayer?.isAI) {
            handleAIChoice(activeScenario);
        }
    }, [gamePhase, currentPlayerIndex, players, activeScenario, handleRollDice, handleAIChoice]);

    const handleSelectScenarioSource = useCallback(async (source: 'pregen' | 'dynamic') => {
        if (!activeLocation) {
            // This can happen if AI triggers this function
            const currentPosition = players[currentPlayerIndex].position;
            const location = questConfig.board.locations[currentPosition];
            if (!location) return;

            if (source === 'pregen') {
                const pregenScenarios = questConfig.pregeneratedScenarios?.[getLocalizedString(location.name, 'en')];
                if (pregenScenarios && pregenScenarios.length > 0) {
                    const scenario = pregenScenarios[Math.floor(Math.random() * pregenScenarios.length)];
                    updateGameState({ activeScenario: scenario, gamePhase: 'SCENARIO_CHOICE' });
                } else { nextTurn(); }
            }
            return;
        };
        
        const locationNameEn = getLocalizedString(activeLocation.name, 'en');

        if (source === 'pregen') {
            const pregenScenarios = questConfig.pregeneratedScenarios?.[locationNameEn];
            if (pregenScenarios && pregenScenarios.length > 0) {
                const scenario = pregenScenarios[Math.floor(Math.random() * pregenScenarios.length)];
                updateGameState({ activeScenario: scenario, gamePhase: 'SCENARIO_CHOICE' });
            } else {
                nextTurn(); // Fallback
            }
        } else if (source === 'dynamic') {
            await triggerDynamicScenario(activeLocation);
        }
        updateGameState({ activeLocation: null });
    }, [activeLocation, questConfig, players, currentPlayerIndex, nextTurn, triggerDynamicScenario, updateGameState]);

    const renderGameSetup = () => (
         <div className="min-h-full flex items-center justify-center p-4 bg-gray-900">
             <div className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl p-8">
                 <h2 className="text-3xl font-bold mb-2 text-center">{getLocalizedString(questConfig.name, language)}</h2>
                 <p className="text-gray-400 mb-6 text-center">{getLocalizedString(questConfig.description, language)}</p>
                 
                 <div className="mb-6">
                    <label className="block text-lg font-medium text-gray-300 mb-2">Game Mode</label>
                    <div className="flex gap-2">
                        <button onClick={() => handleGameModeChange('multi')} className={`flex-1 p-3 rounded-lg font-semibold transition ${gameMode === 'multi' ? 'bg-indigo-600' : 'bg-gray-700'}`}>{t('multiplayer')}</button>
                        <button onClick={() => handleGameModeChange('single')} className={`flex-1 p-3 rounded-lg font-semibold transition ${gameMode === 'single' ? 'bg-indigo-600' : 'bg-gray-700'}`}>{t('singlePlayer')}</button>
                    </div>
                </div>

                 {gameMode === 'multi' && (
                     <div className="mb-6">
                         <label htmlFor="numPlayers" className="block text-lg font-medium text-gray-300 mb-2">{t('howManyPlayers')}</label>
                         <select id="numPlayers" value={numPlayers} onChange={handleNumPlayersChange} className="bg-gray-700 text-white p-3 rounded-lg w-full">
                             <option value="2">{t('2players')}</option>
                             <option value="3">{t('3players')}</option>
                             <option value="4">{t('4players')}</option>
                         </select>
                     </div>
                 )}

                 <div className="mb-8 space-y-3">
                    <h3 className="text-lg font-medium text-gray-300">{t('playerNames')}</h3>
                    {Array.from({ length: gameMode === 'single' ? 1 : numPlayers }).map((_, i) => (
                        <input
                            key={i}
                            type="text"
                            value={playerNames[i] || ''}
                            onChange={(e) => handlePlayerNameChange(i, e.target.value)}
                            placeholder={`${t('player')} ${i + 1}`}
                            className="bg-gray-700 text-white p-3 rounded-lg w-full"
                        />
                    ))}
                     {gameMode === 'single' && (
                        <input
                            type="text"
                            value={t('aiOpponent')}
                            readOnly
                            className="bg-gray-900 text-gray-400 p-3 rounded-lg w-full cursor-not-allowed"
                        />
                     )}
                </div>

                 <button onClick={handleStartGame} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition">
                     {t('startGame')}
                 </button>
                 <button onClick={onExit} className="w-full mt-3 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition">
                     {t('backToMainMenu')}
                 </button>
             </div>
         </div>
    );
    
    if (gamePhase === 'SETUP') {
        return renderGameSetup();
    }

    if (players.length === 0) {
        return <div className="min-h-full bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
    }

    const currentPlayer = players[currentPlayerIndex];

    const commonActionPanel = <ActionPanel
        players={players}
        currentPlayer={currentPlayer}
        gamePhase={gamePhase}
        diceResult={diceResult}
        activeScenario={activeScenario}
        activeChoiceOutcome={activeChoiceOutcome}
        activeCard={activeCard}
        gameError={gameError}
        onRollDice={handleRollDice}
        onScenarioChoice={handleScenarioChoice}
        onNextTurn={nextTurn}
        onSelectScenarioSource={handleSelectScenarioSource}
        language={language}
    />;

    const commonPlayerDashboard = <PlayerDashboard
        players={players}
        questConfig={questConfig}
        currentPlayer={currentPlayer}
        language={language}
    />;
    
    const commonGameBoard = <GameBoard board={questConfig.board} players={players} questName={getLocalizedString(questConfig.name, language)} language={language}/>;

    return (
        <div className="h-full">
            {/* Desktop Layout (xl and up) */}
            <div className="hidden xl:grid h-full grid-cols-1 xl:grid-cols-4 gap-4 p-4">
                <div className="xl:col-span-1 xl:order-1">
                    {commonPlayerDashboard}
                </div>
                <div className="xl:col-span-2 xl:order-2 flex items-center justify-center">
                    {commonGameBoard}
                </div>
                <div className="xl:col-span-1 xl:order-3">
                     {commonActionPanel}
                </div>
            </div>

            {/* Tablet Layout (md to xl) */}
            <div className="hidden md:grid xl:hidden h-full grid-cols-3 gap-4 p-4">
                <div className="col-span-2 flex items-center justify-center">
                    {commonGameBoard}
                </div>
                <div className="col-span-1 flex flex-col gap-4 overflow-hidden">
                    <div className="flex-1 min-h-0">
                       {commonPlayerDashboard}
                    </div>
                    <div className="flex-1 min-h-0">
                       {commonActionPanel}
                    </div>
                </div>
            </div>

            {/* Mobile Layout (up to md) */}
            <div className="md:hidden h-full flex flex-col">
                <main className="flex-1 overflow-y-auto p-2 pb-20">
                    {activeTab === 'board' && (
                        <div className="flex items-center justify-center h-full">
                           {commonGameBoard}
                        </div>
                    )}
                    {activeTab === 'turn' && commonPlayerDashboard}
                    {activeTab === 'scenario' && commonActionPanel}
                </main>
                <nav className="fixed bottom-12 left-0 right-0 z-30 bg-gray-900/80 backdrop-blur-md border-t border-gray-700 grid grid-cols-3 gap-2 p-2">
                    <TabButton
                        label={t('tabBoard')}
                        icon={<BoardIcon className="w-6 h-6 mx-auto mb-1" />}
                        isActive={activeTab === 'board'}
                        onClick={() => setActiveTab('board')}
                    />
                    <TabButton
                        label={t('tabTurn')}
                        icon={<PlayerIcon className="w-6 h-6 mx-auto mb-1" />}
                        isActive={activeTab === 'turn'}
                        onClick={() => setActiveTab('turn')}
                    />
                    <TabButton
                        label={t('tabScenario')}
                        icon={<UtilityIcon className="w-6 h-6 mx-auto mb-1" />}
                        isActive={activeTab === 'scenario'}
                        onClick={() => setActiveTab('scenario')}
                    />
                </nav>
            </div>
        </div>
    );
};

export default GamePage;