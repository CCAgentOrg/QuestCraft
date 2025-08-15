
import React from 'react';
import type { Page } from '../types';
import { useTranslation } from '../services/i18n';
import { SettingsIcon, DocsIcon, MakerIcon } from '../constants';

interface HamburgerMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (page: Page) => void;
    currentPage: Page;
    isMakerModeEnabled: boolean;
}

const HomeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
);

const NavItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    page: Page;
    currentPage: Page;
    onNavigate: (page: Page) => void;
}> = ({ icon, label, page, currentPage, onNavigate }) => {
    const isActive = currentPage === page;
    return (
        <button
            onClick={() => onNavigate(page)}
            className={`w-full flex items-center gap-4 p-3 rounded-lg text-left transition-colors ${
                isActive ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
            }`}
        >
            {icon}
            <span className="font-semibold">{label}</span>
        </button>
    );
};

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ isOpen, onClose, onNavigate, currentPage, isMakerModeEnabled }) => {
    const { t } = useTranslation();

    return (
        <>
            {/* Overlay */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            />

            {/* Menu */}
            <nav
                className={`fixed top-0 left-0 h-full w-64 bg-gray-800 border-r border-gray-700 p-4 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-orange-400 font-mono">{t('questCraftTitle')}</h1>
                </div>

                <div className="space-y-3">
                    <NavItem icon={<HomeIcon />} label={t('menuHome')} page="home" currentPage={currentPage} onNavigate={onNavigate} />
                    {isMakerModeEnabled && (
                        <NavItem icon={<MakerIcon className="h-6 w-6" />} label={t('menuMaker')} page="maker" currentPage={currentPage} onNavigate={onNavigate} />
                    )}
                    <NavItem icon={<DocsIcon className="w-6 h-6" />} label={t('menuDocs')} page="docs" currentPage={currentPage} onNavigate={onNavigate} />
                    <NavItem icon={<SettingsIcon className="w-6 h-6" />} label={t('menuSettings')} page="settings" currentPage={currentPage} onNavigate={onNavigate} />
                </div>
            </nav>
        </>
    );
};

export default HamburgerMenu;