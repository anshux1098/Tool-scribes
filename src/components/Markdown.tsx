interface MarkdownProps {
  text: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function Markdown({ text }: MarkdownProps) {
  const html = text
    .split(/\n\n+/)
    .map(block => {
      if (block.startsWith('- ') || block.startsWith('* ')) {
        const items = block.split(/\n/).map(line => {
          const content = renderInline(line.replace(/^[-*]\s+/, ''));
          return `<li>${content}</li>`;
        }).join('');
        return `<ul>${items}</ul>`;
      }
      const trimmed = block.trim();
      if (/^#{1,3}\s/.test(trimmed)) {
        const level = trimmed.match(/^#{1,3}/)![0].length;
        return `<h${level}>${renderInline(trimmed.replace(/^#{1,3}\s+/, ''))}</h${level}>`;
      }
      return `<p>${renderInline(trimmed)}</p>`;
    })
    .join('');

  return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Only allow http: and https: links; strip everything else. */
function sanitizeHref(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href;
    }
  } catch {
    // ignore malformed URLs
  }
  return null;
}

function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-s2 px-1 py-0.5 rounded text-[12px] font-mono">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, (_match, p1, p2) => {
      const href = sanitizeHref(p2);
      if (!href) {
        return p1;
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="underline text-tv-primary">${p1}</a>`;
    });
}
