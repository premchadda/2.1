// KaTeX is a large (~300KB) dependency; load it on demand so it is not pulled
// into the backend module graph until math rendering is actually requested.
let katexPromise;
const getKatex = async () => {
  if (!katexPromise) katexPromise = import("katex");
  return katexPromise;
};

const mathService = {
  async renderMath(text, options = {}) {
    const { displayMode = false, throwOnError = false } = options;
    // The caller's displayMode is an explicit override; when it is not set we
    // infer intent from the delimiter ($$ / \(...\) => display, $...$ => inline).
    const forceDisplay = displayMode === true;
    const katex = await getKatex();

    const processed = text.replace(
      /\$\$([\s\S]*?)\$\$|\\\([\s\S]*?\\\)|\$([^$]+)\$/g,
      (match, displayEq, parenEq, inlineEq) => {
        const eq = displayEq || parenEq || inlineEq;
        if (!eq) return match;
        // Skip pure-currency/arithmetic fragments ("$5 and $10", "$100") —
        // no letters/backslash/operators that need TeX, so leave as-is
        // instead of burning a KaTeX parse that fails anyway.
        if (!displayEq && !parenEq && /^[\d\s.,₹$+\-*/()]+$/.test(eq))
          return match;
        try {
          // No `trust` option: KaTeX escapes HTML by default, so output is
          // safe to inject (no stored-XSS vector through this path).
          return katex.renderToString(eq.trim(), {
            displayMode: forceDisplay || !!displayEq || match.startsWith("$$"),
            throwOnError,
            output: "html",
          });
        } catch {
          return match;
        }
      },
    );

    return processed;
  },

  async renderBatch(texts, options = {}) {
    return Promise.all(texts.map((text) => this.renderMath(text, options)));
  },

  async validateMathExpression(expression) {
    const katex = await getKatex();
    try {
      katex.renderToString(expression, { throwOnError: true });
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  },
};

export default mathService;
