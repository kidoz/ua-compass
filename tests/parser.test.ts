import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_USER_AGENT_LENGTH,
  InputLimitError,
  RuleValidationError,
  createParser,
  parse,
} from "../src/index.js";
import type { RulePack } from "../src/index.js";

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

describe("public parser", () => {
  it("returns explicit unknown category states for empty input", () => {
    expect(parse("")).toEqual({
      ua: "",
      uaReduced: false,
      browser: {},
      engine: {},
      os: {},
      device: { type: "unknown" },
      cpu: {},
      client: { type: "unknown" },
    });
  });

  it("detects Chrome on Windows with Blink and x64", () => {
    const result = parse(CHROME_WINDOWS);
    // The UA is reduced (frozen ".0.0.0" version tail), so the placeholder
    // version tail and the static "10.0" platform version are suppressed.
    expect(result.uaReduced).toBe(true);
    expect(result.browser).toEqual({
      name: "Chrome",
      version: "143",
      major: "143",
    });
    expect(result.client).toEqual({
      type: "browser",
      name: "Chrome",
      version: "143",
    });
    expect(result.engine).toEqual({ name: "Blink" });
    expect(result.os).toEqual({ name: "Windows" });
    expect(result.device).toEqual({ type: "desktop" });
    expect(result.cpu).toEqual({ architecture: "x86_64", bitness: "64" });
  });

  it("gives Edge precedence over the compatibility Chrome token", () => {
    const result = parse(`${CHROME_WINDOWS} Edg/143.0.0.0`);
    expect(result.browser).toEqual({
      name: "Microsoft Edge",
      version: "143",
      major: "143",
    });
  });

  it.each([
    [
      "Firefox",
      "Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0",
      { name: "Firefox", version: "145.0", major: "145" },
      { name: "Gecko", version: "145.0" },
    ],
    [
      "Safari",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
      { name: "Safari", version: "26.0", major: "26" },
      { name: "WebKit", version: "605.1.15" },
    ],
    [
      "Mobile Safari",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
      { name: "Mobile Safari", version: "26.0", major: "26" },
      { name: "WebKit", version: "605.1.15" },
    ],
  ])("detects %s", (_label, ua, browser, engine) => {
    const result = parse(ua);
    expect(result.browser).toEqual(browser);
    expect(result.engine).toEqual(engine);
  });

  it("classifies non-browser clients without populating browser", () => {
    expect(parse("curl/8.12.1")).toMatchObject({
      browser: {},
      client: { type: "cli", name: "curl", version: "8.12.1" },
    });
    expect(parse("Wget/1.25.0").client).toEqual({
      type: "cli",
      name: "Wget",
      version: "1.25.0",
    });
    expect(
      parse("Googlebot/2.1 (+https://www.google.com/bot.html)").client,
    ).toEqual({
      type: "crawler",
      name: "Googlebot",
      version: "2.1",
    });
  });

  it("uses structured Client Hints as higher-confidence browser and platform evidence", () => {
    const result = parse(CHROME_WINDOWS, {
      clientHints: {
        brands: [
          { brand: "Not;A Brand", version: "99" },
          { brand: "Chromium", version: "143" },
          { brand: "Microsoft Edge", version: "143" },
        ],
        fullVersionList: [{ brand: "Microsoft Edge", version: "143.0.12.4" }],
        mobile: false,
        platform: "macOS",
        platformVersion: "15_4",
        architecture: "arm",
        bitness: "64",
        model: "",
      },
    });
    expect(result.browser).toEqual({
      name: "Microsoft Edge",
      version: "143.0.12.4",
      major: "143",
    });
    expect(result.os).toEqual({ name: "macOS", version: "15.4" });
    expect(result.cpu).toEqual({ architecture: "arm64", bitness: "64" });
  });

  it("uses mobile and model hints without guessing unknown brands or platforms", () => {
    const result = parse("unknown", {
      clientHints: {
        brands: [{ brand: "Mystery Browser", version: "1" }],
        mobile: true,
        platform: "Mystery OS",
        model: "Example Phone",
      },
    });
    expect(result.browser).toEqual({});
    expect(result.os).toEqual({});
    expect(result.device).toEqual({ type: "mobile", model: "Example Phone" });
  });

  it("normalizes additional known hint values while retaining unknown architecture labels", () => {
    const chrome = parse("", {
      clientHints: {
        brands: [{ brand: "Google Chrome", version: "144" }],
        platform: "Chrome OS",
        platformVersion: "1",
        model: "Desktop model",
        architecture: "riscv64",
      },
    });
    expect(chrome.browser.name).toBe("Chrome");
    expect(chrome.os).toEqual({ name: "ChromeOS", version: "1" });
    expect(chrome.device).toEqual({ type: "unknown", model: "Desktop model" });
    expect(chrome.cpu).toEqual({ architecture: "riscv64" });

    const chromium = parse("", {
      clientHints: {
        brands: [{ brand: "Chromium", version: "145" }],
        platform: "Linux",
        mobile: false,
      },
    });
    expect(chromium.browser.name).toBe("Chromium");
    expect(chromium.os.name).toBe("Linux");
  });

  it("combines architecture and bitness hints without contradictory CPU labels", () => {
    expect(
      parse("", {
        clientHints: { architecture: "x86", bitness: "32" },
      }).cpu,
    ).toEqual({ architecture: "x86", bitness: "32" });
    expect(
      parse("", {
        clientHints: { architecture: "arm", bitness: "32" },
      }).cpu,
    ).toEqual({ architecture: "arm", bitness: "32" });
    expect(
      parse("", {
        clientHints: { architecture: "x86", bitness: "64" },
      }).cpu,
    ).toEqual({ architecture: "x86_64", bitness: "64" });
    expect(
      parse("", {
        clientHints: { architecture: "arm", bitness: "64" },
      }).cpu,
    ).toEqual({ architecture: "arm64", bitness: "64" });
  });

  it("uses a negative mobile hint to discard a lower-confidence mobile classification", () => {
    const userAgent =
      "Mozilla/5.0 (Linux; Android 14; Example) AppleWebKit/537.36 Chrome/143.0.0.0 Mobile Safari/537.36";
    expect(parse(userAgent, { clientHints: { mobile: false } }).device).toEqual(
      { type: "unknown" },
    );
  });

  it("supports safe custom rules before bundled rules", () => {
    const pack: RulePack = {
      name: "acme",
      rules: [
        {
          id: "acme-browser",
          match: { all: ["AcmeBrowser/"], none: ["AcmeBot/"] },
          result: { target: "browser", name: "Acme Browser" },
          versionPrefix: "AcmeBrowser/",
        },
        {
          id: "acme-os",
          match: { all: ["AcmeOS/"] },
          result: { target: "os", name: "Acme OS" },
          versionPrefix: "AcmeOS/",
        },
      ],
    };
    const result = createParser({ customRulePacks: [pack] }).parse(
      "AcmeBrowser/2.4 AcmeOS/7_1",
    );
    expect(result.browser).toEqual({
      name: "Acme Browser",
      version: "2.4",
      major: "2",
    });
    expect(result.os).toEqual({ name: "Acme OS", version: "7.1" });
  });

  it("freezes the result and every nested category", () => {
    const result = parse(CHROME_WINDOWS);
    expect(Object.isFrozen(result)).toBe(true);
    for (const category of [
      result.browser,
      result.engine,
      result.os,
      result.device,
      result.cpu,
      result.client,
    ]) {
      expect(Object.isFrozen(category)).toBe(true);
    }
    expect(() => Object.assign(result.browser, { name: "mutated" })).toThrow(
      TypeError,
    );
  });

  it("rejects oversized input by default and supports deterministic truncation", () => {
    expect(() => parse("x".repeat(DEFAULT_MAX_USER_AGENT_LENGTH + 1))).toThrow(
      InputLimitError,
    );
    const parser = createParser({
      maxUserAgentLength: 8,
      overflowBehavior: "truncate",
    });
    expect(parser.parse("curl/8.1 extra").ua).toBe("curl/8.1");
  });

  it("normalizes unpaired UTF-16 surrogate code units", () => {
    expect(parse("a\ud800b\udc00c😀").ua).toBe("a�b�c😀");
  });

  it("rejects non-string UA input at the runtime boundary", () => {
    expect(() => parse(null as never)).toThrow("userAgent must be a string");
  });

  it("validates parser configuration at runtime", () => {
    expect(() => createParser({ maxUserAgentLength: 0 })).toThrow(RangeError);
    expect(() => createParser({ maxUserAgentLength: 65_537 })).toThrow(
      RangeError,
    );
    expect(() => createParser({ maxUserAgentLength: 1.5 })).toThrow(RangeError);
    expect(() =>
      createParser({ overflowBehavior: "invalid" as "throw" }),
    ).toThrow(TypeError);
    expect(() => createParser(null as never)).toThrow(TypeError);
  });

  it("validates custom rule packs and isolates dangerous keys", () => {
    expect(() =>
      createParser({
        customRulePacks: new Array(5).fill({ name: "x", rules: [] }),
      }),
    ).toThrow(RuleValidationError);
    const parser = createParser({
      customRulePacks: [
        {
          name: "safe",
          rules: [
            {
              id: "__proto__",
              match: { all: ["safe/"] },
              result: { target: "client", type: "library", name: "Safe" },
            },
          ],
        },
      ],
    });
    expect(parser.parse("safe/1").client).toEqual({
      type: "library",
      name: "Safe",
    });
    expect(Object.prototype).not.toHaveProperty("polluted");
  });
});
