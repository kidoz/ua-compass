import type { ParseResult } from "./types.js";

export function isBot(result: ParseResult): boolean {
  const type = result.client.type;
  return type === "bot" || type === "crawler" || type === "ai-crawler";
}

export function isAiClient(result: ParseResult): boolean {
  const type = result.client.type;
  return type === "ai-crawler" || type === "ai-assistant";
}
