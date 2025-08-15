import React, { useState } from 'react';
import { DOC_LINKS } from '../constants';
import DocContent from './DocContent';
import { useTranslation } from '../services/i18n';

const DocsPage: React.FC = () => {
  const [activeDocId, setActiveDocId] = useState(DOC_LINKS[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { t } = useTranslation();

  return (
    <div className="flex h-full bg-gray-900 text-gray-100 font-sans">
      {/* Sidebar */}
      <aside 
        className={`bg-gray-800/50 border-r border-gray-700 p-4 flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-0 -ml-4 p-0'}`}
        style={{ overflow: 'hidden' }}
      >
        <div className="mb-8">
            <h2 className="text-lg text-gray-400">{t('docs')}</h2>
        </div>
        <nav className="flex-grow space-y-2">
            {DOC_LINKS.map(link => (
              <button 
                key={link.id}
                onClick={() => setActiveDocId(link.id)}
                className={`w-full text-left p-2.5 rounded-md text-sm font-medium transition-colors ${activeDocId === link.id ? 'bg-indigo-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'}`}
                aria-current={activeDocId === link.id ? 'page' : undefined}
              >
                {link.title}
              </button>
            ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-6 md:p-10 overflow-y-auto">
        <DocContent docId={activeDocId} />
      </main>
    </div>
  );
};

export default DocsPage;