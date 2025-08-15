
import React, { useEffect, useState } from 'react';
import { useTranslation } from '../services/i18n';

interface DrawerProps {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    show: boolean;
}

const MaximizeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-6v4.5m0-4.5h-4.5m4.5 0L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 6v-4.5m0 4.5h-4.5m4.5 0L15 15" />
    </svg>
);

const MinimizeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L3.75 3.75M3.75 3.75h4.5m-4.5 0v4.5m11.25 0L20.25 3.75m0 0h-4.5m4.5 0v4.5m-4.5 11.25L3.75 20.25m0 0v-4.5m0 4.5h4.5m11.25 0L15 15m0 0v4.5m0-4.5h4.5" />
    </svg>
);


const Drawer: React.FC<DrawerProps> = ({ title, children, onClose, show }) => {
    const [isMounted, setIsMounted] = useState(show);
    const [isMaximized, setIsMaximized] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        if (show) {
            setIsMounted(true);
        } else {
            const timeoutId = setTimeout(() => {
                setIsMounted(false);
                setIsMaximized(false); 
            }, 300);
            return () => clearTimeout(timeoutId);
        }
    }, [show]);

    if (!isMounted) {
        return null;
    }

    const drawerWidthClass = isMaximized ? 'w-[80vw] max-w-[80vw]' : 'w-full max-w-2xl';

    return (
        <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
        >
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${show ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />

            <div
                className={`fixed top-0 right-0 h-full bg-gray-800 border-l border-gray-700 shadow-2xl flex flex-col transform transition-all duration-300 ease-in-out ${drawerWidthClass} ${show ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <header className="flex justify-between items-center p-4 md:p-5 border-b border-gray-700 flex-shrink-0">
                    <h1 id="drawer-title" className="text-xl font-bold text-white">{title}</h1>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setIsMaximized(!isMaximized)}
                            className="text-gray-400 bg-transparent hover:bg-gray-600 hover:text-white rounded-lg text-sm w-8 h-8 inline-flex justify-center items-center"
                            aria-label={isMaximized ? "Restore drawer size" : "Maximize drawer"}
                        >
                            {isMaximized ? <MinimizeIcon /> : <MaximizeIcon />}
                            <span className="sr-only">{isMaximized ? "Restore drawer size" : "Maximize drawer"}</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="text-gray-400 bg-transparent hover:bg-gray-600 hover:text-white rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center"
                            aria-label="Close drawer"
                        >
                            <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                            </svg>
                            <span className="sr-only">Close drawer</span>
                        </button>
                    </div>
                </header>
                <main className="p-4 md:p-6 flex-grow overflow-y-auto">
                    <div className="prose prose-invert prose-p:text-gray-300 prose-li:text-gray-300 prose-strong:text-white max-w-none">
                      {children}
                    </div>
                </main>
                 <footer className="flex items-center p-4 md:p-5 mt-auto border-t border-gray-700 flex-shrink-0">
                     <button 
                        onClick={onClose} 
                        className="ms-auto text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:outline-none focus:ring-indigo-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                    >
                        {t('close')}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default Drawer;
