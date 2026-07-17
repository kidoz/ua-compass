import { describe, expect, it } from "vitest";

import {
  createParser,
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

describe("custom rule packs accept the newly added result types", () => {
  it.each(["email", "mediaplayer"] as const)(
    "accepts the %s client type",
    (type) => {
      const parser = createParser({
        customRulePacks: [
          {
            name: "custom",
            rules: [
              {
                id: `custom-${type}`,
                match: { all: ["CustomToken/"] },
                result: { target: "client", type, name: "CustomToken" },
                versionPrefix: "CustomToken/",
              },
            ],
          },
        ],
      });
      expect(parser.parse("CustomToken/1.0").client).toEqual({
        type,
        name: "CustomToken",
        version: "1.0",
      });
    },
  );

  it("accepts the xr device type", () => {
    const parser = createParser({
      customRulePacks: [
        {
          name: "custom-xr",
          rules: [
            {
              id: "custom-headset",
              match: { all: ["CustomHeadset"] },
              result: { target: "device", type: "xr", vendor: "Acme" },
            },
          ],
        },
      ],
    });
    expect(
      parser.parse("Mozilla/5.0 (CustomHeadset) Chrome/122.0.6261.120").device,
    ).toEqual({ type: "xr", vendor: "Acme" });
  });
});

describe("Client Hints merge refinements", () => {
  it("keeps a real UA OS version when the platform hint carries no version", () => {
    const result = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0",
      { clientHints: { platform: "Windows" } },
    );
    expect(result.os).toEqual({ name: "Windows", version: "10.0" });
  });

  it("overrides the OS name but reports no version when the platform hint disagrees", () => {
    const result = parse(
      "Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0",
      { clientHints: { platform: "Windows" } },
    );
    expect(result.os).toEqual({ name: "Windows" });
  });

  it("does not let a mobile hint clobber a more specific UA device class", () => {
    const tablet = parse(
      "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
      { clientHints: { mobile: true } },
    );
    expect(tablet.device.type).toBe("tablet");

    const quest = parse(
      "Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/40.2.0.10.61 Chrome/138.0.7204.235 VR Safari/537.36",
      { clientHints: { mobile: true } },
    );
    expect(quest.device.type).toBe("xr");
  });

  it("still upgrades an unknown/desktop device to mobile on a positive hint", () => {
    const result = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
      { clientHints: { mobile: true } },
    );
    expect(result.device.type).toBe("mobile");
  });

  it("applies a bitness-only hint while keeping the UA architecture", () => {
    const noArch = parse(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Mobile Safari/537.36",
      { clientHints: { bitness: "64" } },
    );
    expect(noArch.cpu).toEqual({ bitness: "64" });

    const withArch = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
      { clientHints: { bitness: "32" } },
    );
    expect(withArch.cpu).toEqual({ architecture: "x86_64", bitness: "32" });
  });
});

// Sec-CH-UA-Form-Factors is a WICG structured-field hint (shipped Chrome 124)
// whose "Watch" and "XR" tokens identify device classes the UA string cannot
// express. The cases below verify the conservative precedence rule: form-factor
// tokens promote only from low-confidence classes (unknown/desktop/mobile) and
// never override a concrete UA-derived device class.
describe("Sec-CH-UA-Form-Factors device refinement", () => {
  it("promotes a phone-like UA to wearable on a Watch token", () => {
    // A Wear OS UA is structurally identical to a phone UA; the hint is the
    // only wearable signal available in the HTTP layer.
    const result = parse(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Mobile Safari/537.36",
      { clientHints: { formFactors: ["Watch"] } },
    );
    expect(result.device.type).toBe("wearable");
  });

  it("promotes a desktop UA to XR on an XR token", () => {
    const result = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
      { clientHints: { formFactors: ["XR"] } },
    );
    expect(result.device.type).toBe("xr");
  });

  it("does not override a UA-derived tablet class with a Watch token", () => {
    const result = parse(
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      { clientHints: { formFactors: ["Watch"] } },
    );
    expect(result.device.type).toBe("tablet");
  });

  it("does not override a UA-derived XR class with a Mobile token", () => {
    const result = parse(
      "Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/40.2.0.10.61 Chrome/138.0.7204.235 VR Safari/537.36",
      { clientHints: { formFactors: ["Mobile"] } },
    );
    expect(result.device.type).toBe("xr");
  });

  it("ignores form-factor tokens that the UA already exposes", () => {
    const result = parse(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Mobile Safari/537.36",
      { clientHints: { formFactors: ["EInk", "Mobile"] } },
    );
    expect(result.device.type).toBe("mobile");
  });

  it("treats form-factor tokens case-sensitively", () => {
    // WICG tokens are capitalized; a lowercased token must not promote a class,
    // so a hostile header cannot smuggle a class change via case folding.
    const result = parse(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Mobile Safari/537.36",
      { clientHints: { formFactors: ["watch"] } },
    );
    expect(result.device.type).toBe("mobile");
  });

  it("prefers Watch over XR when both tokens appear", () => {
    const result = parse(
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Mobile Safari/537.36",
      { clientHints: { formFactors: ["XR", "Watch"] } },
    );
    expect(result.device.type).toBe("wearable");
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
