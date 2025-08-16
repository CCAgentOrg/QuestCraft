import React, { useState, useEffect, useRef } from 'react';
import showdown from 'showdown';
import Drawer from './Drawer';
import { chatManager, loadPrompt } from '../services/aiService';
import { settingsService } from '../services/settingsService';
import type { ChatMessage, Page, QuestConfig } from '../types';
import { useTranslation } from '../services/i18n';
import { getLocalizedString } from '../utils/localization';
import { DOC_LINKS } from '../constants';

const converter = new showdown.Converter({
    ghCompatibleHeaderId: true,
    simpleLineBreaks: true,
    tables: true,
});

const CHAT_HISTORY_KEY = 'questcraft-chat-history';

interface ChatDrawerProps {
    show: boolean;
    onClose: () => void;
    page: Page;
    questConfig: QuestConfig | null;
    draftQuest: QuestConfig | null;
    onApplyQuestUpdate: (config: QuestConfig) => void;
}

const ChatDrawer: React.FC<ChatDrawerProps> = ({ show, onClose, page, questConfig, draftQuest, onApplyQuestUpdate }) => {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [systemInstruction, setSystemInstruction] = useState('');
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [appliedUpdates, setAppliedUpdates] = useState<Set<string>>(new Set());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const settings = settingsService.getAiSettings();
    const isChatEnabled = settings.providerId === 'gemini' || settings.providerId === 'community';

    // Effect to determine the chat's context and system prompt
    useEffect(() => {
        if (!show) return;

        const fetchDocsContext = async (): Promise<string> => {
            const docPromises = DOC_LINKS.map(link => 
                fetch(`/docs/${link.id}.md`).then(res => res.text()).catch(() => '')
            );
            const docContents = await Promise.all(docPromises);
            return docContents.join('\n\n---\n\n');
        };

        const updateContext = async () => {
            if (page === 'maker' && draftQuest) {
                const draftQuestJson = JSON.stringify(draftQuest, null, 2);
                const instruction = await loadPrompt('prompts/chat-maker.txt', { draftQuestJson });
                setSystemInstruction(instruction);
                setWelcomeMessage(t('chatWelcomeMaker'));
            } else if (page === 'game' && questConfig) {
                const questConfigJson = JSON.stringify(questConfig, null, 2);
                const instruction = await loadPrompt('prompts/chat-game.txt', { 
                    questName: getLocalizedString(questConfig.name, 'en'),
                    questDescription: getLocalizedString(questConfig.description, 'en'),
                    questConfigJson
                });
                setSystemInstruction(instruction);
                setWelcomeMessage(t('chatWelcomeGame'));
            } else {
                const docsContext = await fetchDocsContext();
                const instruction = await loadPrompt('prompts/chat-general.txt', { docsContext });
                setSystemInstruction(instruction);
                setWelcomeMessage(t('chatWelcomeGeneral'));
            }
        };

        updateContext();
    }, [show, page, questConfig, draftQuest, t]);

    // Effect to initialize the chat and reset messages when the context changes
    useEffect(() => {
        if (show && systemInstruction) {
            chatManager.initialize(systemInstruction);
            setMessages([{ id: 'system-welcome', role: 'system', content: welcomeMessage }]);
        }
    }, [systemInstruction, welcomeMessage, show]);

    // Effect to scroll to bottom and persist message history
    useEffect(() => {
        if (show) {
             localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
        }
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, show]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const chatHistory: {role: 'user' | 'model', content: string}[] = messages
            .filter(m => m.role === 'user' || m.role === 'model')
            .map(m => ({ role: m.role as 'user' | 'model', content: m.content }));

        const userInput: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: input };
        setMessages(prev => [...prev, userInput]);
        setInput('');
        setIsLoading(true);

        const modelResponseId = `model-${Date.now()}`;
        setMessages(prev => [...prev, { id: modelResponseId, role: 'model', content: '' }]);

        try {
            const stream = chatManager.sendMessageStream(input, chatHistory);
            let fullResponseText = "";
            for await (const chunk of stream) {
                fullResponseText += chunk;
                // Update UI with intermediate text for streaming effect
                setMessages(prev => prev.map(msg =>
                    msg.id === modelResponseId
                        ? { ...msg, content: fullResponseText }
                        : msg
                ));
            }

            // Once the stream is complete, process the full text for a JSON block
            const startMarker = '[JSON_UPDATE_START]';
            const endMarker = '[JSON_UPDATE_END]';
            const startIndex = fullResponseText.indexOf(startMarker);
            const endIndex = fullResponseText.indexOf(endMarker);

            let finalContent = fullResponseText;
            let questUpdateJson: QuestConfig | undefined = undefined;

            if (page === 'maker' && startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                const jsonString = fullResponseText.substring(startIndex + startMarker.length, endIndex).trim();
                const textBefore = fullResponseText.substring(0, startIndex).trim();
                const textAfter = fullResponseText.substring(endIndex + endMarker.length).trim();
                finalContent = `${textBefore}\n${textAfter}`.trim();

                try {
                    questUpdateJson = JSON.parse(jsonString);
                } catch (err) {
                    console.error("Failed to parse JSON from chat response:", err);
                    finalContent = fullResponseText; // Revert to full text on parse error
                }
            }
            
            // Final update to the message with parsed content
            setMessages(prev => prev.map(msg =>
                msg.id === modelResponseId
                    ? { ...msg, content: finalContent, updatedQuestJson: questUpdateJson }
                    : msg
            ));

        } catch (error) {
            console.error(error);
             setMessages(prev => prev.map(msg => 
                msg.id === modelResponseId 
                    ? { ...msg, content: t('error') }
                    : msg
            ));
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearChat = () => {
        if (window.confirm(t('chatClearConfirm'))) {
            setMessages([{ id: 'system-welcome', role: 'system', content: welcomeMessage }]);
            setAppliedUpdates(new Set());
            if (systemInstruction) {
                chatManager.initialize(systemInstruction); // Reset AI memory
            }
        }
    };

    const handleApplyUpdate = (msgId: string, config: QuestConfig) => {
        onApplyQuestUpdate(config);
        setAppliedUpdates(prev => new Set(prev).add(msgId));
    };

    return (
        <Drawer title={t('chatTitle')} show={show} onClose={onClose}>
            {!isChatEnabled && (
                <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 p-3 rounded-md mb-4 text-sm">{t('chatUnavailable')}</div>
            )}
            <div className="flex flex-col h-full">
                <div className="flex-grow overflow-y-auto space-y-4 pr-2 -mr-2">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                           {msg.role === 'system' ? (
                                <div className="w-full text-center text-xs text-gray-400 italic py-2 border-b border-gray-700">{msg.content}</div>
                           ) : (
                             <div className={`p-3 rounded-lg max-w-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                                <div className="prose prose-invert prose-p:my-0" dangerouslySetInnerHTML={{ __html: converter.makeHtml(msg.content) || (isLoading && msg.role === 'model' ? '...' : '') }} />
                                {msg.updatedQuestJson && page === 'maker' && (
                                    <div className="mt-2 pt-2 border-t border-gray-600">
                                        <button
                                            onClick={() => handleApplyUpdate(msg.id, msg.updatedQuestJson!)}
                                            disabled={appliedUpdates.has(msg.id)}
                                            className="w-full text-sm font-semibold py-2 px-3 rounded-lg transition-colors bg-green-700 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white"
                                        >
                                            {appliedUpdates.has(msg.id) ? t('changesApplied') : t('applyChanges')}
                                        </button>
                                    </div>
                                )}
                            </div>
                           )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700">
                    <form onSubmit={handleSend} className="flex items-center gap-2">
                         <button
                            type="button"
                            onClick={handleClearChat}
                            title={t('chatClear')}
                            className="p-2 text-gray-400 hover:text-white bg-gray-700 rounded-md"
                         >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                         </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={t('chatPlaceholder')}
                            className="flex-grow p-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500"
                            disabled={isLoading || !isChatEnabled}
                        />
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 rounded-lg disabled:bg-gray-600" disabled={isLoading || !input.trim() || !isChatEnabled}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </Drawer>
    );
};

export default ChatDrawer;
