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
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      eqeqeq: ["warn", "always"],
      "no-var": "warn",
      "prefer-const": "warn",
      camelcase: "off",
      "no-console": "off",
    },
  },
];
