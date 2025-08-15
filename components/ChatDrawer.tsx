
import React, { useState, useEffect, useRef } from 'react';
import showdown from 'showdown';
import Drawer from './Drawer';
import { chatManager } from '../services/aiService';
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
}

const ChatDrawer: React.FC<ChatDrawerProps> = ({ show, onClose, page, questConfig, draftQuest }) => {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [systemInstruction, setSystemInstruction] = useState('');
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isGemini = settingsService.getAiSettings().providerId === 'gemini';

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
                setSystemInstruction(`You are an expert game design assistant. The user is creating a quest. Here is the current JSON configuration: \n${draftQuestJson}\n\n Help them refine it. You can suggest changes to balance, theme, or add new content. If you suggest JSON changes, provide only the JSON snippet to be changed or added.`);
                setWelcomeMessage(t('chatWelcomeMaker'));
            } else if (page === 'game' && questConfig) {
                const questConfigJson = JSON.stringify(questConfig, null, 2);
                setSystemInstruction(`You are a helpful game master for the board game '${getLocalizedString(questConfig.name, 'en')}'. The game's theme is '${getLocalizedString(questConfig.description, 'en')}'. Help players with rules or thematic questions about the game. Be friendly and engaging. Here is the full game configuration for your reference:\n\n${questConfigJson}`);
                setWelcomeMessage(t('chatWelcomeGame'));
            } else {
                const docsContext = await fetchDocsContext();
                setSystemInstruction(`You are QuestCraft AI, a helpful assistant for the QuestCraft board game engine. You have the following documentation as your knowledge base. Use it to answer questions about how to play, how to create quests, or the game's features.\n\n# QuestCraft Documentation\n\n${docsContext}`);
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

        const userInput: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: input };
        setMessages(prev => [...prev, userInput]);
        setInput('');
        setIsLoading(true);

        const modelResponseId = `model-${Date.now()}`;
        setMessages(prev => [...prev, { id: modelResponseId, role: 'model', content: '' }]);

        try {
            const stream = chatManager.sendMessageStream(input);
            for await (const chunk of stream) {
                setMessages(prev => prev.map(msg => 
                    msg.id === modelResponseId 
                        ? { ...msg, content: msg.content + chunk }
                        : msg
                ));
            }
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
            if (systemInstruction) {
                chatManager.initialize(systemInstruction); // Reset AI memory
            }
        }
    };

    return (
        <Drawer title={t('chatTitle')} show={show} onClose={onClose}>
            {!isGemini && (
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
                                <div className="prose prose-invert prose-p:my-0" dangerouslySetInnerHTML={{ __html: converter.makeHtml(msg.content) || '...' }} />
                            </div>
                           )}
                        </div>
                    ))}
                    {isLoading && (
                         <div className="flex justify-start">
                             <div className="p-3 rounded-lg max-w-lg bg-gray-700 text-gray-200">
                                <div className="animate-pulse">...</div>
                             </div>
                         </div>
                    )}
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
                            disabled={isLoading || !isGemini}
                        />
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 rounded-lg disabled:bg-gray-600" disabled={isLoading || !input.trim() || !isGemini}>
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
