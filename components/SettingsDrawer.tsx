import React, { useState, useEffect } from 'react';
import AIAuditLogDrawer from './AIAuditLogDrawer';
import type { QuestConfig, AiProviderSettings, AiProviderId, LanguageCode, LoadedQuest } from '../types';
import { statsService } from '../services/statsService';
import { settingsService, PROVIDER_CONFIGS } from '../services/settingsService';
import { aiConnectivityService } from '../services/aiConnectivityService';
import { testConnection } from '../services/aiService';
import { useTranslation } from '../services/i18n';
import { getLocalizedString } from '../utils/localization';

interface SettingsPageProps {
    customQuests: QuestConfig[];
    defaultQuests: LoadedQuest[];
    onDeleteQuest: (questName: string) => void;
    onOpenAuditLog: () => void;
    onResetStats: () => void;
    isMakerModeEnabled: boolean;
}

interface OpenRouterModel {
    id: string;
    name: string;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ 
    customQuests,
    defaultQuests,
    onDeleteQuest,
    onOpenAuditLog,
    onResetStats,
    isMakerModeEnabled,
}) => {
    const { t, language, setLanguage } = useTranslation();
    const [aiSettings, setAiSettings] = useState<AiProviderSettings>(settingsService.getAiSettings());
    const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState<string>('');

    useEffect(() => {
        setAiSettings(settingsService.getAiSettings());
        const connected = aiConnectivityService.isConnected();
        setTestStatus(connected ? 'success' : 'idle');
        setTestMessage(connected ? t('connectionSuccess') : '');
    }, []);
    
    useEffect(() => {
        setTestStatus('idle');
        setTestMessage('');
        aiConnectivityService.setConnected(false);
    }, [aiSettings.providerId, aiSettings.model, aiSettings.baseUrl]);

    useEffect(() => {
        if (aiSettings.providerId === 'openrouter') {
            setIsLoadingModels(true);
            fetch('https://openrouter.ai/api/v1/models')
              .then(res => res.json())
              .then(data => {
                const models: OpenRouterModel[] = data.data.map((model: any) => ({ id: model.id, name: model.name }));
                models.sort((a, b) => a.name.localeCompare(b.name));
                setOpenRouterModels(models);
              })
              .catch(err => console.error("Failed to fetch OpenRouter models", err))
              .finally(() => setIsLoadingModels(false));
        }
    }, [aiSettings.providerId]);

    const handleProviderChange = (providerId: AiProviderId) => {
        const config = PROVIDER_CONFIGS[providerId];
        setAiSettings({
            providerId,
            model: config.defaultModel,
            baseUrl: config.baseUrl || ''
        });
    };

    const handleSettingsFieldChange = <K extends keyof AiProviderSettings>(key: K, value: AiProviderSettings[K]) => {
        setAiSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleTestConnection = async () => {
        setTestStatus('testing');
        setTestMessage('');
        try {
            await testConnection(aiSettings);
            setTestStatus('success');
            setTestMessage(t('connectionSuccess'));
            aiConnectivityService.setConnected(true);
        } catch (e: any) {
            setTestStatus('error');
            setTestMessage(t('connectionFailed', { error: e.message }));
            aiConnectivityService.setConnected(false);
            console.error(e);
        }
    };

    const handleSaveAiSettings = () => {
        settingsService.saveAiSettings(aiSettings);
        alert(t('settingsSaved'));
    };

    const handleResetApp = () => {
        if (window.confirm(t('resetAppConfirmation'))) {
            localStorage.clear();
            window.location.reload();
        }
    };

    const downloadQuestJson = (quest: QuestConfig) => {
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(quest, null, 2))}`;
        const link = document.createElement('a');
        link.href = jsonString;
        link.download = `${getLocalizedString(quest.name, 'en').toLowerCase().replace(/\s/g, '-')}-quest.json`;
        link.click();
    };
    
    const handleCopyQuestJson = (quest: QuestConfig) => {
        const jsonString = JSON.stringify(quest, null, 2);
        navigator.clipboard.writeText(jsonString).then(() => {
            alert(t('jsonCopied', { questName: getLocalizedString(quest.name, language) }));
        }, (err) => {
            alert('Failed to copy JSON. See console for details.');
            console.error('Failed to copy: ', err);
        });
    };

    const isBaseUrlEditable = aiSettings.providerId !== 'gemini' && aiSettings.providerId !== 'openai';

    return (
        <div className="p-4 md:p-8 space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-orange-400 mb-1">{t('settingsTitle')}</h2>
                <p className="text-gray-400">{t('settingsDescription')}</p>
            </div>
            
            <section>
                <h3 className="text-lg font-medium text-white mb-4">{t('language')}</h3>
                 <div className="space-y-4 bg-gray-800 p-4 rounded-lg">
                    <select
                        id="language-selector"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
                        className="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2"
                    >
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="hi">हिन्दी</option>
                        <option value="ta">தமிழ்</option>
                    </select>
                 </div>
            </section>

            {isMakerModeEnabled && (
                <section>
                    <h3 className="text-lg font-medium text-white mb-4">{t('aiConfig')}</h3>
                    <div className="space-y-4 bg-gray-800 p-4 rounded-lg">
                        <p className="text-sm text-gray-400">{t('apiKeyDescription')}</p>
                        <div>
                            <label htmlFor="ai-provider" className="block text-sm font-medium text-gray-300">{t('provider')}</label>
                            <select
                                id="ai-provider"
                                value={aiSettings.providerId}
                                onChange={(e) => handleProviderChange(e.target.value as AiProviderId)}
                                className="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2"
                            >
                                {Object.values(PROVIDER_CONFIGS).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {aiSettings.providerId === 'openrouter' ? (
                            <div>
                                <label htmlFor="model-name" className="block text-sm font-medium text-gray-300">{t('modelName')}</label>
                                <select
                                    id="model-name"
                                    value={aiSettings.model}
                                    onChange={(e) => handleSettingsFieldChange('model', e.target.value)}
                                    className="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2"
                                    disabled={isLoadingModels}
                                >
                                    {isLoadingModels ? (
                                        <option>Loading models...</option>
                                    ) : (
                                        openRouterModels.map(model => (
                                            <option key={model.id} value={model.id}>{model.name}</option>
                                        ))
                                    )}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">{t('groundInRealityModelHint')}</p>
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="model-name" className="block text-sm font-medium text-gray-300">{t('modelName')}</label>
                                <input
                                    type="text"
                                    id="model-name"
                                    value={aiSettings.model}
                                    onChange={(e) => handleSettingsFieldChange('model', e.target.value)}
                                    className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md p-2"
                                    placeholder="e.g., gemini-2.5-flash or gpt-4o"
                                />
                            </div>
                        )}

                        <div>
                            <label htmlFor="base-url" className="block text-sm font-medium text-gray-300">{t('baseUrl')}</label>
                            <input
                                type="text"
                                id="base-url"
                                value={aiSettings.baseUrl || ''}
                                onChange={(e) => handleSettingsFieldChange('baseUrl', e.target.value)}
                                className={`mt-1 block w-full bg-gray-700 border-gray-600 rounded-md p-2 ${!isBaseUrlEditable ? 'opacity-50 cursor-not-allowed' : ''}`}
                                placeholder="e.g., https://api.groq.com/openai/v1"
                                readOnly={!isBaseUrlEditable}
                            />
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <button 
                                    onClick={handleTestConnection} 
                                    disabled={testStatus === 'testing'}
                                    className="w-full sm:w-auto flex-grow bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-wait text-white font-bold py-2 px-4 rounded-lg transition"
                                >
                                    {testStatus === 'testing' ? t('testing') : t('testConnectivity')}
                                </button>
                                <button 
                                    onClick={handleSaveAiSettings} 
                                    className="w-full sm:w-auto flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg"
                                >
                                    {t('saveAiSettings')}
                                </button>
                            </div>
                            {testMessage && (
                                <div 
                                    className={`text-sm text-center p-2 rounded-md ${
                                        testStatus === 'success' ? 'bg-green-900/50 text-green-300' : ''
                                    } ${
                                        testStatus === 'error' ? 'bg-red-900/50 text-red-300' : ''
                                    }`}
                                >
                                    {testMessage}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}

            <section className="border-t border-gray-600 pt-6">
                <h3 className="text-lg font-medium text-white mb-4">{t('questManagement')}</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 bg-gray-800 p-4 rounded-lg">
                    {customQuests.map(quest => (
                        <div key={getLocalizedString(quest.name, 'en')} className="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
                            <div>
                                <p className="font-semibold text-white">{getLocalizedString(quest.name, language)}</p>
                                <p className="text-xs text-purple-400">{t('customQuest')}</p>
                            </div>
                            {isMakerModeEnabled && (
                                <div className="flex items-center gap-2">
                                    <button onClick={() => downloadQuestJson(quest)} className="p-2 text-gray-300 hover:text-white" aria-label={`Download ${getLocalizedString(quest.name, language)}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    </button>
                                    <button onClick={() => handleCopyQuestJson(quest)} className="p-2 text-gray-300 hover:text-white" aria-label={`Copy JSON for ${getLocalizedString(quest.name, language)}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                    <button onClick={() => onDeleteQuest(getLocalizedString(quest.name, 'en'))} className="p-2 text-red-400 hover:text-red-300" aria-label={`Delete ${getLocalizedString(quest.name, language)}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {defaultQuests.map(quest => (
                         <div key={quest.filePath} className="flex items-center justify-between bg-gray-700/50 p-3 rounded-lg">
                            <div>
                                <p className="font-semibold text-white">{getLocalizedString(quest.config.name, language)}</p>
                                <p className="text-xs text-gray-400">{t('defaultQuest')}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
             
             <section className="border-t border-gray-600 pt-6">
                <h3 className="text-lg font-medium text-white mb-2">{t('statistics')}</h3>
                 <div className="flex flex-col items-start space-y-3 bg-gray-800 p-4 rounded-lg">
                    <p className="text-sm text-gray-400">{t('resetStatsDescription')}</p>
                     <button
                        onClick={onResetStats}
                        className="bg-yellow-800 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-lg transition"
                    >
                        {t('resetStats')}
                    </button>
                 </div>
            </section>

            <section className="border-t border-gray-600 pt-6">
                <h3 className="text-lg font-medium text-white mb-2">{t('appManagement')}</h3>
                 <div className="space-y-4 bg-gray-800 p-4 rounded-lg">
                    {isMakerModeEnabled && (
                        <div>
                            <p className="text-sm text-gray-400 mb-2">{t('auditLogCta')}</p>
                            <button
                                onClick={onOpenAuditLog}
                                className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition"
                            >
                                {t('viewAuditLog')}
                            </button>
                        </div>
                    )}
                    <div className={isMakerModeEnabled ? "border-t border-gray-700 pt-4" : ""}>
                        <p className="text-sm text-gray-400 mb-2">{t('resetAppDescription')}</p>
                        <button
                            onClick={handleResetApp}
                            className="bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition"
                        >
                            {t('resetApp')}
                        </button>
                    </div>
                 </div>
            </section>
        </div>
    );
};

export default SettingsPage;