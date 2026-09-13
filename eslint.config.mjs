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
    // Capacitor copies the static export here; not source.
    "ios/App/App/public/**",
    "ios/DerivedData/**",
  ]),
  {
    files: ["src/components/**/*.{tsx,jsx}", "src/app/**/*.{tsx,jsx}"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: [
            "·",
            "•",
            "—",
            "–",
            "-",
            "/",
            ":",
            ",",
            ".",
            "…",
            "(",
            ")",
            "%",
            "+",
            "#",
            "×",
            "°",
            "−",
            "% ·",
            " ",
            "\u00a0",
            "· ",
            " · ",
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
