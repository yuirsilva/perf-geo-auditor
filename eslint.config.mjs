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
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored from the Glaze registry (checked by glaze.eslint.config.mjs instead) and installed agent skills.
    "src/components/glaze/**",
    "src/lib/glaze/**",
    "glaze.eslint.config.mjs",
    ".claude/**",
    ".agents/**",
  ]),
]);

export default eslintConfig;
