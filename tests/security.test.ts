import { describe, expect, it } from "vitest";

import {
  InputLimitError,
  RuleValidationError,
  clientHintsFromHeaders,
  createParser,
  parse,
} from "../src/index.js";
import type { DetectionRule, RulePack, RuleResult } from "../src/index.js";

function unsafePack(rule: unknown): readonly RulePack[] {
  return [{ name: "test", rules: [rule as DetectionRule] }];
}

// Deterministic LCG so fuzz runs are reproducible (no Math.random / Date).
function lcg(seed: number): () => number {
  let state = seed | 0;
  return (): number => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) | 0;
    return state >>> 0;
  };
}

const CLIENT_TYPES = new Set([
  "browser",
  "webview",
  "bot",
  "crawler",
  "ai-crawler",
  "ai-assistant",
  "cli",
  "library",
  "email",
  "mediaplayer",
  "embedded",
  "unknown",
]);
const STRUCTURED_TOKENS = [
  "Chrome/",
  "Firefox/",
  "Safari/",
  "Mozilla/5.0",
  "Android",
  "Windows NT ",
  "OculusBrowser",
  "Googlebot/",
  ";",
  '"',
  "(",
  ")",
  "\\",
  "__proto__",
];

function fuzzString(next: () => number, maxLength: number): string {
  const length = next() % (maxLength + 1);
  let value = "";
  while (value.length < length) {
    if (next() % 8 === 0) {
      value += STRUCTURED_TOKENS[next() % STRUCTURED_TOKENS.length] ?? "";
    } else {
      value += String.fromCharCode(next() & 0xffff);
    }
  }
  return value;
}

describe("security boundaries", () => {
  it.each([
    [null, "must be an object"],
    [
      {
        id: "x",
        match: { all: [] },
        result: { target: "cpu", architecture: "x" },
      },
      "non-empty",
    ],
    [
      {
        id: "x",
        match: { all: [""] },
        result: { target: "cpu", architecture: "x" },
      },
      "from 1",
    ],
    [
      {
        id: "x",
        match: { all: ["   "] },
        result: { target: "cpu", architecture: "x" },
      },
      "blank",
    ],
    [
      {
        id: "x",
        match: { all: ["x"], none: "x" },
        result: { target: "cpu", architecture: "x" },
      },
      "must be an array",
    ],
    [
      { id: "x", match: { all: ["x"] }, result: { target: "invalid" } },
      "invalid target",
    ],
    [
      {
        id: "x",
        match: { all: ["x"] },
        result: { target: "client", type: "browser" },
      },
      "type is invalid",
    ],
    [
      {
        id: "x",
        match: { all: ["x"] },
        result: { target: "device", type: "spaceship" },
      },
      "type is invalid",
    ],
    [
      {
        id: "x",
        match: { all: ["x"] },
        result: { target: "browser", clientType: "bot" },
      },
      "clientType is invalid",
    ],
  ])("rejects malformed custom rule %#", (rule, message) => {
    expect(() => createParser({ customRulePacks: unsafePack(rule) })).toThrow(
      message,
    );
  });

  it("rejects a custom rule id that collides with a bundled rule id", () => {
    expect(() =>
      createParser({
        customRulePacks: [
          {
            name: "override",
            rules: [
              {
                id: "browser-chrome",
                match: { all: ["Custom/"] },
                result: { target: "browser", name: "Custom" },
              },
            ],
          },
        ],
      }),
    ).toThrow("duplicate rule id browser-chrome");
  });

  it("rejects duplicate ids, excessive token counts, rules, and long fields", () => {
    const valid: DetectionRule = {
      id: "same",
      match: { all: ["x"] },
      result: { target: "engine", name: "X" },
    };
    expect(() =>
      createParser({ customRulePacks: [{ name: "x", rules: [valid, valid] }] }),
    ).toThrow("duplicate");
    expect(() =>
      createParser({
        customRulePacks: unsafePack({
          ...valid,
          match: { all: ["1", "2", "3", "4", "5"] },
        }),
      }),
    ).toThrow("too many tokens");
    expect(() =>
      createParser({
        customRulePacks: [{ name: "x", rules: new Array(65).fill(valid) }],
      }),
    ).toThrow("at most 64");
    expect(() =>
      createParser({ customRulePacks: [{ name: "x".repeat(129), rules: [] }] }),
    ).toThrow(RuleValidationError);
  });

  it.each<RuleResult>([
    { target: "browser", name: "Custom", version: "1", clientType: "webview" },
    { target: "client", name: "Custom", version: "1", type: "embedded" },
    { target: "engine", name: "Custom", version: "1" },
    { target: "os", name: "Custom", version: "1" },
    { target: "device", type: "wearable", vendor: "Acme", model: "Watch" },
    { target: "cpu", architecture: "custom", bitness: "16" },
  ])("accepts and executes bounded result target $target", (result) => {
    const parser = createParser({
      customRulePacks: [
        {
          name: "targets",
          rules: [
            {
              id: `target-${result.target}`,
              match: { all: ["target"] },
              result,
            },
          ],
        },
      ],
    });
    expect(
      parser.parse("target")[result.target === "os" ? "os" : result.target],
    ).toBeDefined();
  });

  it("rejects malformed Client Hints", () => {
    expect(() => parse("x", { clientHints: null as never })).toThrow(
      "must be an object",
    );
    expect(() =>
      parse("x", {
        clientHints: {
          brands: new Array(17).fill({ brand: "x", version: "1" }),
        },
      }),
    ).toThrow("at most 16");
    expect(() =>
      parse("x", { clientHints: { brands: [null as never] } }),
    ).toThrow("must be an object");
    expect(() =>
      parse("x", {
        clientHints: { brands: [{ brand: "x".repeat(257), version: "1" }] },
      }),
    ).toThrow("at most 256");
    expect(() =>
      parse("x", { clientHints: { mobile: "yes" as never } }),
    ).toThrow("must be boolean");
    expect(() => parse("x", null as never)).toThrow(
      "parse options must be an object",
    );
  });

  it("ignores inherited parser and parse options", () => {
    const inheritedRulePacks = {
      customRulePacks: [
        {
          name: "inherited",
          rules: [
            {
              id: "inherited-client",
              match: { all: ["InheritedClient/"] },
              result: {
                target: "client",
                type: "bot",
                name: "Inherited",
              },
            },
          ],
        },
      ],
      maxUserAgentLength: 1,
      overflowBehavior: "truncate",
    };
    const parser = createParser(
      Object.create(inheritedRulePacks) as Record<string, never>,
    );
    expect(parser.parse("InheritedClient/1").client).toEqual({
      type: "unknown",
    });
    expect(parser.parse("curl/8").ua).toBe("curl/8");

    const parseOptions = Object.create({
      clientHints: { platform: "Windows" },
    }) as Record<string, never>;
    expect(parse("", parseOptions).os).toEqual({});
  });

  it("ignores inherited hint fields and rejects inherited rule structure", () => {
    const clientHints = Object.create({
      platform: "Windows",
      mobile: true,
    }) as unknown as { readonly platform?: string; readonly mobile?: boolean };
    expect(parse("", { clientHints }).os).toEqual({});
    expect(parse("", { clientHints }).device).toEqual({ type: "unknown" });

    const inheritedRule = Object.create({
      id: "inherited",
      match: { all: ["x"] },
      result: { target: "client", type: "bot" },
    }) as unknown as DetectionRule;
    expect(() =>
      createParser({
        customRulePacks: [{ name: "inherited", rules: [inheritedRule] }],
      }),
    ).toThrow(RuleValidationError);
  });

  it("maintains invariants across deterministic fuzz input", () => {
    const next = lcg(0x1234abcd);
    for (let sample = 0; sample < 2_000; sample += 1) {
      const value = fuzzString(next, 400);
      const result = parse(value);
      expect(result.ua.length).toBeLessThanOrEqual(value.length);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.browser)).toBe(true);
      expect(Object.isFrozen(result.device)).toBe(true);
      expect(CLIENT_TYPES.has(result.client.type)).toBe(true);
    }
  });

  it("fails predictably at and beyond the length limits in both overflow modes", () => {
    const limit = 65_536;
    const throwParser = createParser({
      maxUserAgentLength: limit,
      overflowBehavior: "throw",
    });
    const truncateParser = createParser({
      maxUserAgentLength: limit,
      overflowBehavior: "truncate",
    });
    for (const length of [
      0, 1, 4095, 4096, 4097, 65_535, 65_536, 65_537, 200_000,
    ]) {
      const ua = `Chrome/122.0.0.0 ${"A".repeat(length)}`;

      // Default parser: throws above the 4096 default, otherwise succeeds.
      if (ua.length > 4096) {
        expect(() => parse(ua)).toThrow(InputLimitError);
      } else {
        expect(Object.isFrozen(parse(ua))).toBe(true);
      }

      // Truncate mode never throws and always bounds the retained input.
      const truncated = truncateParser.parse(ua);
      expect(truncated.ua.length).toBeLessThanOrEqual(limit);
      expect(Object.isFrozen(truncated)).toBe(true);

      // Throw mode at the configured limit.
      if (ua.length > limit) {
        expect(() => throwParser.parse(ua)).toThrow(InputLimitError);
      } else {
        expect(Object.isFrozen(throwParser.parse(ua))).toBe(true);
      }
    }
  });

  it("never throws while normalizing fuzzed Sec-CH-UA* headers", () => {
    const next = lcg(0x0badf00d);
    const keys = [
      "sec-ch-ua",
      "sec-ch-ua-full-version-list",
      "sec-ch-ua-mobile",
      "sec-ch-ua-platform",
      "sec-ch-ua-platform-version",
      "sec-ch-ua-arch",
      "sec-ch-ua-bitness",
      "sec-ch-ua-model",
      "sec-ch-ua-form-factors",
    ];
    for (let sample = 0; sample < 1_000; sample += 1) {
      const headers: Record<string, string> = {};
      for (const key of keys) {
        if (next() % 3 !== 0) headers[key] = fuzzString(next, 300);
      }
      const hints = clientHintsFromHeaders(headers);
      expect(hints === undefined || typeof hints === "object").toBe(true);
      // The normalized hints must be safe to feed back into parse().
      const result = parse("Mozilla/5.0", { clientHints: hints });
      expect(Object.isFrozen(result)).toBe(true);
    }
  });

  it("either parses or throws a typed error for fuzzed structured Client Hints", () => {
    const next = lcg(0x51513);
    const platforms = ["Windows", "macOS", "Android", "Linux", "Fuchsia", ""];
    for (let sample = 0; sample < 1_000; sample += 1) {
      const brands = Array.from(
        { length: next() % 20 },
        (): { brand: string; version: string } => ({
          brand: fuzzString(next, 40),
          version: fuzzString(next, 12),
        }),
      );
      const hints = {
        brands,
        mobile: next() % 4 === 0 ? ("maybe" as never) : next() % 2 === 0,
        platform: platforms[next() % platforms.length] ?? "",
        platformVersion: fuzzString(next, 20),
        architecture: fuzzString(next, 12),
        bitness: fuzzString(next, 6),
        model: fuzzString(next, 40),
      };
      try {
        const result = parse("Mozilla/5.0 Chrome/122.0.0.0", {
          clientHints: hints,
        });
        expect(Object.isFrozen(result)).toBe(true);
      } catch (error) {
        // Malformed hints fail predictably with a typed error, never a hang.
        expect(
          error instanceof RuleValidationError || error instanceof TypeError,
        ).toBe(true);
      }
    }
  });

  it("either builds a parser or throws RuleValidationError for fuzzed custom packs", () => {
    const next = lcg(0xc0ffee);
    const targets = [
      "browser",
      "client",
      "engine",
      "os",
      "device",
      "cpu",
      "??",
    ];
    const types = ["bot", "browser", "email", "xr", "unknown", "spaceship"];
    for (let sample = 0; sample < 1_000; sample += 1) {
      const rules = Array.from(
        { length: next() % 6 },
        (_unused, index): unknown => ({
          id: `fuzz-${String(sample)}-${String(index)}`,
          match: {
            all: Array.from({ length: 1 + (next() % 5) }, (): string =>
              fuzzString(next, 20),
            ),
          },
          result: {
            target: targets[next() % targets.length],
            type: types[next() % types.length],
            name: fuzzString(next, 20),
            architecture: fuzzString(next, 12),
          },
        }),
      );
      try {
        const parser = createParser({
          customRulePacks: [
            {
              name: `pack-${String(sample)}`,
              rules: rules as readonly DetectionRule[],
            },
          ],
        });
        expect(Object.isFrozen(parser.parse("target"))).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(RuleValidationError);
      }
    }
  });

  it("handles hostile near-misses with bounded literal matching", () => {
    const parser = createParser({ maxUserAgentLength: 65_536 });
    const hostile = `${"Chrome".repeat(10_000)}!`;
    expect(parser.parse(hostile).browser).toEqual({});
  });

  it("demotes a UA-derived mobile class to unknown, never desktop, on mobile:false", () => {
    // Sec-CH-UA-Mobile is a UX-preference boolean (WICG), not a hardware
    // assertion: ?0 means "prefers a non-mobile experience" and does not prove
    // desktop hardware. A contradicting mobile class must collapse to unknown,
    // never assert desktop. Only Chromium clients send this hint.
    const androidPhone = parse(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Mobile Safari/537.36",
      { clientHints: { mobile: false } },
    );
    expect(androidPhone.device.type).toBe("unknown");

    // An iPhone UA with no mobile hint present proves the UA token wins
    // untouched: iOS Safari does not send Sec-CH-UA-Mobile.
    const iPhone = parse(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    expect(iPhone.device.type).toBe("mobile");
  });
});
