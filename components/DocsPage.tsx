import React, { useState } from 'react';
import { DOC_LINKS } from '../constants';
import DocContent from './DocContent';
import { useTranslation } from '../services/i18n';

const DocsPage: React.FC = () => {
  const [activeDocId, setActiveDocId] = useState(DOC_LINKS[0].id);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useTranslation();

  const activeDocTitle = DOC_LINKS.find(link => link.id === activeDocId)?.title || DOC_LINKS[0].title;

  const handleDocLinkClick = (id: string) => {
    setActiveDocId(id);
    setIsMobileMenuOpen(false); // Close menu on selection
  };

  const navLinks = (
    <nav className="space-y-2">
      {DOC_LINKS.map(link => (
        <button
          key={link.id}
          onClick={() => handleDocLinkClick(link.id)}
          className={`w-full text-left p-2.5 rounded-md text-sm font-medium transition-colors ${activeDocId === link.id ? 'bg-indigo-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'}`}
          aria-current={activeDocId === link.id ? 'page' : undefined}
        >
          {link.title}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="flex flex-col md:flex-row h-full bg-gray-900 text-gray-100 font-sans">
      {/* Mobile Header & Dropdown */}
      <header className="md:hidden flex-shrink-0 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 p-4">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="w-full flex justify-between items-center text-left p-2 bg-gray-700 rounded-md"
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-docs-nav"
        >
          <div>
            <span className="text-xs text-gray-400">{t('docs')}</span>
            <h2 className="font-semibold text-white">{activeDocTitle}</h2>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isMobileMenuOpen && (
          <div id="mobile-docs-nav" className="mt-4">
            {navLinks}
          </div>
        )}
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col flex-shrink-0 w-64 bg-gray-800/50 border-r border-gray-700 p-4">
        <div className="mb-8">
          <h2 className="text-lg text-gray-400">{t('docs')}</h2>
        </div>
        <div className="flex-grow">
            {navLinks}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow p-6 md:p-10 overflow-y-auto">
        <DocContent docId={activeDocId} />
      </main>
    </div>
  );
};

export default DocsPage;
