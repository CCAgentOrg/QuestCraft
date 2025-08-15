import React, { useState, useCallback } from 'react';
import type { QuestConfig, Page, LoadedQuest } from '../types';
import { useTranslation } from '../services/i18n';
import { getLocalizedString } from '../utils/localization';

interface WelcomeScreenProps {
    customQuests: QuestConfig[];
    defaultQuests: LoadedQuest[];
    onLoadQuest: (config: QuestConfig, fromUserAction?: boolean) => void;
    isMakerModeEnabled: boolean;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
    customQuests, 
    defaultQuests,
    onLoadQuest, 
    isMakerModeEnabled,
}) => {
    const { t, language } = useTranslation();
    const [jsonInput, setJsonInput] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [jsonError, setJsonError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLoadFromUrl = useCallback(async () => {
        if (!urlInput) {
            setJsonError('Please paste a URL.');
            return;
        }
    
        setIsLoading(true);
        setJsonError('');
    
        try {
            let questConfigUrl = urlInput;
            const gistIdMatch = urlInput.match(/(?:https?:\/\/)?gist\.github\.com\/(?:[^\/]+\/)?([a-f0-9]+)/);
            if (gistIdMatch?.[1]) {
                const gistId = gistIdMatch[1];
                const apiResponse = await fetch(`https://api.github.com/gists/${gistId}`);
                if (!apiResponse.ok) throw new Error(`GitHub API error! status: ${apiResponse.status}`);
                const gistData = await apiResponse.json();
                const jsonFile = Object.values(gistData.files).find((file: any) => file.filename.endsWith('.json')) as { raw_url: string } | undefined;
                if (!jsonFile?.raw_url) throw new Error('No .json file found in this Gist.');
                questConfigUrl = jsonFile.raw_url;
            }
    
            const questResponse = await fetch(questConfigUrl);
            if (!questResponse.ok) throw new Error(`Failed to fetch quest from URL: ${questResponse.status}`);
            const config = await questResponse.json();
            
            if (config.name && config.board && config.resources) {
                onLoadQuest(config, true);
                setJsonError('');
            } else {
                throw new Error('Invalid quest format from URL. Missing required fields.');
            }
        } catch (e: any) {
            console.error(e);
            setJsonError(`Failed to load quest from URL: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [urlInput, onLoadQuest]);

    const handleJsonLoad = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            if (parsed.name && parsed.board && parsed.resources) {
                onLoadQuest(parsed, true);
                setJsonError('');
            } else {
                setJsonError('Invalid quest format. Missing required fields.');
            }
        } catch (error) {
            setJsonError('Invalid JSON. Please check the syntax.');
        }
    };

    return (
        <div className="min-h-full flex flex-col justify-center bg-gray-900 p-4">
            <div className="w-full bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 relative">
                {isLoading && <div className="absolute inset-0 bg-gray-800/80 flex items-center justify-center rounded-2xl z-10"><p className="text-white text-lg animate-pulse">{t('loadingQuest')}</p></div>}
                
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {/* Left Side: Load */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold text-lg mb-2">{t('loadFromUrl')}</h3>
                                <div className="flex gap-2">
                                     <input
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        className="flex-grow p-2 bg-gray-900 border border-gray-600 rounded-lg font-mono text-sm"
                                        placeholder={t('urlPlaceholder')}
                                    />
                                    <button onClick={handleLoadFromUrl} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">{t('load')}</button>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg mb-2">{t('orPasteJson')}</h3>
                                <textarea
                                    value={jsonInput}
                                    onChange={(e) => setJsonInput(e.target.value)}
                                    className="w-full h-24 p-2 bg-gray-900 border border-gray-600 rounded-lg font-mono text-sm"
                                    placeholder={t('jsonPlaceholder')}
                                />
                                <button onClick={handleJsonLoad} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">{t('loadFromJson')}</button>
                            </div>
                            {jsonError && <p className="text-red-400 text-sm mt-1">{jsonError}</p>}
                        </div>
                    </div>

                    {/* Right Side: Quest List */}
                    <div className="lg:col-span-3">
                         <h2 className="text-2xl font-bold text-white mb-4">{t('playAQuest')}</h2>
                         <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                             {customQuests.map(quest => (
                                <button key={getLocalizedString(quest.name, 'en')} onClick={() => onLoadQuest(quest, false)} className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-semibold text-lg">{getLocalizedString(quest.name, language)}</h3>
                                        <span className="text-xs font-medium bg-purple-600 text-white px-2 py-1 rounded-full">{t('custom')}</span>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">{getLocalizedString(quest.description, language)}</p>
                                </button>
                            ))}
                            {defaultQuests.map(quest => (
                                <button key={quest.filePath} onClick={() => onLoadQuest(quest.config, false)} className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
                                    <h3 className="font-semibold text-lg">{getLocalizedString(quest.config.name, language)}</h3>
                                    <p className="text-sm text-gray-400 mt-1">{getLocalizedString(quest.config.description, language)}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomeScreen;