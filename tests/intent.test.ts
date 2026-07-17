import { describe, expect, it } from "vitest";

import { createParser, fetchIntent, parse } from "../src/index.js";

// The intent mapping is original work for UA Compass, keyed on each vendor's
// public documentation of its crawler's stated purpose. Fixtures are synthetic.

describe("fetchIntent (advisory)", () => {
  it.each([
    [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
      "ai-training",
    ],
    [
      "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      "ai-training",
    ],
    ["CCBot/1.0", "ai-training"],
    ["OAI-SearchBot/1.0", "search-index"],
    ["Claude-SearchBot/1.0", "search-index"],
    ["PerplexityBot/1.0", "search-index"],
    [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "search-index",
    ],
    [
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "search-index",
    ],
    [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "social-preview",
    ],
    [
      "Mozilla/5.0 (compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)",
      "monitoring",
    ],
    [
      "Mozilla/5.0 (compatible; Feedly/1.0; +http://www.feedly.com/fetcher.html)",
      "content-feed",
    ],
    [
      "Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
      "user-fetch",
    ],
    ["curl/8.4.0", "automation-library"],
    ["python-requests/2.31.0", "automation-library"],
  ])("classifies %s as %s", (ua, intent) => {
    expect(fetchIntent(parse(ua))).toBe(intent);
  });

  it("separates a regular browser from an unknown client", () => {
    const chrome = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
    );
    expect(fetchIntent(chrome)).toBe("browser");

    expect(fetchIntent(parse(""))).toBe("unknown");
  });

  it("uses an honest coarse fallback for unrecognized automated clients", () => {
    const parser = createParser({
      customRulePacks: [
        {
          name: "internal",
          rules: [
            {
              id: "acme-crawler",
              match: { all: ["AcmeCrawler/"] },
              result: {
                target: "client",
                type: "crawler",
                name: "Acme Crawler",
              },
            },
          ],
        },
      ],
    });
    expect(fetchIntent(parser.parse("AcmeCrawler/1.0"))).toBe(
      "automated-fetch",
    );
  });

  it("classifies email, media-player, and embedded clients coarsely", () => {
    expect(
      fetchIntent(
        parse(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Thunderbird/115.6.0",
        ),
      ),
    ).toBe("user-fetch");
    expect(fetchIntent(parse("VLC/3.0.20 LibVLC/3.0.20"))).toBe("media");
    expect(
      fetchIntent(
        parse(
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SampleApp/1.0 Chrome/122.0.6261.120 Electron/28.1.0 Safari/537.36",
        ),
      ),
    ).toBe("embedded-app");
  });
});
