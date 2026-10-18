import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist", "node_modules", "uploads"] },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
        describe: "readonly",
        test: "readonly",
        expect: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        it: "readonly",
        jest: "readonly",
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // no-empty is a hard error (surfaces swallowed best-effort failures);
      // everything else is warn so existing code passes and regressions show
      // up in output without breaking the gate. .eslintrc.json was silently
      // ignored by ESLint 10 flat config — these were its intended rules.
      "no-empty": "error",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          // CRITICAL: the codebase strips answer keys before sending rows to the
          // client, e.g.
          //   const { correctAnswer, correct_option, isCorrect, ...safe } = q;
          //   return safe;
          // Those bindings are "unused" on purpose — destructuring them IS the
          // removal. Ignoring them is what stops correct answers leaking to the
          // browser; do NOT set this to false or delete those bindings.
          ignoreRestSiblings: true,
        },
      ],
      // "smart" (not "always") so the deliberate nullish idiom `v != null`
      // — which asserts "neither null nor undefined" — is allowed. The
      // codebase uses it ~60x on request bodies and DB rows where a value may
      // arrive as either null or undefined; rewriting those to `!== null &&
      // !== undefined` is noise and typo-prone for zero behaviour change.
      // Plain `a == b` comparisons are still reported.
      eqeqeq: ["warn", "smart"],
      "no-var": "warn",
      "prefer-const": "warn",
      camelcase: "off",
      "no-console": "off",
    },
  },
];
