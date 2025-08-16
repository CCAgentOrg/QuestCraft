

import React, { useState, useCallback, useEffect } from 'react';
import type { QuestConfig, AppStats, Page, LoadedQuest, AiProviderSettings } from './types';
import { statsService, STATS_UPDATED_EVENT } from './services/statsService';
import { aiConnectivityService, CONNECTIVITY_UPDATED_EVENT } from './services/aiConnectivityService';
import { settingsService, SETTINGS_UPDATED_EVENT, PROVIDER_CONFIGS } from './services/settingsService';
import { testConnection } from './services/aiService';
import { gameStateService } from './services/gameStateService';
import { DEFAULT_QUEST_PATHS } from './constants';
import Drawer from './components/Drawer';
import SettingsPage from './components/SettingsDrawer';
import StatusBar from './components/StatusBar';
import WelcomeScreen from './components/WelcomeScreen';
import GamePage from './components/GamePage';
import QuestMakerPage from './components/QuestMakerWizard';
import DocsPage from './components/DocsPage';
import Header from './components/Header';
import HamburgerMenu from './components/HamburgerMenu';
import AIAuditLogDrawer from './components/AIAuditLogDrawer';
import ChatDrawer from './components/ChatDrawer';
import HomePage from './components/HomePage';
import { getLocalizedString } from './utils/localization';
import { useTranslation } from './services/i18n';
import { logger } from './services/logger';

const CUSTOM_QUESTS_STORAGE_KEY = 'questcraft-custom-quests';
const ACTIVE_QUEST_CONFIG_KEY = 'questcraft-active-quest';
const CURRENT_PAGE_KEY = 'questcraft-current-page';

// Check environment variable to disable maker mode
const isMakerModeEnabled = process.env.MAKER_MODE_DISABLED !== 'true';

const getCustomQuestsFromStorage = (): QuestConfig[] => {
    try {
        const questsJson = localStorage.getItem(CUSTOM_QUESTS_STORAGE_KEY);
        return questsJson ? JSON.parse(questsJson) : [];
    } catch (e) {
        console.error("Failed to parse custom quests from localStorage", e);
        return [];
    }
};

const saveCustomQuestsToStorage = (quests: QuestConfig[]) => {
    try {
        localStorage.setItem(CUSTOM_QUESTS_STORAGE_KEY, JSON.stringify(quests));
    } catch (e) {
        console.error("Failed to save custom quests to localStorage", e);
    }
};

const App: React.FC = () => {
    const { t } = useTranslation();
    const [page, setPage] = useState<Page>('home');
    const [questConfig, setQuestConfig] = useState<QuestConfig | null>(null);
    const [draftQuestForChat, setDraftQuestForChat] = useState<QuestConfig | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [openDrawerContent, setOpenDrawerContent] = useState<{title: string, content: string} | null>(null);
    const [customQuests, setCustomQuests] = useState<QuestConfig[]>([]);
    const [defaultQuests, setDefaultQuests] = useState<LoadedQuest[]>([]);
    const [appStats, setAppStats] = useState<AppStats>(statsService.getStats());
    const [aiSettings, setAiSettings] = useState<AiProviderSettings>(settingsService.getAiSettings());
    const [isAiConnected, setIsAiConnected] = useState(aiConnectivityService.isConnected());
    const [showAuditLog, setShowAuditLog] = useState(false);
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        // Load state from localStorage on initial mount
        const savedPage = localStorage.getItem(CURRENT_PAGE_KEY) as Page | null;
        const savedQuestJson = localStorage.getItem(ACTIVE_QUEST_CONFIG_KEY);
        const savedQuestConfig = savedQuestJson ? JSON.parse(savedQuestJson) : null;
        
        setCustomQuests(getCustomQuestsFromStorage());

        const loadDefaultQuests = async () => {
            try {
                const questsPromises = DEFAULT_QUEST_PATHS.map(async (filePath) => {
                    const response = await fetch(filePath);
                    if (!response.ok) {
                        console.error(`Failed to fetch quest: ${filePath}`);
                        return null;
                    }
                    const config: QuestConfig = await response.json();
                    return { filePath, config };
                });

                const loadedQuests = (await Promise.all(questsPromises)).filter((q): q is LoadedQuest => q !== null);
                setDefaultQuests(loadedQuests);
            } catch (error) {
                console.error("Error loading default quests:", error);
            }
        };
        
        loadDefaultQuests();

        // Test connection on mount to set initial status
        const testInitialConnection = async () => {
            try {
                const currentSettings = settingsService.getAiSettings();
                await testConnection(currentSettings);
                aiConnectivityService.setConnected(true);
            } catch (error) {
                console.warn("Initial AI connection test failed:", error);
                aiConnectivityService.setConnected(false);
            }
        };
        testInitialConnection();


        if (savedQuestConfig) {
            setQuestConfig(savedQuestConfig);
            // If a game is active, always go to the game page
            setPage('game');
        } else if (savedPage) {
            setPage(savedPage);
        } else {
            setPage('home'); // Default to the home page
        }

        // Add event listeners
        const handleStatsUpdate = () => setAppStats(statsService.getStats());
        const handleConnectivityUpdate = () => setIsAiConnected(aiConnectivityService.isConnected());
        const handleSettingsUpdate = () => setAiSettings(settingsService.getAiSettings());

        window.addEventListener(STATS_UPDATED_EVENT, handleStatsUpdate);
        window.addEventListener(CONNECTIVITY_UPDATED_EVENT, handleConnectivityUpdate);
        window.addEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdate);
        return () => {
            window.removeEventListener(STATS_UPDATED_EVENT, handleStatsUpdate);
            window.removeEventListener(CONNECTIVITY_UPDATED_EVENT, handleConnectivityUpdate);
            window.removeEventListener(SETTINGS_UPDATED_EVENT, handleSettingsUpdate);
        };
    }, []);
    
    useEffect(() => {
        // Persist page state, but don't save 'game' page to avoid getting stuck
        if (page !== 'game') {
            localStorage.setItem(CURRENT_PAGE_KEY, page);
        }
    }, [page]);

    useEffect(() => {
        let timerId: number | undefined;
        if (page === 'game') {
            timerId = window.setInterval(() => {
                statsService.incrementTimePlayed();
            }, 1000);
        }
        return () => clearInterval(timerId);
    }, [page]);
    
    const handleExitGameWithConfirm = useCallback(() => {
        const confirmed = window.confirm(t('confirmEndGame'));
        setIsMenuOpen(false); // Always close menu if action originated from there

        if (confirmed) {
            setQuestConfig(null);
            gameStateService.clear();
            localStorage.removeItem(ACTIVE_QUEST_CONFIG_KEY);
            setPage('home');
        }
    }, [t]);

    const handleExitGameImmediate = useCallback(() => {
        // For failsafe exits where no confirmation is needed
        setQuestConfig(null);
        gameStateService.clear();
        localStorage.removeItem(ACTIVE_QUEST_CONFIG_KEY);
        setPage('home');
    }, []);

    const handleNavigate = useCallback((targetPage: Page) => {
        if (targetPage === 'maker' && !isMakerModeEnabled) return;

        if (page === 'game' && (targetPage === 'home' || targetPage === 'welcome')) {
            handleExitGameWithConfirm();
            return;
        }
        if (page === 'maker' && targetPage !== 'maker') {
            const confirmed = !draftQuestForChat || window.confirm("You have an unsaved quest draft. Are you sure you want to leave the Quest Maker? Your draft will be lost.");
            if (!confirmed) {
                setIsMenuOpen(false);
                return;
            }
            setDraftQuestForChat(null); // Clear draft context when leaving maker
        }
        logger.info(`[App] Navigating from page "${page}" to "${targetPage}"`);
        setPage(targetPage);
        setIsMenuOpen(false);
    }, [page, draftQuestForChat, handleExitGameWithConfirm]);

    const handleLoadQuest = useCallback((config: QuestConfig, fromUserAction: boolean = false) => {
        logger.info(`[App] Loading quest: "${getLocalizedString(config.name, 'en')}"`);
        if (fromUserAction && isMakerModeEnabled) {
            const newQuests = getCustomQuestsFromStorage();
            const questName = getLocalizedString(config.name, 'en');
            const existingIndex = newQuests.findIndex(q => getLocalizedString(q.name, 'en') === questName);
            if (existingIndex > -1) {
                newQuests[existingIndex] = config;
            } else {
                newQuests.push(config);
            }
            saveCustomQuestsToStorage(newQuests);
            setCustomQuests(newQuests);
        }
        setDraftQuestForChat(null); // Clear draft when loading a quest
        setQuestConfig(config);
        localStorage.setItem(ACTIVE_QUEST_CONFIG_KEY, JSON.stringify(config));
        gameStateService.clear(); // Clear any previous game's state
        handleNavigate('game');
    }, [isMakerModeEnabled, handleNavigate]);

    const handleDeleteQuest = (questName: string) => {
        if (isMakerModeEnabled && window.confirm(`Are you sure you want to delete the quest "${questName}"? This cannot be undone.`)) {
            const newQuests = customQuests.filter(q => getLocalizedString(q.name, 'en') !== questName);
            saveCustomQuestsToStorage(newQuests);
            setCustomQuests(newQuests);
        }
    };

    const handleResetStats = useCallback(() => {
        if (window.confirm(t('resetStatsConfirmation'))) {
            statsService.resetStats();
            // Force a state update to ensure UI reflects the change immediately
            setAppStats(statsService.getStats());
        }
    }, [t]);

    const handleApplyQuestUpdate = useCallback((updatedConfig: QuestConfig) => {
        setDraftQuestForChat(updatedConfig);
    }, []);

    const renderPage = () => {
        switch (page) {
            case 'game':
                if (!questConfig) {
                    handleExitGameImmediate();
                    return null;
                }
                return <GamePage 
                            questConfig={questConfig} 
                            onExit={handleExitGameImmediate} 
                            onOpenFooterDrawer={setOpenDrawerContent}
                        />;
            case 'maker':
                if (!isMakerModeEnabled) {
                    return <HomePage onNavigate={handleNavigate} isMakerModeEnabled={isMakerModeEnabled} />;
                }
                return <QuestMakerPage
                            draftQuest={draftQuestForChat}
                            onLoadQuest={(config) => handleLoadQuest(config, true)}
                            onDraftUpdate={setDraftQuestForChat}
                        />;
            case 'docs':
                return <DocsPage />;
            case 'settings':
                return <SettingsPage 
                            customQuests={customQuests}
                            defaultQuests={defaultQuests}
                            onDeleteQuest={handleDeleteQuest} 
                            onOpenAuditLog={() => setShowAuditLog(true)}
                            onResetStats={handleResetStats}
                            isMakerModeEnabled={isMakerModeEnabled}
                        />;
            case 'welcome':
                return <WelcomeScreen 
                            customQuests={customQuests}
                            defaultQuests={defaultQuests}
                            onLoadQuest={handleLoadQuest} 
                            isMakerModeEnabled={isMakerModeEnabled}
                        />;
            case 'home':
            default:
                 return <HomePage onNavigate={handleNavigate} isMakerModeEnabled={isMakerModeEnabled} />;
        }
    };
    
    const modelDisplayName = aiSettings.providerId === 'community' 
        ? PROVIDER_CONFIGS.community.name 
        : aiSettings.model;

    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 font-sans antialiased">
            <HamburgerMenu 
                isOpen={isMenuOpen} 
                onClose={() => setIsMenuOpen(false)} 
                onNavigate={handleNavigate}
                currentPage={page}
                isMakerModeEnabled={isMakerModeEnabled}
            />
            <div className="flex-1 flex flex-col overflow-hidden transition-transform duration-300 ease-in-out" style={{ transform: isMenuOpen ? 'translateX(16rem)' : 'translateX(0)' }}>
                <Header 
                    onMenuClick={() => setIsMenuOpen(true)}
                    page={page}
                    questConfig={questConfig}
                    onExitGame={handleExitGameWithConfirm}
                    onOpenFooterDrawer={setOpenDrawerContent}
                />
                <main className="flex-1 overflow-y-auto">
                    {renderPage()}
                </main>
                <StatusBar 
                    stats={appStats}
                    modelName={modelDisplayName}
                    isAiConnected={isAiConnected}
                    onNavigateToSettings={() => handleNavigate('settings')}
                    onOpenAuditLog={() => setShowAuditLog(true)}
                    onOpenChat={() => setShowChat(true)}
                />
            </div>
            <Drawer
                show={!!openDrawerContent}
                title={openDrawerContent?.title || ''}
                onClose={() => setOpenDrawerContent(null)}
            >
                <div dangerouslySetInnerHTML={{ __html: openDrawerContent?.content || '' }} />
            </Drawer>
            <AIAuditLogDrawer show={showAuditLog} onClose={() => setShowAuditLog(false)} />
            <ChatDrawer 
                show={showChat}
                onClose={() => setShowChat(false)}
                page={page}
                questConfig={questConfig}
                draftQuest={draftQuestForChat}
                onApplyQuestUpdate={handleApplyQuestUpdate}
            />
        </div>
    );
};

export default App;