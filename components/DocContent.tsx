
import React, { useState, useEffect } from 'react';
import showdown from 'showdown';

const converter = new showdown.Converter({
    ghCompatibleHeaderId: true,
    simpleLineBreaks: true,
    tables: true,
});

export interface Heading {
    id: string;
    level: number;
    text: string;
}

interface DocContentProps {
    docId: string;
    onHeadingsExtracted: (headings: Heading[]) => void;
}

const DocContent: React.FC<DocContentProps> = ({ docId, onHeadingsExtracted }) => {
    const [content, setContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        fetch(`/docs/${docId}.md`)
            .then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch documentation file: ${res.status} ${res.statusText}`);
                }
                return res.text();
            })
            .then(text => {
                const html = converter.makeHtml(text);
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                const headings: Heading[] = Array.from(tempDiv.querySelectorAll('h1, h2, h3')).map(h => ({
                    id: h.id,
                    level: parseInt(h.tagName.substring(1), 10),
                    text: h.textContent || '',
                }));
                onHeadingsExtracted(headings);

                setContent(html);
            })
            .catch(err => {
                console.error(err);
                setError('Error: Could not load documentation content. Please check the console for details.');
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [docId, onHeadingsExtracted]);

    if (isLoading) {
        return <p className="text-lg text-gray-400 animate-pulse">Loading documentation...</p>;
    }
    
    if (error) {
        return <p className="text-red-400">{error}</p>
    }

    return (
        <article 
            className="prose prose-invert prose-p:text-gray-300 prose-li:text-gray-300 prose-strong:text-white prose-headings:text-orange-400 prose-a:text-indigo-400 hover:prose-a:text-indigo-300 prose-code:text-orange-300 prose-pre:bg-gray-800 max-w-none" 
            dangerouslySetInnerHTML={{ __html: content }} 
        />
    );
};

export default DocContent;
