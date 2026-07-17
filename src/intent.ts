import type { ClientType, ParseResult } from "./types.js";

// Advisory classification of *why* a client is fetching, derived from the
// detected client name and type. This is a best-effort taxonomy over publicly
// documented crawler purposes; a User-Agent match identifies who a client
// claims to be, not verification, so treat `fetchIntent` as advisory rather
// than authentication.
export type FetchIntent =
  | "ai-training"
  | "search-index"
  | "social-preview"
  | "monitoring"
  | "content-feed"
  | "user-fetch"
  | "automation-library"
  | "media"
  | "embedded-app"
  | "browser"
  | "automated-fetch"
  | "unknown";

// Known clients mapped to an advisory intent bucket. The mapping is original
// work for UA Compass, keyed on each vendor's public documentation of its
// crawler's stated purpose. Unrecognized names fall back to a coarse
// intent from `client.type`.
const NAMED_INTENTS: ReadonlyMap<string, FetchIntent> = new Map<
  string,
  FetchIntent
>([
  // AI training / model-data collection (publicly documented training crawlers).
  ["GPTBot", "ai-training"],
  ["ClaudeBot", "ai-training"],
  ["CCBot", "ai-training"],
  ["Bytespider", "ai-training"],
  ["meta-externalagent", "ai-training"],

  // Search engine indexing.
  ["Googlebot", "search-index"],
  ["Googlebot-Image", "search-index"],
  ["bingbot", "search-index"],
  ["YandexBot", "search-index"],
  ["DuckDuckBot", "search-index"],
  ["PetalBot", "search-index"],
  ["AhrefsBot", "search-index"],
  ["SemrushBot", "search-index"],
  ["Applebot", "search-index"],
  ["Amazonbot", "search-index"],
  ["Naver Yeti", "search-index"],
  ["PerplexityBot", "search-index"],
  ["Claude-SearchBot", "search-index"],
  ["OAI-SearchBot", "search-index"],

  // Social / messaging link previews (one fetch per share, not an index).
  ["facebookexternalhit", "social-preview"],
  ["Twitterbot", "social-preview"],
  ["Slackbot", "social-preview"],
  ["Discordbot", "social-preview"],
  ["TelegramBot", "social-preview"],
  ["LinkedInBot", "social-preview"],
  ["WhatsApp", "social-preview"],
  ["Pinterestbot", "social-preview"],
  ["redditbot", "social-preview"],
  ["Line", "social-preview"],

  // Uptime / synthetic monitoring.
  ["UptimeRobot", "monitoring"],
  ["Pingdom", "monitoring"],

  // Feed / content aggregation crawlers.
  ["Feedly", "content-feed"],
  ["MJ12bot", "content-feed"],
  ["DotBot", "content-feed"],
  ["SeznamBot", "content-feed"],

  // User-triggered AI fetches (a person asked the assistant to retrieve a URL).
  ["ChatGPT-User", "user-fetch"],
  ["Claude-User", "user-fetch"],
  ["Perplexity-User", "user-fetch"],
  ["meta-externalfetcher", "user-fetch"],
]);

// Coarse intent for unrecognized client names, keyed on the detected client
// type. Ambiguous automated clients stay in an explicit coarse bucket rather
// than being mislabeled as browsers or assigned a specific vendor purpose.
// Email clients fetch remote content on behalf of the person reading a
// message, so they land in `user-fetch` alongside user-triggered assistants.
const INTENT_BY_TYPE: Readonly<Record<ClientType, FetchIntent>> = {
  bot: "automated-fetch",
  crawler: "automated-fetch",
  "ai-crawler": "automated-fetch",
  "ai-assistant": "user-fetch",
  cli: "automation-library",
  library: "automation-library",
  email: "user-fetch",
  mediaplayer: "media",
  embedded: "embedded-app",
  browser: "browser",
  webview: "browser",
  unknown: "unknown",
};

export function fetchIntent(result: ParseResult): FetchIntent {
  const name = result.client.name;
  if (name !== undefined) {
    const named = NAMED_INTENTS.get(name);
    if (named !== undefined) return named;
  }
  return INTENT_BY_TYPE[result.client.type];
}
