import React from 'react';
import type { Page } from '../types';
import { useTranslation } from '../services/i18n';
import { PlayIcon, MakerIcon } from '../constants';

interface HomePageProps {
    onNavigate: (page: Page) => void;
    isMakerModeEnabled: boolean;
}

const ModeCard = ({ title, description, icon, onClick, colorClass }: { title: string, description: string, icon: React.ReactNode, onClick: () => void, colorClass: string }) => (
    <button 
        onClick={onClick} 
        className="group bg-gray-800 border border-gray-700 rounded-xl p-6 text-center transition-all duration-300 hover:border-gray-500 hover:bg-gray-700/50 hover:shadow-2xl"
    >
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors duration-300 bg-gray-700/50 group-hover:bg-gray-700 ${colorClass}`}>
            {icon}
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400">{description}</p>
    </button>
);

const HomePage: React.FC<HomePageProps> = ({ onNavigate, isMakerModeEnabled }) => {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center h-full p-4 md:p-8 text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-orange-400 font-mono mb-2">{t('questCraftTitle')}</h1>
            <p className="text-lg text-gray-400 mb-12">{t('homeTitle')}</p>
            <div className={`grid grid-cols-1 ${isMakerModeEnabled ? 'md:grid-cols-2' : 'md:grid-cols-1'} gap-8 w-full`}>
                <ModeCard
                    onClick={() => onNavigate('welcome')}
                    title={t('playerMode')}
                    description={t('playerModeDescription')}
                    icon={<PlayIcon className="w-8 h-8 text-white" />}
                    colorClass="group-hover:bg-green-600"
                />
                {isMakerModeEnabled && (
                    <ModeCard
                        onClick={() => onNavigate('maker')}
                        title={t('makerMode')}
                        description={t('makerModeDescription')}
                        icon={<MakerIcon className="w-8 h-8 text-white" />}
                        colorClass="group-hover:bg-indigo-600"
                    />
                )}
            </div>
        </div>
    );
};

export default HomePage;