import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import { fronteiras } from "./src/arquitetura/fronteiras.ts";

export default defineConfig(
  { ignores: ["coverage/", "node_modules/"] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["*.config.js"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: true },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    name: "testes-de-tipo-usam-ts-expect-error-como-assercao",
    files: ["**/*.test-d.ts"],
    rules: {
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": false }],
    },
  },
  ...fronteiras,
);
