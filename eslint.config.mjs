import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/api.ts",
    "src/App.tsx",
    "src/checks.ts",
    "src/main.tsx",
    "src/types.ts",
    "vite.config.ts",
  ]),
]);

export default eslintConfig;
