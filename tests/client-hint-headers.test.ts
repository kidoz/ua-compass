import { describe, expect, it } from "vitest";

import { clientHintsFromHeaders, parse } from "../src/index.js";

const REDUCED_CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36";

describe("clientHintsFromHeaders", () => {
  it("normalizes the documented Sec-CH-UA header set", () => {
    const hints = clientHintsFromHeaders({
      "sec-ch-ua":
        '"Chromium";v="138", "Google Chrome";v="138", "Not/A)Brand";v="24"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-ch-ua-platform-version": '"15.0.0"',
      "sec-ch-ua-model": '"Pixel 9"',
      "sec-ch-ua-arch": '""',
      "sec-ch-ua-full-version-list":
        '"Chromium";v="138.0.7204.49", "Google Chrome";v="138.0.7204.49", "Not/A)Brand";v="24.0.0.0"',
    });
    expect(hints).toEqual({
      brands: [
        { brand: "Chromium", version: "138" },
        { brand: "Google Chrome", version: "138" },
        { brand: "Not/A)Brand", version: "24" },
      ],
      fullVersionList: [
        { brand: "Chromium", version: "138.0.7204.49" },
        { brand: "Google Chrome", version: "138.0.7204.49" },
        { brand: "Not/A)Brand", version: "24.0.0.0" },
      ],
      mobile: true,
      platform: "Android",
      platformVersion: "15.0.0",
      model: "Pixel 9",
    });
  });

  it("feeds parse() so reduced-UA placeholders are replaced with real data", () => {
    const result = parse(REDUCED_CHROME_ANDROID, {
      clientHints: clientHintsFromHeaders({
        "sec-ch-ua-full-version-list":
          '"Google Chrome";v="138.0.7204.49", "Chromium";v="138.0.7204.49"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-ch-ua-platform-version": '"15.0.0"',
        "sec-ch-ua-model": '"Pixel 9"',
      }),
    });
    expect(result.browser.version).toBe("138.0.7204.49");
    expect(result.os).toEqual({ name: "Android", version: "15.0.0" });
    expect(result.device).toEqual({ type: "mobile", model: "Pixel 9" });
  });

  it("accepts canonical header casing and array values", () => {
    const hints = clientHintsFromHeaders({
      "Sec-CH-UA-Platform": ['"Windows"'],
      "Sec-CH-UA-Mobile": "?0",
    });
    expect(hints).toEqual({ platform: "Windows", mobile: false });
  });

  it("selects GREASE-resistant brands regardless of order and spelling", () => {
    const greaseVariants = [
      '"Not A;Brand";v="99", "Brave";v="126", "Chromium";v="126"',
      '"Brave";v="126", "Not:A-Brand";v="8", "Chromium";v="126"',
      '"Chromium";v="126", "Not_A Brand";v="24", "Brave";v="126"',
    ];
    for (const header of greaseVariants) {
      const result = parse("", {
        clientHints: clientHintsFromHeaders({ "sec-ch-ua": header }),
      });
      expect(result.browser.name).toBe("Brave");
    }
  });

  it("falls back to Chromium only when every named brand is GREASE", () => {
    const result = parse("", {
      clientHints: clientHintsFromHeaders({
        "sec-ch-ua": '"Not/A)Brand";v="24", "Chromium";v="126"',
      }),
    });
    expect(result.browser.name).toBe("Chromium");
  });

  it("drops malformed or oversized headers instead of throwing", () => {
    expect(
      clientHintsFromHeaders({ "sec-ch-ua": '"Unterminated;v=1' }),
    ).toBeUndefined();
    expect(
      clientHintsFromHeaders({ "sec-ch-ua-platform": `"${"x".repeat(400)}"` }),
    ).toBeUndefined();
    expect(
      clientHintsFromHeaders({ "sec-ch-ua-mobile": "?2" }),
    ).toBeUndefined();
    expect(
      clientHintsFromHeaders({
        "sec-ch-ua": `"Chromium";v="1"${",".repeat(3000)}`,
      }),
    ).toBeUndefined();
    expect(clientHintsFromHeaders({})).toBeUndefined();
    expect(clientHintsFromHeaders({ "content-type": "text/html" })).toBe(
      undefined,
    );
  });

  it("parses token-form parameters, escapes, and foreign parameters", () => {
    expect(
      clientHintsFromHeaders({ "sec-ch-ua": '"Chromium";v=126' })?.brands,
    ).toEqual([{ brand: "Chromium", version: "126" }]);
    expect(
      clientHintsFromHeaders({
        "sec-ch-ua": '"Esc\\"aped";v="1.0", "Chromium";q="x";v="126";x=1',
      })?.brands,
    ).toEqual([
      { brand: 'Esc"aped', version: "1.0" },
      { brand: "Chromium", version: "126" },
    ]);
    expect(
      clientHintsFromHeaders({ "sec-ch-ua": '"Chromium";novalue, "Brave"' })
        ?.brands,
    ).toEqual([
      { brand: "Chromium", version: "" },
      { brand: "Brave", version: "" },
    ]);
    expect(
      clientHintsFromHeaders({ "sec-ch-ua": '"Trailing\\' }),
    ).toBeUndefined();
    expect(clientHintsFromHeaders({ "sec-ch-ua": '"";v="1"' })).toBeUndefined();
    expect(
      clientHintsFromHeaders({
        "sec-ch-ua": '"Chromium";v="126"',
        "sec-ch-ua-full-version-list": '"Broken',
        "sec-ch-ua-bitness": '"64"',
        "sec-ch-ua-model": 1234,
      }),
    ).toEqual({
      brands: [{ brand: "Chromium", version: "126" }],
      bitness: "64",
    });
  });

  it("caps brand lists at the configured limit", () => {
    const manyBrands = Array.from(
      { length: 40 },
      (_, index) => `"Brand${String(index)}";v="1"`,
    ).join(", ");
    const hints = clientHintsFromHeaders({ "sec-ch-ua": manyBrands });
    expect(hints?.brands?.length).toBe(16);
  });

  it("rejects non-object header bags", () => {
    expect(() =>
      clientHintsFromHeaders(null as unknown as Record<string, unknown>),
    ).toThrow(TypeError);
    expect(() =>
      clientHintsFromHeaders("sec-ch-ua" as unknown as Record<string, unknown>),
    ).toThrow(TypeError);
  });

  it("ignores inherited header values", () => {
    const headers = Object.create({
      "sec-ch-ua-platform": '"Windows"',
      "Sec-CH-UA-Mobile": "?1",
    }) as Record<string, unknown>;
    expect(clientHintsFromHeaders(headers)).toBeUndefined();
  });
});
