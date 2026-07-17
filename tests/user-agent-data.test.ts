import { describe, expect, it } from "vitest";

import { clientHintsFromUserAgentData, parse } from "../src/index.js";

// Fixtures below model the `navigator.userAgentData` low-entropy object merged
// with high-entropy values from `getHighEntropyValues()`, composed independently
// from the W3C User-Agent Client Hints spec (https://wicg.github.io/ua-client-hints/)
// with synthetic values. They are not copied from another parser's corpus.

describe("clientHintsFromUserAgentData", () => {
  it("normalizes a merged low- and high-entropy userAgentData object", () => {
    const hints = clientHintsFromUserAgentData({
      brands: [
        { brand: "Chromium", version: "138" },
        { brand: "Google Chrome", version: "138" },
      ],
      mobile: false,
      platform: "Windows",
      // High-entropy values from getHighEntropyValues():
      fullVersionList: [
        { brand: "Chromium", version: "138.0.7204.49" },
        { brand: "Google Chrome", version: "138.0.7204.49" },
      ],
      platformVersion: "15.0.0",
      architecture: "x86",
      bitness: "64",
      model: "",
      formFactors: ["Desktop"],
    });
    expect(hints).toEqual({
      brands: [
        { brand: "Chromium", version: "138" },
        { brand: "Google Chrome", version: "138" },
      ],
      mobile: false,
      platform: "Windows",
      fullVersionList: [
        { brand: "Chromium", version: "138.0.7204.49" },
        { brand: "Google Chrome", version: "138.0.7204.49" },
      ],
      platformVersion: "15.0.0",
      architecture: "x86",
      bitness: "64",
      // An empty model string is preserved by the normalizer; the parser
      // consumer treats "" as "no model reported" at detection time.
      model: "",
      formFactors: ["Desktop"],
    });
    // The result is frozen and safe to share.
    expect(Object.isFrozen(hints)).toBe(true);
  });

  it("feeds parse() so a reduced Chromium UA recovers its real values", () => {
    const result = parse(
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
      {
        clientHints: clientHintsFromUserAgentData({
          brands: [{ brand: "Chromium", version: "138" }],
          mobile: true,
          platform: "Android",
          fullVersionList: [
            { brand: "Google Chrome", version: "138.0.7204.49" },
          ],
          platformVersion: "15.0.0",
          model: "Pixel 9",
          formFactors: ["Watch"],
        }),
      },
    );
    expect(result.browser.version).toBe("138.0.7204.49");
    expect(result.os).toEqual({ name: "Android", version: "15.0.0" });
    expect(result.device).toEqual({ type: "wearable", model: "Pixel 9" });
  });

  it("returns undefined for undefined and rejects non-objects", () => {
    expect(clientHintsFromUserAgentData(undefined)).toBeUndefined();
    expect(() => clientHintsFromUserAgentData(null)).toThrow(
      "clientHints must be an object",
    );
    expect(() => clientHintsFromUserAgentData("not-an-object")).toThrow(
      "clientHints must be an object",
    );
  });

  it("ignores inherited prototype properties", () => {
    // A userAgentData-shaped object must not leak inherited fields; only
    // own-properties are read, matching the structured-input contract.
    const inherited = Object.create({
      brands: [{ brand: "Chromium", version: "1" }],
      mobile: true,
    }) as unknown;
    expect(clientHintsFromUserAgentData(inherited)).toBeUndefined();
  });

  it("rejects malformed brands and form factors with a typed error", () => {
    expect(() =>
      clientHintsFromUserAgentData({
        brands: new Array(17).fill({ brand: "x", version: "1" }),
      }),
    ).toThrow("at most 16");
    expect(() => clientHintsFromUserAgentData({ mobile: "yes" })).toThrow(
      "must be boolean",
    );
    expect(() =>
      clientHintsFromUserAgentData({ formFactors: new Array(9).fill("Watch") }),
    ).toThrow("at most 8");
  });
});
