import { escapeHtml } from './utils.js';

function renderInlineMarkdown(value) {
    return escapeHtml(value)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-link">$1</a>');
}

function markdownToHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const html = [];
    let paragraph = [];
    let inList = false;

    const flushParagraph = () => {
        if (paragraph.length === 0) return;
        if (inList) {
            html.push('</ul>');
            inList = false;
        }
        html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
        paragraph = [];
    };

    for (const line of lines) {
        const trimmed = line.trim();
        
        // Handle lists
        const listItem = /^[-*+]\s+(.+)$/.exec(trimmed);
        if (listItem) {
            if (!inList) {
                flushParagraph();
                html.push('<ul class="about-list">');
                inList = true;
            }
            html.push(`<li>${renderInlineMarkdown(listItem[1])}</li>`);
            continue;
        }

        if (!trimmed) {
            flushParagraph();
            if (inList) {
                html.push('</ul>');
                inList = false;
            }
            continue;
        }

        const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
        if (heading) {
            flushParagraph();
            if (inList) {
                html.push('</ul>');
                inList = false;
            }
            const level = heading[1].length;
            html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
            continue;
        }

        if (inList) {
            // Append to last list item if it's not a new item but has text
            const lastIdx = html.length - 1;
            if (html[lastIdx].endsWith('</li>')) {
                html[lastIdx] = html[lastIdx].slice(0, -5) + ' ' + renderInlineMarkdown(trimmed) + '</li>';
            } else {
                html.push(`<li>${renderInlineMarkdown(trimmed)}</li>`);
            }
        } else {
            paragraph.push(trimmed);
        }
    }

    flushParagraph();
    if (inList) {
        html.push('</ul>');
    }
    return html.join('');
}

export async function renderAboutPage(container) {
    if (!container) return;

    // __ABOUT_MD_CONTENT__ is injected by Vite at build time
    const content = typeof __ABOUT_MD_CONTENT__ !== 'undefined' ? __ABOUT_MD_CONTENT__ : '# About\n\nContent not available.';
    
    container.innerHTML = `
        <div class="about-content-wrapper">
            ${markdownToHtml(content)}
        </div>
    `;
}
