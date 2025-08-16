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
    }, [gamePhase]);

    const updateGameState = (newState: Partial<Omit<GameState, 'players'>>) => {
        setGameState(prev => ({ ...prev, ...newState }));
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
    }, [currentPlayerIndex, players]);

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
            console.error("Failed to generate dynamic scenario:", error);
            const locationNameEn = getLocalizedString(location.name, 'en');
            const pregenScenarios = questConfig.pregeneratedScenarios?.[locationNameEn];

            let errorMessage = `Failed to generate a dynamic event: ${error instanceof Error ? error.message : String(error)}.`;
            if (error.name === 'TokenLimitExceededError') {
                errorMessage = error.message;
            }

            if (pregenScenarios && pregenScenarios.length > 0) {
                alert(`${errorMessage} Falling back to a pre-written story scenario.`);
                const scenario = pregenScenarios[Math.floor(Math.random() * pregenScenarios.length)];
                updateGameState({ activeScenario: scenario, gamePhase: 'SCENARIO_CHOICE' });
            } else {
                alert(`${errorMessage} No pre-written scenarios available for this location. Skipping turn.`);
                nextTurn();
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
                alert(e.message);
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

    return (
        <div className="h-full">
            {/* Desktop Layout: 3 columns */}
            <div className="hidden lg:grid h-full grid-cols-1 lg:grid-cols-4 gap-4 p-2 md:p-4">
                <div className="lg:col-span-1 lg:order-1">
                    <PlayerDashboard
                        players={players}
                        questConfig={questConfig}
                        currentPlayer={currentPlayer}
                        language={language}
                    />
                </div>
                <div className="lg:col-span-2 lg:order-2 flex items-center justify-center">
                    <GameBoard board={questConfig.board} players={players} questName={getLocalizedString(questConfig.name, language)} language={language}/>
                </div>
                <div className="lg:col-span-1 lg:order-3">
                     <ActionPanel
                        players={players}
                        currentPlayer={currentPlayer}
                        gamePhase={gamePhase}
                        diceResult={diceResult}
                        activeScenario={activeScenario}
                        activeChoiceOutcome={activeChoiceOutcome}
                        activeCard={activeCard}
                        onRollDice={handleRollDice}
                        onScenarioChoice={handleScenarioChoice}
                        onNextTurn={nextTurn}
                        onSelectScenarioSource={handleSelectScenarioSource}
                        language={language}
                    />
                </div>
            </div>

            {/* Mobile Layout: Tabs */}
            <div className="lg:hidden h-full flex flex-col">
                <main className="flex-1 overflow-y-auto p-2">
                    {activeTab === 'board' && (
                        <div className="flex items-center justify-center h-full">
                            <GameBoard board={questConfig.board} players={players} questName={getLocalizedString(questConfig.name, language)} language={language}/>
                        </div>
                    )}
                    {activeTab === 'turn' && (
                        <PlayerDashboard players={players} questConfig={questConfig} currentPlayer={currentPlayer} language={language}/>
                    )}
                    {activeTab === 'scenario' && (
                        <ActionPanel
                            players={players}
                            currentPlayer={currentPlayer}
                            gamePhase={gamePhase}
                            diceResult={diceResult}
                            activeScenario={activeScenario}
                            activeChoiceOutcome={activeChoiceOutcome}
                            activeCard={activeCard}
                            onRollDice={handleRollDice}
                            onScenarioChoice={handleScenarioChoice}
                            onNextTurn={nextTurn}
                            onSelectScenarioSource={handleSelectScenarioSource}
                            language={language}
                        />
                    )}
                </main>
                <nav className="flex-shrink-0 bg-gray-900/80 backdrop-blur-md border-t border-gray-700 grid grid-cols-3 gap-2 p-2">
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
