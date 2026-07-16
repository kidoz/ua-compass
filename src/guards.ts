import type { ParseResult } from "./types.js";

export function isBot(result: ParseResult): boolean {
  const type = result.client.type;
  return type === "bot" || type === "crawler" || type === "ai-crawler";
}

export function isAiClient(result: ParseResult): boolean {
  const type = result.client.type;
  return type === "ai-crawler" || type === "ai-assistant";
}

// Chromium-family browsers all render with Blink. Client-Hints-only parses may
// resolve a brand without a UA-derived engine, so a curated set of Blink-based
// browser names is accepted as an additional, non-guessing signal.
const CHROME_FAMILY_BROWSERS: ReadonlySet<string> = new Set([
  "Chrome",
  "Chromium",
  "Microsoft Edge",
  "Opera",
  "Brave",
  "Samsung Internet",
  "Vivaldi",
  "Yandex Browser",
  "UC Browser",
  "Amazon Silk",
  "Meta Quest Browser",
  "MIUI Browser",
  "Huawei Browser",
  "Whale",
  "Maxthon",
  "Android WebView",
]);

export function isChromeFamily(result: ParseResult): boolean {
  if (result.engine.name === "Blink") return true;
  const name = result.browser.name;
  return name !== undefined && CHROME_FAMILY_BROWSERS.has(name);
}

export function isMobile(result: ParseResult): boolean {
  return result.device.type === "mobile";
}

export function isTablet(result: ParseResult): boolean {
  return result.device.type === "tablet";
}

export function isDesktop(result: ParseResult): boolean {
  return result.device.type === "desktop";
}
