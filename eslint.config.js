import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";

export default defineConfig([
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      },
      ecmaVersion: 2024,
      sourceType: "module"
    },
    plugins: {
      js
    },
    extends: ["js/recommended"],
    rules: {
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "no-undef": "off",
      "prefer-const": "warn",
      "no-var": "warn",
      "eqeqeq": "off",
      "curly": "off",
      "comma-dangle": "off",
      "quotes": ["warn", "single", { allowTemplateLiterals: true }],
      "semi": "off",
      "no-trailing-spaces": "warn",
      "eol-last": "off",
      "indent": "off",
      "no-console": "off",
      "no-debugger": "off",
      "no-prototype-builtins": "warn",
      "no-unreachable": "warn",
      "no-useless-escape": "warn",
      "no-empty": "warn"
    }
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.mocha
      }
    },
    rules: {
      "no-unused-vars": "off",
      "no-console": "off"
    }
  },
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "data/**",
      "config/**",
      "migrations/**",
      "public/**",
      "*.min.js",
      "bun.lock",
      "*.db"
    ]
  }
]);
