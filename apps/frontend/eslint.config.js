import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist",
      "coverage",
      ".vite",
      "build.out",
      "lint.out",
      "public",
      "graphify-out",
      "scripts",
    ],
  },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        process: "readonly",
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "warn",
      "no-var": "warn",
      "prefer-const": "warn",
      eqeqeq: ["warn", "always", { null: "ignore" }],
      "no-useless-assignment": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: [
      "tests/**/*.{js,jsx}",
      "src/**/__tests__/**/*.{js,jsx}",
      "**/*.test.{js,jsx}",
      "vitest.config.js",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
];
