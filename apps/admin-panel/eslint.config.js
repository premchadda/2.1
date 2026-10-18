import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist", "coverage"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      // parserOptions.ecmaFeatures/ecmaVersion below is authoritative; the
      // top-level ecmaVersion is kept in sync deliberately.
      ecmaVersion: "latest",
      globals: { ...globals.browser, process: "readonly" },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      ...js.configs.recommended.rules,

      // no-undef is an ERROR because it catches real ReferenceErrors. It was
      // previously "off", which hid 32 undefined-identifier crashes across the
      // curriculum components (CurriculumBuilder / ChapterPageModal /
      // CurriculumGeneralModal). Keep it loud.
      "no-undef": "error",

      // RATCHET: was "off". The remaining findings are dead imports/locals, not
      // runtime bugs. Keep as "warn" so they are visible and can be burned down,
      // but they do not fail the build. Lower to "error" once the count is 0.
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_|^React$",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],

      "no-var": "warn",
      "prefer-const": "warn",
      eqeqeq: ["warn", "always", { null: "ignore" }],
      "no-useless-assignment": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }],

      // React correctness guards.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/jsx-key": "error",
      "react/jsx-no-duplicate-props": "error",
      "react/no-unknown-property": "warn",
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/jsx-uses-vars": "error",
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "18.3" } },
  },
  {
    // Test files need the vitest + node globals that `globals.browser` omits.
    files: [
      "tests/**/*.{js,jsx}",
      "src/**/__tests__/**/*.{js,jsx}",
      "**/*.test.{js,jsx}",
      "vite.config.js",
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
];
