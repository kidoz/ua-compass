import { describe, expect, it } from "vitest";

import { createParser, isAiClient, isBot, parse } from "../src/index.js";

describe("AI crawlers and assistants", () => {
  it.each([
    [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot",
      "ai-crawler",
      "OAI-SearchBot",
      "1.0",
    ],
    [
      "Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)",
      "ai-crawler",
      "Claude-SearchBot",
      "1.0",
    ],
    ["CCBot/2.0 (https://commoncrawl.org/faq/)", "ai-crawler", "CCBot", "2.0"],
    [
      "meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
      "ai-crawler",
      "meta-externalagent",
      "1.1",
    ],
    [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
      "ai-assistant",
      "ChatGPT-User",
      "1.0",
    ],
    [
      "Mozilla/5.0 (compatible; Claude-User/1.0; +https://www.anthropic.com)",
      "ai-assistant",
      "Claude-User",
      "1.0",
    ],
    [
      "Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
      "ai-assistant",
      "Perplexity-User",
      "1.0",
    ],
    [
      "meta-externalfetcher/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)",
      "ai-assistant",
      "meta-externalfetcher",
      "1.1",
    ],
  ])("classifies %s", (ua, type, name, version) => {
    const result = parse(ua);
    expect(result.client).toEqual({ type, name, version });
    expect(result.browser).toEqual({});
  });

  it("keeps distinct vendor tokens from shadowing each other", () => {
    expect(parse("Mozilla/5.0 (compatible; ClaudeBot/1.0)").client.name).toBe(
      "ClaudeBot",
    );
    expect(parse("Mozilla/5.0 (compatible; Claude-User/1.0)").client.name).toBe(
      "Claude-User",
    );
    expect(
      parse("Mozilla/5.0 (compatible; PerplexityBot/1.0)").client.type,
    ).toBe("ai-crawler");
  });

  it("exposes client-category guards", () => {
    const aiCrawler = parse("Mozilla/5.0 (compatible; GPTBot/1.1)");
    expect(isBot(aiCrawler)).toBe(true);
    expect(isAiClient(aiCrawler)).toBe(true);

    const assistant = parse("Mozilla/5.0 (compatible; ChatGPT-User/1.0)");
    expect(isBot(assistant)).toBe(false);
    expect(isAiClient(assistant)).toBe(true);

    const crawler = parse("Googlebot/2.1 (+https://www.google.com/bot.html)");
    expect(isBot(crawler)).toBe(true);
    expect(isAiClient(crawler)).toBe(false);

    const browser = parse(
      "Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0",
    );
    expect(isBot(browser)).toBe(false);
    expect(isAiClient(browser)).toBe(false);
  });

  it("accepts the AI client types in custom rule packs", () => {
    const parser = createParser({
      customRulePacks: [
        {
          name: "custom-ai",
          rules: [
            {
              id: "custom-ai-agent",
              match: { all: ["ExampleAgent/"] },
              result: {
                target: "client",
                type: "ai-assistant",
                name: "ExampleAgent",
              },
              versionPrefix: "ExampleAgent/",
            },
          ],
        },
      ],
    });
    expect(parser.parse("ExampleAgent/2.0").client).toEqual({
      type: "ai-assistant",
      name: "ExampleAgent",
      version: "2.0",
    });
  });
});
