import React from 'react';
import type { Player, GamePhase, ManagedScenario, Choice, ChanceCard, LanguageCode } from '../types';
import { getLocalizedString } from '../utils/localization';
import { useTranslation } from '../services/i18n';

const ActionCard: React.FC<{ children: React.ReactNode, title: string }> = ({ children, title }) => (
    <div className="bg-gray-800/80 backdrop-blur-sm p-6 rounded-lg border border-gray-700 shadow-lg animate-fade-in flex flex-col h-full">
        <h3 className="text-xl font-bold text-orange-400 mb-4">{title}</h3>
        <div className="text-gray-300 space-y-4 flex-grow flex flex-col justify-center">{children}</div>
    </div>
);

interface ActionPanelProps {
    players: Player[];
    currentPlayer: Player;
    gamePhase: GamePhase;
    diceResult: [number, number] | null;
    activeScenario: ManagedScenario | null;
    activeChoiceOutcome: Choice['outcome'] | null;
    activeCard: ChanceCard | null;
    gameError: string | null;
    onRollDice: () => void;
    onScenarioChoice: (choice: Choice) => void;
    onNextTurn: () => void;
    onSelectScenarioSource: (source: 'pregen' | 'dynamic') => void;
    language: LanguageCode;
}

const ActionPanel: React.FC<ActionPanelProps> = ({
    players,
    currentPlayer,
    gamePhase,
    diceResult,
    activeScenario,
    activeChoiceOutcome,
    activeCard,
    gameError,
    onRollDice,
    onScenarioChoice,
    onNextTurn,
    onSelectScenarioSource,
    language
}) => {
    const { t } = useTranslation();
    
    const renderContent = () => {
        if (gameError) {
            return (
                <ActionCard title={t('error')}>
                    <p className="text-red-300">{gameError}</p>
                    <button
                        onClick={onNextTurn}
                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300"
                    >
                        {t('continue')}
                    </button>
                </ActionCard>
            );
        }

        if (gamePhase === 'GAME_OVER') {
            const winner = players.find(p => !p.isBankrupt);
            return (
                 <ActionCard title={t('gameOver')}>
                    <p className="text-lg text-center">
                        {t('gameOverMessage', { winnerName: winner?.name || '' })}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300"
                    >
                        {t('playAgain')}
                    </button>
                </ActionCard>
            );
        }

        if (activeChoiceOutcome) {
            return (
                <ActionCard title={t('outcome')}>
                    <p>{getLocalizedString(activeChoiceOutcome.explanation, language)}</p>
                    <button
                        onClick={onNextTurn}
                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300"
                    >
                        {t('endTurn')}
                    </button>
                </ActionCard>
            );
        }
        
        if (activeScenario && gamePhase === 'SCENARIO_CHOICE') {
            if (currentPlayer.isAI) {
                return (
                    <ActionCard title={getLocalizedString(activeScenario.title, language)}>
                        <p className="flex-grow overflow-y-auto">{getLocalizedString(activeScenario.description, language)}</p>
                        <div className="text-center p-4">
                            <p className="text-lg animate-pulse">{t('aiIsThinking')}</p>
                        </div>
                    </ActionCard>
                );
            }

             return (
                <ActionCard title={getLocalizedString(activeScenario.title, language)}>
                    <p className="flex-grow overflow-y-auto">{getLocalizedString(activeScenario.description, language)}</p>
                     {activeScenario.sourceUrl && (
                         <a href={activeScenario.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-sm block mt-2">
                           {t('source', { sourceTitle: getLocalizedString(activeScenario.sourceTitle, language) || activeScenario.sourceUrl })}
                         </a>
                     )}
                    <div className="flex flex-col space-y-3 pt-2">
                        {activeScenario.choices.map((choice, index) => (
                            <button
                                key={index}
                                onClick={() => onScenarioChoice(choice)}
                                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-300"
                            >
                                {getLocalizedString(choice.text, language)}
                            </button>
                        ))}
                    </div>
                </ActionCard>
            );
        }
        
        if (gamePhase === 'SCENARIO_SOURCE_SELECTION') {
             return (
                <ActionCard title={t('choosePath')}>
                    <p className="text-center">{t('choosePathDescription')}</p>
                    <div className="flex flex-col space-y-3 pt-4">
                        <button onClick={() => onSelectScenarioSource('pregen')} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-300">
                            {t('playStoryScenario')}
                        </button>
                         <button onClick={() => onSelectScenarioSource('dynamic')} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-300">
                            {t('generateDynamicEvent')}
                        </button>
                    </div>
                </ActionCard>
            );
        }

        if (activeCard && (gamePhase === 'CHANCE_CARD' || gamePhase === 'COMMUNITY_CHEST_CARD')) {
            const cardType = gamePhase === 'CHANCE_CARD' ? 'Chance' : 'Community Chest';
            return (
                <ActionCard title={cardType}>
                    <p className="text-lg text-center font-medium">"{getLocalizedString(activeCard.description, language)}"</p>
                     <button
                        onClick={onNextTurn}
                        className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-300"
                    >
                        {t('continue')}
                    </button>
                </ActionCard>
            );
        }

        if (gamePhase === 'GENERATING_SCENARIO') {
            return (
                 <div className="text-center space-y-4 flex flex-col justify-center items-center h-full">
                    <p className="text-lg animate-pulse">{t('generatingScenario')}</p>
                 </div>
            )
        }

        return (
             <div className="flex flex-col justify-center items-center h-full space-y-4">
                 {diceResult && (
                    <p className="text-lg">
                        {t('youRolled', {roll: diceResult[0] + diceResult[1]})}
                    </p>
                 )}
                 <button
                    onClick={onRollDice}
                    disabled={gamePhase !== 'TURN_START' || currentPlayer.isAI}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition duration-300 shadow-lg disabled:shadow-none"
                >
                    {t('rollDice')}
                </button>
            </div>
        );
    };

    return (
         <div className="w-full h-full bg-gray-800/50 backdrop-blur-md p-4 md:p-6 rounded-2xl shadow-2xl flex flex-col">
            {renderContent()}
        </div>
    );
};

export default ActionPanel;