// Flat ESLint config (ESLint 9+).
//
// The app is a plain React + TypeScript SPA: React Router, Tailwind and the
// browser APIs. There is no agent-server client, no i18n layer and no design
// system package, so the rules that enforced those (typed-client fetch bans,
// i18next literal-string checks, @shadcn/lint) are gone with the code they
// policed.

import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import importXPlugin from "eslint-plugin-import-x";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "build/**",
      ".react-router/**",
      "android/**",
    ],
  },

  js.configs.recommended,
  importXPlugin.flatConfigs.recommended,
  importXPlugin.flatConfigs.typescript,

  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2024,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "jsx-a11y": jsxA11yPlugin,
      "unused-imports": unusedImportsPlugin,
      import: importXPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      react: { version: "detect" },
      "import-x/resolver": { typescript: true },
    },
    rules: {
      ...tsPlugin.configs["eslint-recommended"].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,
      ...reactHooksPlugin.configs.recommended.rules,
      ...jsxA11yPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      "prettier/prettier": "error",

      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          caughtErrors: "none",
        },
      ],

      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/require-default-props": "off",

      "import-x/extensions": [
        "error",
        "ignorePackages",
        { "": "never", ts: "never", tsx: "never", js: "never", jsx: "never" },
      ],
      "import-x/prefer-default-export": "off",
      "import-x/no-extraneous-dependencies": "off",
      "import-x/no-unresolved": "off",
      "import-x/no-named-as-default": "off",
      "import-x/no-named-as-default-member": "off",

      "no-param-reassign": [
        "error",
        { props: true, ignorePropertyModificationsFor: ["acc", "state"] },
      ],
      "jsx-a11y/no-static-element-interactions": "off",
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/label-has-associated-control": [
        2,
        { required: { some: ["nesting", "id"] } },
      ],
      "no-underscore-dangle": "off",
    },
  },
];
