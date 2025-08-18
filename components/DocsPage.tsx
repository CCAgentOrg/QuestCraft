
import React, { useState, useEffect, useRef } from 'react';
import { DOC_LINKS } from '../constants';
import DocContent, { Heading } from './DocContent';
import { useTranslation } from '../services/i18n';

const DocsPage: React.FC = () => {
  const [activeDocId, setActiveDocId] = useState(DOC_LINKS[0].id);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const { t } = useTranslation();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState<string>('');
  const contentRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
        if (!contentRef.current || headings.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveHeading(entry.target.id);
                    }
                });
            },
            { rootMargin: '-20% 0px -70% 0px' }
        );

        const elements = headings.map(h => document.getElementById(h.id)).filter((el): el is HTMLElement => el !== null);
        elements.forEach(el => observer.observe(el));

        return () => {
            elements.forEach(el => observer.unobserve(el));
        };
    }, [headings]);

  const activeDocTitle = DOC_LINKS.find(link => link.id === activeDocId)?.title || DOC_LINKS[0].title;

  const handleDocLinkClick = (id: string) => {
    setActiveDocId(id);
    setIsMobileMenuOpen(false);
    setIsTocOpen(false);
    setHeadings([]);
    setActiveHeading('');
    // Scroll to top of content area on new doc selection
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  };

  const NavLinks: React.FC<{ inMobile?: boolean }> = ({ inMobile = false }) => (
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

  const TocLinks: React.FC = () => (
     <nav className="space-y-2 text-sm">
        {headings.map(h => (
            <a 
              key={h.id} 
              href={`#${h.id}`} 
              onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' }); setIsTocOpen(false); }}
              className={`block py-1 transition-colors ${h.level === 2 ? 'pl-2' : h.level === 3 ? 'pl-4' : ''} ${activeHeading === h.id ? 'text-orange-400 font-semibold' : 'text-gray-400 hover:text-white'}`}
            >
              {h.text}
            </a>
        ))}
    </nav>
  );

  return (
    <div className="flex flex-col md:grid md:grid-cols-[256px_1fr_256px] h-full bg-gray-900 text-gray-100 font-sans">
      {/* Mobile Header & Dropdowns */}
      <header className="md:hidden flex-shrink-0 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700 p-4 space-y-3 sticky top-0 z-20">
        <div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="w-full flex justify-between items-center text-left p-2 bg-gray-700 rounded-md" aria-expanded={isMobileMenuOpen} aria-controls="mobile-docs-nav">
            <div>
              <span className="text-xs text-gray-400">{t('docs')}</span>
              <h2 className="font-semibold text-white">{activeDocTitle}</h2>
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {isMobileMenuOpen && <div id="mobile-docs-nav" className="mt-2"><NavLinks /></div>}
        </div>
        {headings.length > 0 && (
          <div>
            <button onClick={() => setIsTocOpen(!isTocOpen)} className="w-full flex justify-between items-center text-left p-2 bg-gray-700 rounded-md" aria-expanded={isTocOpen} aria-controls="mobile-toc-nav">
                <span className="font-semibold text-white">{t('onThisPage')}</span>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${isTocOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            {isTocOpen && <div id="mobile-toc-nav" className="mt-2 p-2 bg-gray-900/50 rounded-md"><TocLinks /></div>}
          </div>
        )}
      </header>

      {/* Desktop Left Sidebar (Main Nav) */}
      <aside className="hidden md:flex flex-col flex-shrink-0 w-64 bg-gray-800/50 border-r border-gray-700 p-4 h-full">
        <div className="mb-8"><h2 className="text-lg text-gray-400">{t('docs')}</h2></div>
        <div className="flex-grow"><NavLinks /></div>
      </aside>

      {/* Main Content */}
      <main ref={contentRef} className="flex-grow p-6 md:p-10 overflow-y-auto">
        <DocContent docId={activeDocId} onHeadingsExtracted={setHeadings} />
      </main>

      {/* Desktop Right Sidebar (TOC) */}
       <aside className="hidden md:block flex-shrink-0 w-64 p-4 h-full overflow-y-auto">
          {headings.length > 0 && (
             <div className="sticky top-4">
                 <h3 className="text-sm font-semibold text-gray-300 mb-3">{t('onThisPage')}</h3>
                <TocLinks />
            </div>
          )}
      </aside>
    </div>
  );
};

export default DocsPage;
