import { describe, expect, it } from "vitest";

import {
  isChromeFamily,
  isDesktop,
  isMobile,
  isTablet,
  parse,
} from "../src/index.js";

// All User-Agent strings below are independently composed for UA Compass from
// public token-format documentation and vendor specs, using synthetic product
// versions. They are not copied from another parser's fixture corpus.

describe("email and media-player clients suppress browser detection", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Thunderbird/115.6.0",
      "email",
      "Thunderbird",
      "115.6.0",
    ],
    [
      "Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0.17126; Pro)",
      "email",
      "Microsoft Outlook",
      "16.0.17126",
    ],
    ["VLC/3.0.20 LibVLC/3.0.20", "mediaplayer", "VLC", "3.0.20"],
    [
      "iTunes/12.12.9 (Windows; Microsoft Windows 10 x64)",
      "mediaplayer",
      "iTunes",
      "12.12.9",
    ],
    [
      "Kodi/20.2 (X11; Linux x86_64) App_Bitness/64",
      "mediaplayer",
      "Kodi",
      "20.2",
    ],
    [
      "AppleCoreMedia/1.0.0.21G93 (iPhone; U; CPU OS 17_6 like Mac OS X; en_us)",
      "mediaplayer",
      "AppleCoreMedia",
      "1.0.0.21G93",
    ],
  ])("classifies %s", (ua, type, name, version) => {
    const result = parse(ua);
    expect(result.client).toEqual({ type, name, version });
    expect(result.browser).toEqual({});
  });
});

describe("embedded application runtimes", () => {
  it("classifies Electron as an embedded client while keeping the Blink engine", () => {
    const result = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SampleApp/1.4.2 Chrome/122.0.6261.120 Electron/28.1.0 Safari/537.36",
    );
    expect(result.client).toEqual({
      type: "embedded",
      name: "Electron",
      version: "28.1.0",
    });
    expect(result.browser).toEqual({});
    expect(result.engine.name).toBe("Blink");
    expect(isChromeFamily(result)).toBe(true);
  });
});

describe("XR headsets and wearable devices", () => {
  it("classifies a Meta Quest headset as an XR device", () => {
    const result = parse(
      "Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/40.2.0.10.61 Chrome/138.0.7204.235 VR Safari/537.36",
    );
    expect(result.device).toEqual({ type: "xr", vendor: "Meta" });
    expect(result.browser.name).toBe("Meta Quest Browser");
    expect(result.engine.name).toBe("Blink");
  });

  it("classifies an older Android-mode Quest as XR rather than mobile", () => {
    const result = parse(
      "Mozilla/5.0 (Linux; Android 7.1.1; Quest) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/8.1.2 SamsungBrowser/4.0 Chrome/79.0.3945.126 Mobile VR Safari/537.36",
    );
    expect(result.device.type).toBe("xr");
    expect(result.device.vendor).toBe("Meta");
  });

  it("classifies an Apple Watch as a wearable", () => {
    const result = parse(
      "Mozilla/5.0 (Apple Watch; CPU WatchOS 10_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)",
    );
    expect(result.device).toEqual({
      type: "wearable",
      vendor: "Apple",
      model: "Apple Watch",
    });
  });

  it("classifies a Wear OS smartwatch as a wearable rather than a phone", () => {
    const result = parse(
      "Mozilla/5.0 (Linux; Android 5.0.2; SmartWatch 3 Build/LWX49K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Mobile Safari/537.36",
    );
    expect(result.device.type).toBe("wearable");
    expect(result.os.name).toBe("Android");
  });
});

describe("client and device type guards", () => {
  it("recognizes Chromium-family browsers via the Blink engine", () => {
    const chrome = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
    );
    expect(isChromeFamily(chrome)).toBe(true);

    const firefox = parse(
      "Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0",
    );
    expect(isChromeFamily(firefox)).toBe(false);
  });

  it("recognizes a Chromium-family brand from Client Hints without a UA engine", () => {
    const result = parse("", {
      clientHints: {
        brands: [
          { brand: "Chromium", version: "122" },
          { brand: "Google Chrome", version: "122" },
        ],
        mobile: false,
        platform: "Windows",
      },
    });
    expect(result.engine).toEqual({});
    expect(result.browser.name).toBe("Chrome");
    expect(isChromeFamily(result)).toBe(true);
  });

  it("separates mobile, tablet, and desktop device guards", () => {
    const mobile = parse(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Mobile Safari/537.36",
    );
    expect(isMobile(mobile)).toBe(true);
    expect(isTablet(mobile)).toBe(false);
    expect(isDesktop(mobile)).toBe(false);

    const tablet = parse(
      "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
    );
    expect(isTablet(tablet)).toBe(true);
    expect(isMobile(tablet)).toBe(false);

    const desktop = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
    );
    expect(isDesktop(desktop)).toBe(true);
    expect(isMobile(desktop)).toBe(false);
  });
});
