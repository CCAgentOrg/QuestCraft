

import React from 'react';
import type { AppStats } from '../types';
import { TokenIcon, MoneyIcon, TimeIcon, AuditLogIcon, ChatIcon, ChipIcon } from '../constants';
import { useTranslation } from '../services/i18n';
import { statsService } from '../services/statsService';
import { settingsService } from '../services/settingsService';

interface StatusBarProps {
    stats: AppStats | null;
    modelName?: string;
    isAiConnected: boolean;
    onNavigateToSettings: () => void;
    onOpenAuditLog: () => void;
    onOpenChat: () => void;
}

const formatTime = (totalSeconds: number): string => {
    if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

const StatItem: React.FC<{ icon: React.ReactNode; label?: string; value: string | number; tooltip: string; valueClass?: string; }> = ({ icon, label, value, tooltip, valueClass = 'text-orange-300' }) => (
    <div className="flex items-center gap-2" title={tooltip}>
        <div className="text-gray-400">{icon}</div>
        <div className="flex items-baseline gap-1.5">
            {label && <span className="hidden sm:inline text-sm font-medium text-gray-200">{label}:</span>}
            <span className={`text-sm font-semibold font-mono ${valueClass}`}>{value}</span>
        </div>
    </div>
);

const StatusBar: React.FC<StatusBarProps> = ({ stats, modelName, isAiConnected, onNavigateToSettings, onOpenAuditLog, onOpenChat }) => {
    const { t } = useTranslation();
    if (!stats) return null;

    const isUsingOverrideKey = !!settingsService.getSessionApiKey();
    const tokenUsage = statsService.getTokenUsage();
    const totalTokens = tokenUsage.used;
    const usagePercentage = isUsingOverrideKey ? 0 : (tokenUsage.used / tokenUsage.limit) * 100;

    let tokenColorClass = 'text-orange-300';
    if (usagePercentage > 90) {
        tokenColorClass = 'text-red-400';
    } else if (usagePercentage > 75) {
        tokenColorClass = 'text-yellow-400';
    }

    const tokenTooltip = isUsingOverrideKey 
        ? `Using personal API key. Usage not tracked against shared limit.`
        : `Shared Limit: ${tokenUsage.used.toLocaleString()} / ${tokenUsage.limit.toLocaleString()} tokens used.`;

    return (
        <footer className="fixed bottom-0 left-0 right-0 h-12 bg-gray-900/80 backdrop-blur-md border-t border-gray-700 z-40">
            <div className="container mx-auto h-full flex items-center justify-between px-4">
                {/* Left Side */}
                <div className="flex items-center gap-3">
                    <span title={t('aiStatusTitle')} className="text-lg">✨</span>
                    {isAiConnected && modelName && (
                        <button
                            onClick={onNavigateToSettings}
                            title={t('changeModelTooltip')}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <StatItem
                                icon={<ChipIcon className="w-4 h-4" />}
                                value={modelName}
                                tooltip=""
                                valueClass="text-cyan-300 truncate max-w-[80px] sm:max-w-[150px]"
                            />
                        </button>
                    )}
                    <div className="w-px h-5 bg-gray-700"></div>
                    <button onClick={onOpenChat} title={t('chatTitle')} className="text-gray-400 hover:text-white">
                        <ChatIcon className="w-5 h-5" />
                    </button>
                    <button onClick={onOpenAuditLog} title={t('auditLogTitle')} className="text-gray-400 hover:text-white">
                        <AuditLogIcon className="w-5 h-5" />
                    </button>
                </div>
                {/* Right Side */}
                <div className="flex items-center gap-3 md:gap-4">
                    <StatItem
                        icon={<TokenIcon className="w-4 h-4" />}
                        value={totalTokens.toLocaleString()}
                        tooltip={tokenTooltip}
                        valueClass={tokenColorClass}
                    />
                    <StatItem
                        icon={<MoneyIcon className="w-4 h-4" />}
                        value={stats.totalCost.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 })}
                        tooltip="Estimated cost based on gemini-2.5-flash pricing. Other models may vary."
                    />
                    <StatItem
                        icon={<TimeIcon className="w-4 h-4" />}
                        value={formatTime(stats.timePlayedInSeconds)}
                        tooltip={t('playTime')}
                    />
                </div>
            </div>
        </footer>
    );
};

export default StatusBar;