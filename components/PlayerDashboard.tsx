
import React from 'react';
import type { Player, QuestConfig, LanguageCode } from '../types';
import { IconMap } from '../constants';
import { getLocalizedString } from '../utils/localization';
import { useTranslation } from '../services/i18n';

const ResourceBar: React.FC<{ resourceDef: QuestConfig['resources'][0], value: number, language: LanguageCode }> = ({ resourceDef, value, language }) => {
    const IconComponent = IconMap[resourceDef.icon];
    
    const min = resourceDef.minimumValue ?? 0;
    const max = resourceDef.maximumValue ?? resourceDef.initialValue * 2;
    const range = max - min;
    const correctedValue = value - min;
    const percentage = range > 0 ? Math.max(0, Math.min(100, (correctedValue / range) * 100)) : (value > min ? 100 : 0);

    return (
        <div className="flex items-center space-x-3">
            <IconComponent className="w-6 h-6 text-gray-400" />
            <div className="flex-1">
                <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-medium text-gray-200">{getLocalizedString(resourceDef.name, language)}</span>
                    <span className="text-lg font-mono font-bold text-white">{value}</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2.5">
                    <div
                        className={`${resourceDef.barColor} h-2.5 rounded-full transition-all duration-500 ease-out`}
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
};


interface PlayerDashboardProps {
    players: Player[];
    questConfig: QuestConfig;
    currentPlayer: Player;
    language: LanguageCode;
}

const PlayerDashboard: React.FC<PlayerDashboardProps> = ({ players, questConfig, currentPlayer, language }) => {
    const { t } = useTranslation();
    return (
        <div className="w-full h-full bg-gray-800/50 backdrop-blur-md p-4 md:p-6 rounded-2xl shadow-2xl flex flex-col space-y-6">
            {/* Players Header */}
            <div className="bg-gray-900/50 p-3 rounded-lg">
                <h2 className="text-xs uppercase font-semibold text-gray-400 mb-2">{t('players')}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {players.map(p => (
                        <div key={p.id} className={`flex items-center space-x-2 p-1 rounded-md ${p.id === currentPlayer.id ? 'bg-gray-700' : ''} ${p.isBankrupt ? 'opacity-50 line-through' : ''}`}>
                             <div className={`w-3 h-3 rounded-full ${p.color} bg-current`}></div>
                            <span className="text-sm font-medium">{p.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Current Turn Info */}
            <div>
                <p className="text-sm text-gray-400">{t('currentTurn')}</p>
                <h2 className={`text-3xl font-bold ${currentPlayer.color}`}>{currentPlayer.name}</h2>
            </div>
            
            {/* Resource Bars */}
            <div className="space-y-4">
                 {questConfig.resources.map(resourceDef => (
                    <ResourceBar
                        key={getLocalizedString(resourceDef.name, 'en')}
                        resourceDef={resourceDef}
                        value={currentPlayer.resources[getLocalizedString(resourceDef.name, 'en').toLowerCase()] ?? 0}
                        language={language}
                    />
                ))}
            </div>
        </div>
    );
};

export default PlayerDashboard;
