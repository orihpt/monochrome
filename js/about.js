import { escapeHtml } from './utils.js';

const ABOUT_ENDPOINT = '/api/about';

function renderInlineMarkdown(value) {
    return escapeHtml(value)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function markdownToHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let paragraph = [];

    const flushParagraph = () => {
        if (paragraph.length === 0) return;
        html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
        paragraph = [];
    };

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            flushParagraph();
            continue;
        }

        const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
        if (heading) {
            flushParagraph();
            const level = heading[1].length;
            html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
            continue;
        }

        paragraph.push(trimmed);
    }

    flushParagraph();
    return html.join('');
}

export async function renderAboutPage(container) {
    if (!container) return;

    container.innerHTML = '<p class="about-loading">Loading about page...</p>';

    try {
        const response = await fetch(ABOUT_ENDPOINT);
        if (!response.ok) {
            throw new Error(`About request failed: ${response.status}`);
        }

        const data = await response.json();
        container.innerHTML = markdownToHtml(data.markdown || '');
    } catch (error) {
        console.error('Failed to load about page:', error);
        container.innerHTML = '<p class="about-error">About page is unavailable.</p>';
    }
}
