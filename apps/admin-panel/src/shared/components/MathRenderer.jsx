import { useEffect, useRef, useState } from 'react';
import sanitizeHtml from '../lib/sanitizeHtml';

function formatExplanationTables(htmlString) {
  if (typeof window === 'undefined' || !htmlString || !htmlString.includes('<table')) {
    return htmlString;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const tables = Array.from(doc.querySelectorAll('table'));
    if (tables.length === 0) return htmlString;

    tables.forEach((table) => {
      const rows = Array.from(table.querySelectorAll('tr'));
      if (rows.length === 2) {
        const headerCells = Array.from(rows[0].querySelectorAll('th, td'));
        const dataCells = Array.from(rows[1].querySelectorAll('td'));

        if (headerCells.length > 0 && headerCells.length === dataCells.length) {
          const headerTexts = headerCells.map((c) => c.textContent.trim().toLowerCase());

          // Only apply pedagogical layout if structured explanation headers are present
          const isStructuredExplanation = headerTexts.some(
            (t) =>
              t.includes('concept') ||
              t.includes('understanding') ||
              t.includes('application') ||
              t.includes('अवधारणा') ||
              t.includes('समझ') ||
              t.includes('अनुप्रयोग')
          );

          if (isStructuredExplanation) {
            const container = doc.createElement('div');
            const cols =
              headerCells.length === 2
                ? 'md:grid-cols-2'
                : headerCells.length === 3
                ? 'md:grid-cols-3'
                : 'md:grid-cols-4';
            container.className = `pedagogical-grid grid grid-cols-1 ${cols} gap-3 my-3`;

            headerCells.forEach((headerCell, idx) => {
              const headerText = headerCell.textContent.trim();
              const lower = headerText.toLowerCase();

              let icon = '📌';
              let badgeBg = 'bg-slate-50 dark:bg-slate-900/60';
              let border = 'border-slate-200 dark:border-slate-700';
              let textColor = 'text-slate-800 dark:text-slate-200';

              if (lower.includes('concept') || lower.includes('अवधारणा')) {
                icon = '💡';
                badgeBg = 'bg-indigo-50/90 dark:bg-indigo-950/40';
                border = 'border-indigo-200 dark:border-indigo-800';
                textColor = 'text-indigo-700 dark:text-indigo-300';
              } else if (lower.includes('understanding') || lower.includes('समझ')) {
                icon = '🎯';
                badgeBg = 'bg-amber-50/90 dark:bg-amber-950/40';
                border = 'border-amber-200 dark:border-amber-800';
                textColor = 'text-amber-700 dark:text-amber-300';
              } else if (lower.includes('application') || lower.includes('अनुप्रयोग')) {
                icon = '🚀';
                badgeBg = 'bg-emerald-50/90 dark:bg-emerald-950/40';
                border = 'border-emerald-200 dark:border-emerald-800';
                textColor = 'text-emerald-700 dark:text-emerald-300';
              }

              const card = doc.createElement('div');
              card.className = `p-3.5 rounded-xl border ${border} ${badgeBg} flex flex-col justify-start`;

              const title = doc.createElement('div');
              title.className = `text-xs font-bold uppercase tracking-wider ${textColor} mb-2 flex items-center gap-1.5`;
              title.innerHTML = `<span>${icon}</span><span>${headerText}</span>`;

              const body = doc.createElement('div');
              body.className = 'text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex-1 space-y-1';
              body.innerHTML = dataCells[idx].innerHTML;

              card.appendChild(title);
              card.appendChild(body);
              container.appendChild(card);
            });

            table.parentNode.replaceChild(container, table);
            return;
          }
        }
      }

      // Standard tables: wrap in overflow container
      if (!table.parentElement || !table.parentElement.classList.contains('overflow-x-auto')) {
        const wrapper = doc.createElement('div');
        wrapper.className = 'overflow-x-auto my-2.5';
        table.className = 'w-full text-xs text-left border-collapse border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
    });

    return doc.body.innerHTML;
  } catch {
    return htmlString;
  }
}

export default function MathRenderer({ text, content, children, display = false, className = '' }) {
  const ref = useRef(null);
  const [html, setHtml] = useState('');

  const rawInput = text ?? content ?? (typeof children === 'string' ? children : '') ?? '';

  useEffect(() => {
    if (!rawInput) {
      setHtml('');
      return;
    }
    let cancelled = false;

    import('katex')
      .then(({ default: katex }) => {
        if (cancelled) return;
        const str = String(rawInput);
        
        const hasDelimiters = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$]+\$/g.test(str);
        
        let processed = str;
        if (hasDelimiters) {
          processed = str.replace(
            /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$([^$]+)\$/g,
            (match, blockEq1, blockEq2, parenEq, inlineEq) => {
              const eq = blockEq1 || blockEq2 || parenEq || inlineEq;
              if (!eq) return match;
              try {
                return katex.renderToString(eq.trim(), {
                  displayMode: display || !!blockEq1 || !!blockEq2 || match.startsWith('$$') || match.startsWith('\\['),
                  throwOnError: false,
                  output: 'html',
                });
              } catch {
                return match;
              }
            }
          );
        } else if (str.includes('\\frac') || str.includes('\\sqrt') || str.includes('\\sum') || str.includes('\\int') || str.includes('\\times') || str.includes('\\pm')) {
          try {
            processed = katex.renderToString(str.trim(), {
              displayMode: display,
              throwOnError: false,
              output: 'html',
            });
          } catch {
            processed = str;
          }
        }
        const sanitized = sanitizeHtml(processed);
        const formatted = formatExplanationTables(sanitized);
        setHtml(formatted);
      })
      .catch(() => {
        if (!cancelled) {
          const sanitized = sanitizeHtml(String(rawInput));
          const formatted = formatExplanationTables(sanitized);
          setHtml(formatted);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rawInput, display]);

  const hasBlockTags = /<(?:p|div|table|ul|ol|li|h[1-6]|blockquote)/i.test(html);

  if (display || hasBlockTags) {
    return (
      <div
        ref={ref}
        className={`math-rendered math-renderer-content ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      ref={ref}
      className={`math-rendered math-renderer-content inline ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
