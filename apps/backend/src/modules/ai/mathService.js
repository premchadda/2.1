import { pool } from '../../infrastructure/database/postgres-helpers.js';

// KaTeX is a large (~300KB) dependency; load it on demand so it is not pulled
// into the backend module graph until math rendering is actually requested.
let katexPromise
const getKatex = async () => {
  if (!katexPromise) katexPromise = import('katex')
  return katexPromise
}

const mathService = {
  async renderMath(text, options = {}) {
    const { displayMode = false, throwOnError = false } = options;
    const katex = await getKatex();
    
    const processed = text.replace(
      /\$\$([\s\S]*?)\$\$|\\\([\s\S]*?\\\)|\$([^$]+)\$/g,
      (match, displayEq, parenEq, inlineEq) => {
        const eq = displayEq || parenEq || inlineEq;
        if (!eq) return match;
        try {
          return katex.renderToString(eq.trim(), { 
            displayMode: !!displayEq || match.startsWith('$$'),
            throwOnError,
            output: 'html'
          });
        } catch {
          return match;
        }
      }
    );
    
    return processed;
  },

  async renderBatch(texts, options = {}) {
    return Promise.all(texts.map(text => this.renderMath(text, options)));
  },

  async validateMathExpression(expression) {
    const katex = await getKatex();
    try {
      katex.renderToString(expression, { throwOnError: true });
      return { valid: true };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }
};

export default mathService;