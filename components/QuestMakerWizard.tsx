import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { QuestConfig, ResourceDefinition, BoardLocation, ScenariosByLocation, ChanceCard, ResourceChange, LanguageCode, ManagedScenario } from '../types';
import { enhanceQuestIdea, generateQuestOutline, generatePregeneratedScenarios, generateRandomQuestIdea } from '../services/aiService';
import { settingsService } from '../services/settingsService';
import { BoardLocationType } from '../types';
import { useTranslation } from '../services/i18n';
import { getLocalizedString } from '../utils/localization';
import { IconMap } from '../constants';
import { logger } from '../services/logger';

interface QuestMakerPageProps {
    onLoadQuest: (questConfig: QuestConfig) => void;
    onDraftUpdate: (draft: QuestConfig | null) => void;
    draftQuest: QuestConfig | null;
}

type WizardStep = 'CONFIG' | 'REFINE' | 'GENERATING' | 'PREVIEW' | 'FINISH';
type RefineStep = 'DETAILS' | 'RESOURCES' | 'BOARD' | 'CARDS';

type GenerationStatus = 'pending' | 'generating' | 'done' | 'error';
interface ScenarioGenerationProgress {
    locationName: string;
    location: BoardLocation;
    status: GenerationStatus;
    error?: string;
}

const LANGUAGES: { code: LanguageCode, name: string }[] = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ta', name: 'Tamil' }
];

const Stepper: React.FC<{
    steps: { name: WizardStep; label: string }[];
    currentStepName: WizardStep;
    onStepClick: (stepName: WizardStep) => void;
    disabled: boolean;
}> = ({ steps, currentStepName, onStepClick, disabled }) => {
    const currentStepIndex = steps.findIndex(s => s.name === currentStepName);

    return (
        <nav className="flex items-center justify-center mb-8" aria-label="Progress">
            <ol role="list" className="flex items-center space-x-2 md:space-x-4">
                {steps.map((step, index) => (
                    <li key={step.name} className="flex items-center">
                        <button
                            onClick={() => onStepClick(step.name)}
                            disabled={disabled || index > currentStepIndex}
                            className={`flex items-center ${index <= currentStepIndex && !disabled ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                index < currentStepIndex ? 'bg-indigo-600 text-white' :
                                index === currentStepIndex ? 'bg-orange-500 text-white ring-2 ring-orange-400' :
                                'bg-gray-700 text-gray-400'
                            }`}>
                                {index < currentStepIndex ? '✓' : index + 1}
                            </div>
                            <span className={`hidden md:block ml-3 text-sm font-medium ${
                                index <= currentStepIndex ? 'text-white' : 'text-gray-500'
                            }`}>{step.label}</span>
                        </button>
                        {index < steps.length - 1 && (
                            <div className={`h-0.5 w-8 md:w-16 mx-2 ${index < currentStepIndex ? 'bg-indigo-500' : 'bg-gray-700'}`} />
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
};

const QuestMakerPage: React.FC<QuestMakerPageProps> = ({ onLoadQuest, onDraftUpdate, draftQuest }) => {
    const { t, language } = useTranslation();
    const [step, setStep] = useState<WizardStep>('CONFIG');
    const [refineStep, setRefineStep] = useState<RefineStep>('DETAILS');
    const [idea, setIdea] = useState('');
    const [numLocations, setNumLocations] = useState(20);
    const [numScenarios, setNumScenarios] = useState(1);
    const [positivity, setPositivity] = useState(0.5);
    const [groundingInReality, setGroundingInReality] = useState(false);
    const [supportedLanguages, setSupportedLanguages] = useState<LanguageCode[]>(['en']);

    const [isLoading, setIsLoading] = useState(false); // For outline generation (overlay)
    const [isSubmittingIdea, setIsSubmittingIdea] = useState(false); // For surprise/enhance
    const [loadingMessage, setLoadingMessage] = useState('');
    const [scenarioProgress, setScenarioProgress] = useState<ScenarioGenerationProgress[]>([]);

    const [jsonText, setJsonText] = useState('');
    const [jsonError, setJsonError] = useState('');

    const debounceTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (draftQuest) {
            setJsonText(JSON.stringify(draftQuest, null, 2));
            setJsonError('');
        }
    }, [draftQuest]);

    const handleJsonTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        setJsonText(newText);
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = window.setTimeout(() => {
            try {
                const parsedQuest = JSON.parse(newText);
                onDraftUpdate(parsedQuest);
                setJsonError('');
            } catch (error) {
                setJsonError('Invalid JSON syntax.');
            }
        }, 500);
    };

    const handleDraftChange = <K extends keyof QuestConfig>(key: K, value: QuestConfig[K]) => {
        if (!draftQuest) return;
        const newDraft = { ...draftQuest, [key]: value };
        onDraftUpdate(newDraft);
    };
    
    const handleEnhanceIdea = async () => {
        if (!idea.trim()) return;
        logger.info('[QuestMaker] User clicked Enhance Idea.');
        setIsSubmittingIdea(true);
        try {
            const enhancedIdea = await enhanceQuestIdea(idea);
            setIdea(enhancedIdea);
        } catch (error: any) {
             if (error.name === 'TokenLimitExceededError') {
                alert(error.message);
            } else {
                alert(`Error enhancing idea: ${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            setIsSubmittingIdea(false);
        }
    };

    const handleSurpriseMe = async () => {
        logger.info('[QuestMaker] User clicked Surprise Me.');
        setIsSubmittingIdea(true);
        try {
            const randomIdea = await generateRandomQuestIdea();
            setIdea(randomIdea);
        } catch (error: any) {
             if (error.name === 'TokenLimitExceededError') {
                alert(error.message);
            } else {
                alert(`Error generating idea: ${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            setIsSubmittingIdea(false);
        }
    };

    const handleGenerateOutline = async () => {
        if (!idea.trim()) { alert("Please enter an idea for your quest."); return; }
        logger.info('[QuestMaker] User clicked Generate Outline.');
        setIsLoading(true);
        setLoadingMessage('Generating quest outline...');
        onDraftUpdate(null);
        setJsonText('');
        setJsonError('');
        try {
            const generatedQuest = await generateQuestOutline(idea, numLocations, positivity, groundingInReality, supportedLanguages);
            onDraftUpdate(generatedQuest);
            setStep('REFINE');
        } catch (error: any) {
            console.error(error);
            if (error.name === 'TokenLimitExceededError') {
                alert(error.message);
            } else {
                alert(`Failed to generate quest outline: ${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const runScenarioGeneration = useCallback(async (locationsToGenerate: BoardLocation[]) => {
        if (!draftQuest) return;

        let finalQuestConfig = draftQuest;
        const { aiRequestDelayMs = 1100 } = settingsService.getAiSettings();
        const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

        for (const location of locationsToGenerate) {
            const locationName = getLocalizedString(location.name, 'en');

            setScenarioProgress(prev => prev.map(p => p.locationName === locationName ? { ...p, status: 'generating', error: undefined } : p));

            try {
                const scenarios = await generatePregeneratedScenarios(draftQuest, location, numScenarios);
                if (scenarios.length > 0) {
                    finalQuestConfig = {
                        ...finalQuestConfig,
                        pregeneratedScenarios: {
                            ...finalQuestConfig.pregeneratedScenarios,
                            [locationName]: scenarios
                        }
                    };
                    onDraftUpdate(finalQuestConfig);
                }
                setScenarioProgress(prev => prev.map(p => p.locationName === locationName ? { ...p, status: 'done' } : p));

            } catch (error: any) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                 if (error.name === 'TokenLimitExceededError') {
                    alert(errorMessage);
                    setStep('REFINE');
                    return;
                }
                console.error(`Failed to generate scenarios for ${locationName}:`, error);
                setScenarioProgress(prev => prev.map(p => p.locationName === locationName ? { ...p, status: 'error', error: errorMessage } : p));
            }

            // Delay only if there are more locations to process
            if (locationsToGenerate.indexOf(location) < locationsToGenerate.length - 1) {
                await delay(aiRequestDelayMs);
            }
        }
    }, [draftQuest, numScenarios, onDraftUpdate]);

    const handleGenerateScenarios = async () => {
        if (!draftQuest || numScenarios === 0) {
            setStep('PREVIEW');
            return;
        }
        logger.info('[QuestMaker] User clicked Generate Scenarios.');
        setStep('GENERATING');
        
        const scenarioLocations = draftQuest.board.locations.filter(loc => (loc.type === BoardLocationType.PROPERTY || loc.type === BoardLocationType.UTILITY));
        
        const initialProgress = scenarioLocations.map(location => ({
            locationName: getLocalizedString(location.name, 'en'),
            location,
            status: 'pending' as GenerationStatus
        }));
        setScenarioProgress(initialProgress);

        // Defer actual generation to allow UI to update to 'GENERATING' step
        setTimeout(() => runScenarioGeneration(scenarioLocations), 100);
    };

    const handleRetryScenario = (location: BoardLocation) => {
        runScenarioGeneration([location]);
    };
    
    const handleDownloadJson = () => {
        if (!draftQuest) return;
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(draftQuest, null, 2))}`;
        const link = document.createElement("a");
        link.href = jsonString;
        const questName = getLocalizedString(draftQuest.name, 'en').toLowerCase().replace(/\s/g, '-') || 'quest';
        link.download = `${questName}.json`;
        link.click();
    };

    const handleCopyJson = () => {
        if (!draftQuest) return;
        navigator.clipboard.writeText(JSON.stringify(draftQuest, null, 2)).then(() => alert(t('copied')));
    };
    
    const handleLanguageToggle = (code: LanguageCode) => {
        setSupportedLanguages(prev => {
            const newLangs = prev.includes(code) ? prev.filter(lang => lang !== code) : [...prev, code];
            return newLangs.length > 0 ? newLangs : prev;
        });
    };

    const handleStepNavigation = (targetStep: WizardStep) => {
        const wizardSteps: WizardStep[] = ['CONFIG', 'REFINE', 'PREVIEW', 'FINISH'];
        const currentStepIndex = wizardSteps.indexOf(step === 'GENERATING' ? 'REFINE' : step);
        const targetStepIndex = wizardSteps.indexOf(targetStep);
    
        if (targetStepIndex >= currentStepIndex) return;
    
        if (step === 'REFINE' && targetStep === 'CONFIG') {
            if (draftQuest && window.confirm(t('confirmDiscardOutline'))) {
                onDraftUpdate(null);
                setJsonText('');
                setStep('CONFIG');
            }
        } else if ((step === 'FINISH' || step === 'PREVIEW') && targetStep === 'REFINE') {
            if (draftQuest && window.confirm(t('confirmDiscardScenarios'))) {
                const newDraft = { ...draftQuest, pregeneratedScenarios: {} };
                onDraftUpdate(newDraft);
                setStep('REFINE');
            }
        } else if (step === 'FINISH' && targetStep === 'CONFIG') {
            if (draftQuest && window.confirm(t('confirmStartOver'))) {
                handleStartOver();
            }
        }
    };
    

    const handleStartOver = () => {
        if (!draftQuest || window.confirm(t('confirmStartOver'))) {
            onDraftUpdate(null);
            setIdea('');
            setStep('CONFIG');
        }
    };

    const wizardSteps: { name: WizardStep; label: string }[] = [
        { name: 'CONFIG', label: t('stepperConfigure') },
        { name: 'REFINE', label: t('stepperRefine') },
        { name: 'PREVIEW', label: t('stepperPreview') },
        { name: 'FINISH', label: t('stepperFinish') },
    ];
    
    const visibleStep = step === 'GENERATING' ? 'REFINE' : step;

    const renderConfigStep = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-orange-400">{t('step1Title')}</h2>
                <p className="text-gray-400">{t('step1Description')}</p>
                <textarea value={idea} onChange={(e) => setIdea(e.target.value)} className="w-full h-40 p-3 bg-gray-900 border border-gray-600 rounded-lg font-mono text-sm" placeholder={t('ideaPlaceholder')} />
                <div className="flex gap-4">
                    <button onClick={handleSurpriseMe} disabled={isLoading || isSubmittingIdea} className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {t('surpriseMe')}
                    </button>
                    <button onClick={handleEnhanceIdea} disabled={!idea.trim() || isLoading || isSubmittingIdea} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">{t('enhance')}</button>
                </div>
            </div>
            <div className="space-y-4 bg-gray-800 p-6 rounded-lg">
                <div>
                    <label htmlFor="num-locations" className="block text-sm font-medium text-gray-300">{t('boardLocations')}</label>
                    <input type="number" id="num-locations" value={numLocations} onChange={e => setNumLocations(parseInt(e.target.value))} step="4" min="12" max="40" className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md p-2" />
                    <p className="text-xs text-gray-500 mt-1">{t('boardLocationsHint')}</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">{t('supportedLanguages')}</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {LANGUAGES.map(lang => (
                            <label key={lang.code} className="flex items-center space-x-2 bg-gray-700 p-2 rounded-md">
                                <input type="checkbox" checked={supportedLanguages.includes(lang.code)} onChange={() => handleLanguageToggle(lang.code)} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-500 bg-gray-900" />
                                <span>{lang.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <label htmlFor="num-scenarios" className="block text-sm font-medium text-gray-300">{t('scenariosPerLocation')}</label>
                    <input type="number" id="num-scenarios" value={numScenarios} onChange={e => setNumScenarios(parseInt(e.target.value))} min="0" max="3" className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md p-2" />
                </div>
                <div>
                    <label htmlFor="positivity" className="block text-sm font-medium text-gray-300">{t('positivityTone')}</label>
                    <input type="range" id="positivity" value={positivity} onChange={e => setPositivity(parseFloat(e.target.value))} min="0" max="1" step="0.1" className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                    <div className="flex justify-between text-xs text-gray-400"><span>{t('dystopian')}</span><span>{t('optimistic')}</span></div>
                </div>
                <div className="flex items-start">
                    <div className="flex items-center h-5"><input id="grounding" type="checkbox" checked={groundingInReality} onChange={e => setGroundingInReality(e.target.checked)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-500 rounded bg-gray-900" /></div>
                    <div className="ml-3 text-sm"><label htmlFor="grounding" className="font-medium text-gray-300">{t('groundInReality')}</label><p className="text-xs text-gray-500">{t('groundInRealityHint')}</p></div>
                </div>
                <button onClick={handleGenerateOutline} disabled={isLoading || isSubmittingIdea} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-500 text-white font-bold py-3 px-4 rounded-lg text-lg">{t('generateOutline')}</button>
            </div>
        </div>
    );

    const renderRefineStep = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
                {!draftQuest ? <p className="text-gray-400">{t('generateOutlineFirst')}</p> : (
                   <div>
                       <div className="mb-4 flex flex-wrap gap-1">
                           <button onClick={() => setRefineStep('DETAILS')} className={`px-3 py-2 text-sm rounded-md ${refineStep === 'DETAILS' ? 'bg-gray-700' : 'bg-gray-800'}`}>{t('details')}</button>
                           <button onClick={() => setRefineStep('RESOURCES')} className={`px-3 py-2 text-sm rounded-md ${refineStep === 'RESOURCES' ? 'bg-gray-700' : 'bg-gray-800'}`}>{t('resources')}</button>
                           <button onClick={() => setRefineStep('BOARD')} className={`px-3 py-2 text-sm rounded-md ${refineStep === 'BOARD' ? 'bg-gray-700' : 'bg-gray-800'}`}>{t('board')}</button>
                           <button onClick={() => setRefineStep('CARDS')} className={`px-3 py-2 text-sm rounded-md ${refineStep === 'CARDS' ? 'bg-gray-700' : 'bg-gray-800'}`}>{t('cards')}</button>
                       </div>
                       <div className="bg-gray-700 p-4 rounded-b-lg rounded-r-lg space-y-4 max-h-[60vh] overflow-y-auto">{renderRefineForm()}</div>
                   </div>
                )}
            </div>
            <div className="space-y-4">
                <h3 className="text-lg font-medium">{t('questOutput')}</h3>
                <textarea value={jsonText} onChange={handleJsonTextChange} className="w-full h-[60vh] p-3 bg-gray-900 border border-gray-600 rounded-lg font-mono text-sm" placeholder={t('jsonOutputPlaceholder')} />
                {jsonError && <p className="text-red-400 text-sm">{jsonError}</p>}
                {draftQuest && (
                    <div className="flex gap-4">
                         <button onClick={() => handleStepNavigation('CONFIG')} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg">{t('back')}</button>
                        <button onClick={handleGenerateScenarios} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg">{t('nextGenerateScenarios')}</button>
                    </div>
                )}
            </div>
        </div>
    );
    
    const renderRefineForm = () => {
        if (!draftQuest) return null;
        switch (refineStep) {
            case 'DETAILS': return (<>
                <div><label className="block text-sm font-medium">{t('questName')}</label><input value={getLocalizedString(draftQuest.name, language)} onChange={e => handleDraftChange('name', { ...draftQuest.name, [language]: e.target.value })} className="mt-1 block w-full bg-gray-800 rounded-md p-2" /></div>
                <div><label className="block text-sm font-medium">{t('description')}</label><textarea value={getLocalizedString(draftQuest.description, language)} onChange={e => handleDraftChange('description', { ...draftQuest.description, [language]: e.target.value })} className="mt-1 block w-full bg-gray-800 rounded-md p-2 h-24" /></div>
            </>);
            case 'RESOURCES': return draftQuest.resources.map((res, index) => (<div key={index} className="bg-gray-800 p-3 rounded-md space-y-2"><h4 className="font-semibold">{t('resource')} {index + 1}</h4><div><label className="text-xs">{t('resourceName')}</label><input value={getLocalizedString(res.name, language)} onChange={e => {const newResources = [...draftQuest.resources];newResources[index].name = { ...newResources[index].name, [language]: e.target.value };handleDraftChange('resources', newResources);}} className="w-full bg-gray-900 rounded-md p-1" /></div><div className="grid grid-cols-2 gap-2"><div><label className="text-xs">{t('icon')}</label><select value={res.icon} onChange={e => {const newResources = [...draftQuest.resources];newResources[index].icon = e.target.value as any;handleDraftChange('resources', newResources);}} className="w-full bg-gray-900 rounded-md p-1">{Object.keys(IconMap).map(iconName => <option key={iconName} value={iconName}>{iconName}</option>)}</select></div><div><label className="text-xs">{t('barColor')}</label><input value={res.barColor} onChange={e => {const newResources = [...draftQuest.resources];newResources[index].barColor = e.target.value;handleDraftChange('resources', newResources);}} className="w-full bg-gray-900 rounded-md p-1" /></div></div><div className="grid grid-cols-3 gap-2 text-center"><div><label className="text-xs">{t('min')}</label><input type="number" value={res.minimumValue ?? 0} onChange={e => {const newResources = [...draftQuest.resources];newResources[index].minimumValue = parseInt(e.target.value);handleDraftChange('resources', newResources);}} className="w-full bg-gray-900 rounded-md p-1" /></div><div><label className="text-xs">{t('initial')}</label><input type="number" value={res.initialValue} onChange={e => {const newResources = [...draftQuest.resources];newResources[index].initialValue = parseInt(e.target.value);handleDraftChange('resources', newResources);}} className="w-full bg-gray-900 rounded-md p-1" /></div><div><label className="text-xs">{t('max')}</label><input type="number" value={res.maximumValue ?? 0} onChange={e => {const newResources = [...draftQuest.resources];newResources[index].maximumValue = parseInt(e.target.value);handleDraftChange('resources', newResources);}} className="w-full bg-gray-900 rounded-md p-1" /></div></div></div>));
            case 'BOARD': return draftQuest.board.locations.map((loc, index) => (<div key={index} className="bg-gray-800 p-3 rounded-md space-y-2"><h4 className="font-semibold">{t('location')} {index}</h4><input value={getLocalizedString(loc.name, language)} onChange={e => {const newLocations = [...draftQuest.board.locations];newLocations[index].name = { ...newLocations[index].name, [language]: e.target.value };handleDraftChange('board', { ...draftQuest.board, locations: newLocations });}} className="w-full bg-gray-900 rounded-md p-1" /><textarea value={getLocalizedString(loc.description, language)} onChange={e => {const newLocations = [...draftQuest.board.locations];newLocations[index].description = { ...newLocations[index].description, [language]: e.target.value };handleDraftChange('board', { ...draftQuest.board, locations: newLocations });}} className="w-full bg-gray-900 rounded-md p-1 h-16" /><div className="grid grid-cols-2 gap-2"><select value={loc.type} onChange={e => {const newLocations = [...draftQuest.board.locations];newLocations[index].type = e.target.value as BoardLocationType;handleDraftChange('board', { ...draftQuest.board, locations: newLocations });}} className="w-full bg-gray-900 rounded-md p-1">{Object.values(BoardLocationType).map(type => <option key={type} value={type}>{type}</option>)}</select>{loc.type === 'PROPERTY' && <input value={loc.color} onChange={e => {const newLocations = [...draftQuest.board.locations];newLocations[index].color = e.target.value;handleDraftChange('board', { ...draftQuest.board, locations: newLocations });}} placeholder="bg-red-500" className="w-full bg-gray-900 rounded-md p-1" />}</div></div>));
            case 'CARDS': return (<div><h3 className="text-lg font-bold mb-2">{t('chanceCards')}</h3>{draftQuest.chanceCards.map((card, index) => (<div key={index} className="bg-gray-800 p-3 rounded-md space-y-2 mb-2"><textarea value={getLocalizedString(card.description, language)} onChange={e => {const newCards = [...draftQuest.chanceCards];newCards[index].description = { ...newCards[index].description, [language]: e.target.value };handleDraftChange('chanceCards', newCards);}} className="w-full bg-gray-900 rounded-md p-1 h-16" /></div>))}</div>);
            default: return null;
        }
    }

    const renderGeneratingStep = () => {
        const isComplete = scenarioProgress.every(p => p.status === 'done' || p.status === 'error');
        const hasErrors = scenarioProgress.some(p => p.status === 'error');

        return (
            <div className="text-center">
                <h2 className="text-2xl font-bold text-orange-400 mb-2">{t('writingStories')}</h2>
                <p className="text-gray-400 mb-6">{t('writingStoriesDescription')}</p>
                <div className="bg-gray-700 rounded-lg p-4 space-y-2 max-h-[50vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4 text-left font-semibold border-b border-gray-600 pb-2 mb-2">
                        <span>{t('location')}</span>
                        <span>{t('status')}</span>
                    </div>
                    {scenarioProgress.map(progress => (
                        <div key={progress.locationName} className="grid grid-cols-2 gap-4 items-center text-left text-sm py-1">
                            <span className="truncate">{progress.locationName}</span>
                            <div className="flex items-center gap-2">
                                {progress.status === 'pending' && <span className="text-gray-400">{t('pending')}...</span>}
                                {progress.status === 'generating' && <span className="text-blue-400 animate-pulse">{t('generating')}...</span>}
                                {progress.status === 'done' && <span className="text-green-400 font-semibold">✅ {t('done')}</span>}
                                {progress.status === 'error' && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-red-400 font-semibold" title={progress.error}>❌ {t('error')}</span>
                                        <button onClick={() => handleRetryScenario(progress.location)} className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded">{t('retry')}</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {isComplete && (
                    <div className="mt-6">
                        <p className="text-gray-300 mb-4">{hasErrors ? t('someScenariosFailed') : t('allScenariosGenerated')}</p>
                        <button onClick={() => setStep('PREVIEW')} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg">
                            {t('proceedToPreview')}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderPreviewStep = () => {
        const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
    
        const handleScenarioUpdate = (locationName: string, scenarioIndex: number, path: (string | number)[], value: any, isLocalized: boolean) => {
            if (!draftQuest) return;
        
            const newDraft = JSON.parse(JSON.stringify(draftQuest));
            let target = newDraft.pregeneratedScenarios[locationName][scenarioIndex];
        
            for (let i = 0; i < path.length; i++) {
                if (i === path.length - 1) {
                    if (isLocalized) {
                        target[path[i]] = { ...target[path[i]], [language]: value };
                    } else {
                        target[path[i]] = value;
                    }
                } else {
                    target = target[path[i]];
                }
            }
            onDraftUpdate(newDraft);
        };
    
        const scenarioLocations = draftQuest?.pregeneratedScenarios ? Object.keys(draftQuest.pregeneratedScenarios) : [];
    
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-orange-400">{t('step3PreviewTitle')}</h2>
                    <p className="text-gray-400">{t('step3DescPreview')}</p>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                        {scenarioLocations.map(locationName => (
                            <div key={locationName} className="bg-gray-700 rounded-lg">
                                <button onClick={() => setActiveAccordion(activeAccordion === locationName ? null : locationName)} className="w-full text-left p-3 font-semibold flex justify-between items-center hover:bg-gray-600">
                                    <span>{locationName}</span>
                                    <svg className={`w-5 h-5 transition-transform ${activeAccordion === locationName ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {activeAccordion === locationName && (
                                    <div className="p-4 border-t border-gray-600 space-y-4">
                                        {draftQuest.pregeneratedScenarios[locationName].map((scenario, index) => (
                                            <div key={scenario.id} className="bg-gray-800 p-3 rounded-md space-y-3 text-sm">
                                                <h4 className="font-bold text-base">Scenario {index + 1}</h4>
                                                <div><label className="block text-xs font-medium text-gray-400">{t('scenarioTitle')}</label><input value={getLocalizedString(scenario.title, language)} onChange={e => handleScenarioUpdate(locationName, index, ['title'], e.target.value, true)} className="mt-1 w-full bg-gray-900 rounded-md p-1" /></div>
                                                <div><label className="block text-xs font-medium text-gray-400">{t('scenarioDescription')}</label><textarea value={getLocalizedString(scenario.description, language)} onChange={e => handleScenarioUpdate(locationName, index, ['description'], e.target.value, true)} className="mt-1 w-full bg-gray-900 rounded-md p-1 h-20" /></div>
                                                <div><label className="block text-xs font-medium text-gray-400">{t('sourceURL')}</label><input value={scenario.sourceUrl || ''} onChange={e => handleScenarioUpdate(locationName, index, ['sourceUrl'], e.target.value, false)} className="mt-1 w-full bg-gray-900 rounded-md p-1" /></div>
                                                <div><label className="block text-xs font-medium text-gray-400">{t('sourceTitle')}</label><input value={getLocalizedString(scenario.sourceTitle, language)} onChange={e => handleScenarioUpdate(locationName, index, ['sourceTitle'], e.target.value, true)} className="mt-1 w-full bg-gray-900 rounded-md p-1" /></div>
                                                <div className="border-t border-gray-700 pt-2 space-y-2">
                                                    <h5 className="font-semibold text-gray-300">{t('choices')}</h5>
                                                    {[0, 1].map(choiceIndex => (
                                                        <div key={choiceIndex} className="bg-gray-900/50 p-2 rounded-md space-y-2">
                                                            <p className="font-medium">Choice {choiceIndex + 1}</p>
                                                            <div><label className="block text-xs font-medium text-gray-400">{t('choiceText')}</label><input value={getLocalizedString(scenario.choices[choiceIndex].text, language)} onChange={e => handleScenarioUpdate(locationName, index, ['choices', choiceIndex, 'text'], e.target.value, true)} className="mt-1 w-full bg-gray-900 rounded-md p-1" /></div>
                                                            <div><label className="block text-xs font-medium text-gray-400">{t('outcomeExplanation')}</label><textarea value={getLocalizedString(scenario.choices[choiceIndex].outcome.explanation, language)} onChange={e => handleScenarioUpdate(locationName, index, ['choices', choiceIndex, 'outcome', 'explanation'], e.target.value, true)} className="mt-1 w-full bg-gray-900 rounded-md p-1 h-16" /></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">{t('questOutput')}</h3>
                    <textarea value={jsonText} onChange={handleJsonTextChange} className="w-full h-[60vh] p-3 bg-gray-900 border border-gray-600 rounded-lg font-mono text-sm" />
                    {jsonError && <p className="text-red-400 text-sm">{jsonError}</p>}
                    {draftQuest && (
                        <div className="flex gap-4">
                            <button onClick={() => handleStepNavigation('REFINE')} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg">{t('backToRefine')}</button>
                            <button onClick={() => setStep('FINISH')} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg">{t('nextFinish')}</button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderFinishStep = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6 text-center md:text-left">
                <h2 className="text-3xl font-bold text-green-400">{t('step4Title')}</h2>
                <p className="text-gray-300">Your quest has been successfully generated! You can now download the JSON file to save it, share it, or load it into the game to play.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={handleDownloadJson} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg">{t('downloadJson')}</button>
                    <button onClick={handleCopyJson} className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg">{t('copyJson')}</button>
                </div>
                <button onClick={() => draftQuest && onLoadQuest(draftQuest)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-4 rounded-lg text-lg">{t('loadAndPlay')}</button>
                 <div className="flex gap-4">
                    <button onClick={() => handleStepNavigation('PREVIEW')} className="text-gray-400 hover:text-white mt-4">{t('back')}</button>
                    <button onClick={handleStartOver} className="text-gray-400 hover:text-white mt-4">{t('startOver')}</button>
                </div>
            </div>
             <div className="space-y-4">
                <h3 className="text-lg font-medium">{t('questOutput')}</h3>
                <textarea value={jsonText} readOnly className="w-full h-[60vh] p-3 bg-gray-900 border border-gray-600 rounded-lg font-mono text-sm" />
            </div>
        </div>
    );
    
    const renderContent = () => {
        switch(step) {
            case 'CONFIG': return renderConfigStep();
            case 'REFINE': return renderRefineStep();
            case 'GENERATING': return renderGeneratingStep();
            case 'PREVIEW': return renderPreviewStep();
            case 'FINISH': return renderFinishStep();
            default: return null;
        }
    };

    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl font-bold font-mono text-center mb-2">{t('wizardTitle')}</h1>
             <div className="max-w-7xl mx-auto mt-6 bg-gray-800/50 p-6 md:p-8 rounded-2xl shadow-2xl relative">
                <Stepper steps={wizardSteps} currentStepName={visibleStep} onStepClick={handleStepNavigation} disabled={isLoading || step === 'GENERATING'} />
                {isLoading && (
                     <div className="absolute inset-0 bg-gray-800/80 flex items-center justify-center rounded-2xl z-10">
                        <p className="text-white text-lg animate-pulse">{loadingMessage || t('generating')}</p>
                    </div>
                )}
                {renderContent()}
            </div>
        </div>
    );
};

export default QuestMakerPage;