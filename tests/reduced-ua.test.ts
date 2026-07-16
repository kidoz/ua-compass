import { describe, expect, it } from "vitest";

import { parse } from "../src/index.js";

const REDUCED_ANDROID =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36";
const REDUCED_MACOS =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
const CHROME_WINDOWS_REDUCED =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";

describe("reduced (frozen) User-Agent handling", () => {
  it("flags the reduced Android form and suppresses its placeholders", () => {
    const result = parse(REDUCED_ANDROID);
    expect(result.uaReduced).toBe(true);
    expect(result.browser).toEqual({
      name: "Chrome",
      version: "138",
      major: "138",
    });
    // "Android 10" is a frozen placeholder, not the real OS version.
    expect(result.os).toEqual({ name: "Android" });
    expect(result.device).toEqual({ type: "mobile" });
  });

  it("suppresses the frozen macOS 10.15.7 platform version", () => {
    const result = parse(REDUCED_MACOS);
    expect(result.uaReduced).toBe(true);
    expect(result.os).toEqual({ name: "macOS" });
  });

  it("keeps the frozen platform version for non-reduced agents", () => {
    const safari = parse(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15",
    );
    expect(safari.uaReduced).toBe(false);
    expect(safari.os).toEqual({ name: "macOS", version: "10.15.7" });

    const firefox = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0",
    );
    expect(firefox.uaReduced).toBe(false);
    expect(firefox.os).toEqual({ name: "Windows", version: "10.0" });
  });

  it("does not treat pre-reduction Chrome versions as reduced", () => {
    const result = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36",
    );
    expect(result.uaReduced).toBe(false);
    expect(result.browser.version).toBe("99.0.4844.51");
    expect(result.os).toEqual({ name: "Windows", version: "10.0" });
  });

  it("leaves Chrome on iOS untouched because it is excluded from reduction", () => {
    const result = parse(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1",
    );
    expect(result.uaReduced).toBe(false);
    expect(result.browser).toEqual({
      name: "Chrome",
      version: "125.0.6422.80",
      major: "125",
    });
  });

  it("lets structured Client Hints restore real values on reduced agents", () => {
    const result = parse(REDUCED_ANDROID, {
      clientHints: {
        fullVersionList: [{ brand: "Google Chrome", version: "138.0.7204.49" }],
        mobile: true,
        platform: "Android",
        platformVersion: "15.0.0",
        model: "Pixel 9",
      },
    });
    expect(result.uaReduced).toBe(true);
    expect(result.browser).toEqual({
      name: "Chrome",
      version: "138.0.7204.49",
      major: "138",
    });
    expect(result.os).toEqual({ name: "Android", version: "15.0.0" });
    expect(result.device).toEqual({ type: "mobile", model: "Pixel 9" });
  });

  it("maps the documented Windows platform version to marketing versions", () => {
    const windows11 = parse(CHROME_WINDOWS_REDUCED, {
      clientHints: { platform: "Windows", platformVersion: "15.0.0" },
    });
    expect(windows11.os).toEqual({ name: "Windows", version: "11" });

    const windows10 = parse(CHROME_WINDOWS_REDUCED, {
      clientHints: { platform: "Windows", platformVersion: "10.0.0" },
    });
    expect(windows10.os).toEqual({ name: "Windows", version: "10" });

    const older = parse(CHROME_WINDOWS_REDUCED, {
      clientHints: { platform: "Windows", platformVersion: "0.1.0" },
    });
    expect(older.os).toEqual({ name: "Windows" });
  });
});
