

import React from 'react';
import { useTranslation } from '../services/i18n';
import type { Page, QuestConfig } from '../types';
import { getLocalizedString } from '../utils/localization';

interface HeaderProps {
    onMenuClick: () => void;
    page: Page;
    questConfig: QuestConfig | null;
    onExitGame: () => void;
    onOpenFooterDrawer: (drawerContent: { title: string, content: string }) => void;
    onNavigate: (page: Page) => void;
}

const MenuIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);
  
const Header: React.FC<HeaderProps> = ({ onMenuClick, page, questConfig, onExitGame, onOpenFooterDrawer, onNavigate }) => {
    const { t, language } = useTranslation();

    const renderGameButtons = () => {
        if (page !== 'game' || !questConfig) return null;
        return (
            <div className="flex items-center gap-2 md:gap-4">
                 {questConfig.footerSections.map(section => (
                     <button key={getLocalizedString(section.title, 'en')} onClick={() => onOpenFooterDrawer({ title: getLocalizedString(section.title, language), content: getLocalizedString(section.content, language)})} className="hidden sm:block text-gray-300 hover:text-white text-sm hover:underline">{getLocalizedString(section.title, language)}</button>
                 ))}
                <button onClick={onExitGame} className="bg-red-600 hover:bg-red-700 text-white font-bold text-sm py-1.5 px-3 md:py-2 md:px-4 rounded-lg transition">{t('endGame')}</button>
            </div>
        )
    }

    return (
        <header className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 h-16 flex items-center justify-between px-4 z-30">
            <div className="flex items-center gap-4">
                <button onClick={onMenuClick} className="text-gray-300 hover:text-white">
                    <MenuIcon />
                </button>
                <button onClick={() => onNavigate('home')} className="text-left hover:opacity-80 transition-opacity" aria-label="Go to Home page">
                    <h1 className="text-xl md:text-2xl font-bold text-orange-400 font-mono truncate">{t('questCraftTitle')}</h1>
                </button>
            </div>
            {renderGameButtons()}
        </header>
    );
};

export default Header;