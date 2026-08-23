import { useEffect, useRef, useState } from "react";
import "katex/dist/katex.min.css";
import { sanitizeHtml, decodeHtmlEntities } from "../lib/htmlSanitizer";

// Maps common Unicode superscripts, subscripts, Greek letters, and math symbols to LaTeX
const UNICODE_MATH_MAP = [
  // Unicode minus & arithmetic symbols
  [/\u2212/g, "-"],
  [/×/g, "\\times "],
  [/÷/g, "\\div "],
  [/±/g, "\\pm "],
  [/≠/g, "\\neq "],
  [/≤/g, "\\le "],
  [/≥/g, "\\ge "],
  [/≈/g, "\\approx "],
  [/∞/g, "\\infty "],
  [/°/g, "^\\circ "],

  // Greek letters
  [/θ/g, "\\theta "],
  [/α/g, "\\alpha "],
  [/β/g, "\\beta "],
  [/γ/g, "\\gamma "],
  [/δ/g, "\\delta "],
  [/λ/g, "\\lambda "],
  [/π/g, "\\pi "],
  [/Δ/g, "\\Delta "],
  [/μ/g, "\\mu "],
  [/σ/g, "\\sigma "],
  [/φ/g, "\\phi "],
  [/ω/g, "\\omega "],

  // Superscripts
  [/²/g, "^2"],
  [/³/g, "^3"],
  [/⁴/g, "^4"],
  [/⁵/g, "^5"],
  [/⁶/g, "^6"],
  [/⁷/g, "^7"],
  [/⁸/g, "^8"],
  [/⁹/g, "^9"],
  [/⁰/g, "^0"],
  [/⁺/g, "^+"],
  [/⁻/g, "^-"],
  [/ⁿ/g, "^n"],

  // Subscripts
  [/₀/g, "_0"],
  [/₁/g, "_1"],
  [/₂/g, "_2"],
  [/₃/g, "_3"],
  [/₄/g, "_4"],
  [/₅/g, "_5"],
  [/₆/g, "_6"],
  [/₇/g, "_7"],
  [/₈/g, "_8"],
  [/₉/g, "_9"],
  [/ₙ/g, "_n"],
];

/**
 * Normalizes plain text math expressions, converting trig functions,
 * unicode characters, and stacked multiline fractions into valid LaTeX.
 */
function normalizeMathString(input) {
  if (!input || typeof input !== "string") return "";
  let str = input;

  // Apply unicode replacements
  for (const [pattern, replacement] of UNICODE_MATH_MAP) {
    str = str.replace(pattern, replacement);
  }

  // Convert raw square root symbols: √16, √(x+y), √x
  str = str.replace(/√\(([^)]+)\)/g, "\\sqrt{$1}");
  str = str.replace(/√([0-9a-zA-Z]+)/g, "\\sqrt{$1}");

  // Convert trig & algebraic functions without backslashes to LaTeX macros
  // e.g. sin, cos, tan, sec, cosec, csc, cot, log, ln, lim
  str = str.replace(
    /(?<!\\)\b(sin|cos|tan|sec|cosec|csc|cot|log|ln|lim)\b(?!\s*\{)/gi,
    "\\$1",
  );

  // Detect stacked multiline math fractions (e.g. 5\sin\theta+2\cos\theta \n 5\sin\theta-\cos\theta)
  // or fractions separated by a dashed line:
  // Numerator
  // ---------
  // Denominator
  str = str.replace(
    /([^\n\r]+?)\s*\r?\n\s*-{2,}\s*\r?\n\s*([^\n\r]+)/g,
    (match, num, den) => {
      const trimmedNum = num.trim();
      const trimmedDen = den.trim();
      if (
        isLikelyMathExpression(trimmedNum) &&
        isLikelyMathExpression(trimmedDen)
      ) {
        return `$$\\frac{${trimmedNum}}{${trimmedDen}}$$`;
      }
      return match;
    },
  );

  // Stacked lines without dashed line (2 consecutive pure math lines)
  const lines = str.split(/\r?\n/);
  const newLines = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i].trim();
    const next = lines[i + 1] ? lines[i + 1].trim() : "";

    if (
      current &&
      next &&
      isPureMathLine(current) &&
      isPureMathLine(next) &&
      !current.startsWith("$") &&
      !current.startsWith("<") &&
      !next.startsWith("<")
    ) {
      newLines.push(`$$\\frac{${current}}{${next}}$$`);
      i++; // Skip the next line as it is consumed into the denominator
    } else {
      newLines.push(lines[i]);
    }
  }

  return newLines.join("\n");
}

/**
 * Checks if a string line is a pure mathematical expression without conversational words or HTML tags
 */
function isPureMathLine(text) {
  if (!text || text.length > 120) return false;
  // If it contains any HTML tags, it is NOT pure math — KaTeX must never parse HTML tags as math operators
  if (/<[a-zA-Z/][^>]*>/.test(text)) return false;
  // If it contains natural language words in English or Hindi, it's not a pure math line
  if (
    /[a-zA-Z]{5,}/.test(
      text.replace(
        /\\(sin|cos|tan|sec|cosec|csc|cot|theta|alpha|beta|gamma|lambda|sqrt|frac|times|div|approx|infty|Delta|circ)/g,
        "",
      ),
    )
  ) {
    return false;
  }
  if (/[\u0900-\u097F]/.test(text)) {
    // Has Hindi characters
    return false;
  }
  // Must contain math operators or functions
  return /\\(?:sin|cos|tan|sec|cosec|csc|cot|theta|alpha|beta|gamma|sqrt|frac|times|div|Delta)|[0-9+\-*/=^()_]/.test(
    text,
  );
}

/**
 * Checks if a string contains math symbols
 */
function isLikelyMathExpression(text) {
  if (!text) return false;
  return /\\(?:sin|cos|tan|sec|cosec|csc|cot|theta|alpha|beta|gamma|sqrt|frac|times|div|Delta)|[0-9+\-*/=^()]/.test(
    text,
  );
}

/**
 * Safely renders a LaTeX formula to KaTeX HTML string
 */
function renderKatexFormula(katex, formula, isDisplay) {
  if (!formula || typeof formula !== "string") return "";
  try {
    return katex.renderToString(formula.trim(), {
      displayMode: isDisplay,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return formula;
  }
}

/**
 * Finds and renders all LaTeX formulas (delimited and standalone) in mixed text
 */
function processAndRenderMath(str, katex, defaultDisplay = false) {
  if (!str || typeof str !== "string") return "";
  const normalized = normalizeMathString(str);

  // 1. Process explicit math delimiters: $$, \[\], \(\), $
  let result = normalized.replace(
    /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$([^$]+?)\$/g,
    (match, block1, block2, inline1, inline2) => {
      const eq = block1 || block2 || inline1 || inline2;
      if (!eq) return match;
      const isDisplay =
        defaultDisplay ||
        !!block1 ||
        !!block2 ||
        match.startsWith("$$") ||
        match.startsWith("\\[");
      return renderKatexFormula(katex, eq, isDisplay);
    },
  );

  // 2. Process standalone LaTeX expressions without delimiters in mixed text
  // e.g. \frac{a}{b}, \sqrt{x}, \tan\theta = 3/7, 7\tan\theta = 3, \sin^2\theta + \cos^2\theta = 1
  // Regex matches fractions, roots, trig equations, and standalone symbols
  result = result.replace(
    /\\frac\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\sqrt(?:\[[^\]]*\])?\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\b\d*\s*\\(?:sin|cos|tan|sec|cosec|csc|cot)\s*(?:\^?\d*|\^[^{}\s]+|\^\{[^{}]+\})?\s*\\?(?:theta|alpha|beta|gamma|lambda|pi|x|y|z|A|B|C|\d+)?\s*(?:[=+\-*/]\s*[^,\n;।!?.<]+)?|\\(?:theta|alpha|beta|gamma|delta|lambda|pi|Delta|mu|sigma|phi|omega|pm|times|div|neq|le|ge|approx|infty|circ)\b/g,
    (match) => {
      // Don't re-render if inside an already-rendered KaTeX element
      if (match.includes('class="katex"') || match.includes("<span")) {
        return match;
      }
      return renderKatexFormula(katex, match, defaultDisplay);
    },
  );

  // 3. Fallback: if the whole input is a pure single math equation (e.g. in test options like "A. 29/8" or "sqrt(5)")
  if (!result.includes('class="katex"') && isPureMathLine(normalized.trim())) {
    const rendered = renderKatexFormula(
      katex,
      normalized.trim(),
      defaultDisplay,
    );
    if (rendered && rendered.includes('class="katex"')) {
      result = rendered;
    }
  }

  return result;
}

function formatExplanationTables(htmlString) {
  if (
    typeof window === "undefined" ||
    !htmlString ||
    !htmlString.includes("<table")
  ) {
    return htmlString;
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    const tables = Array.from(doc.querySelectorAll("table"));
    if (tables.length === 0) return htmlString;

    tables.forEach((table) => {
      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length === 2) {
        const headerCells = Array.from(rows[0].querySelectorAll("th, td"));
        const dataCells = Array.from(rows[1].querySelectorAll("td"));

        if (headerCells.length > 0 && headerCells.length === dataCells.length) {
          const headerTexts = headerCells.map((c) =>
            c.textContent.trim().toLowerCase(),
          );

          // Only apply pedagogical layout if structured explanation headers are present
          const isStructuredExplanation = headerTexts.some(
            (t) =>
              t.includes("concept") ||
              t.includes("understanding") ||
              t.includes("application") ||
              t.includes("अवधारणा") ||
              t.includes("समझ") ||
              t.includes("अनुप्रयोग"),
          );

          if (isStructuredExplanation) {
            const container = doc.createElement("div");
            const cols =
              headerCells.length === 2
                ? "md:grid-cols-2"
                : headerCells.length === 3
                  ? "md:grid-cols-3"
                  : "md:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
            container.className = `pedagogical-grid grid grid-cols-1 ${cols} gap-3 my-3`;

            headerCells.forEach((headerCell, idx) => {
              const headerText = headerCell.textContent.trim();
              const lower = headerText.toLowerCase();

              let icon = "📌";
              let badgeBg = "bg-slate-50 dark:bg-slate-900/60";
              let border = "border-slate-200 dark:border-slate-700";
              let textColor = "text-slate-800 dark:text-slate-200";

              if (lower.includes("concept") || lower.includes("अवधारणा")) {
                icon = "💡";
                badgeBg = "bg-indigo-50/90 dark:bg-indigo-950/40";
                border = "border-indigo-200 dark:border-indigo-800";
                textColor = "text-indigo-700 dark:text-indigo-300";
              } else if (
                lower.includes("understanding") ||
                lower.includes("समझ")
              ) {
                icon = "🎯";
                badgeBg = "bg-amber-50/90 dark:bg-amber-950/40";
                border = "border-amber-200 dark:border-amber-800";
                textColor = "text-amber-700 dark:text-amber-300";
              } else if (
                lower.includes("application") ||
                lower.includes("अनुप्रयोग")
              ) {
                icon = "🚀";
                badgeBg = "bg-emerald-50/90 dark:bg-emerald-950/40";
                border = "border-emerald-200 dark:border-emerald-800";
                textColor = "text-emerald-700 dark:text-emerald-300";
              }

              const card = doc.createElement("div");
              card.className = `p-3.5 rounded-xl border ${border} ${badgeBg} flex flex-col justify-start`;

              const title = doc.createElement("div");
              title.className = `text-xs font-bold uppercase tracking-wider ${textColor} mb-2 flex items-center gap-1.5`;
              title.innerHTML = `<span>${icon}</span><span>${headerText}</span>`;

              const body = doc.createElement("div");
              body.className =
                "text-xs text-slate-700 dark:text-slate-300 leading-relaxed flex-1 space-y-1";
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
      if (
        !table.parentElement ||
        !table.parentElement.classList.contains("overflow-x-auto")
      ) {
        const wrapper = doc.createElement("div");
        wrapper.className = "overflow-x-auto my-2.5";
        table.className =
          "w-full text-xs text-left border-collapse border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden";
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
    });

    return doc.body.innerHTML;
  } catch {
    return htmlString;
  }
}

export default function MathRenderer({
  text,
  content,
  children,
  display = false,
  className = "",
}) {
  const ref = useRef(null);
  const [html, setHtml] = useState("");

  const rawInput =
    text ?? content ?? (typeof children === "string" ? children : "") ?? "";

  useEffect(() => {
    if (!rawInput) {
      setHtml("");
      return;
    }
    let cancelled = false;
    const decodedInput = decodeHtmlEntities(String(rawInput));

    // KaTeX is loaded dynamically for efficient bundle size
    import("katex")
      .then(({ default: katex }) => {
        if (cancelled) return;
        const renderedMath = processAndRenderMath(decodedInput, katex, display);
        const formattedTables = formatExplanationTables(renderedMath);
        const sanitized = sanitizeHtml(formattedTables);
        setHtml(sanitized);
      })
      .catch(() => {
        if (!cancelled) {
          const formattedTables = formatExplanationTables(decodedInput);
          const sanitized = sanitizeHtml(formattedTables);
          setHtml(sanitized);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rawInput, display]);

  const hasBlockTags =
    /<(?:p|div|table|ul|ol|li|h[1-6]|blockquote)/i.test(html) ||
    html.includes('class="katex-display"');

  if (display || hasBlockTags) {
    return (
      <div
        ref={ref}
        className={`math-renderer-content ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      ref={ref}
      className={`math-renderer-content inline ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
