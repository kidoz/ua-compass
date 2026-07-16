import type { Config } from "prettier";

// Prettier 3 defaults, pinned explicitly so formatting cannot drift if
// upstream defaults change.
const config: Config = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  quoteProps: "as-needed",
  trailingComma: "all",
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
};

export default config;
