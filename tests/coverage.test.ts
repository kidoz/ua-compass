import { describe, expect, it } from "vitest";

import { parse } from "../src/index.js";

// All User-Agent strings below are independently composed for UA Compass from
// public token-format documentation, using synthetic product versions. They are
// not copied from another parser's fixture corpus.

describe("Chromium-family browsers take precedence over the generic Chrome token", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 OPR/102.0.0.0",
      "Opera",
      "102",
    ],
    [
      "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
      "Samsung Internet",
      "23.0",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 YaBrowser/23.7.1.1140 Safari/537.36",
      "Yandex Browser",
      "23.7.1.1140",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Vivaldi/6.2",
      "Vivaldi",
      "6.2",
    ],
    [
      "Mozilla/5.0 (Linux; U; Android 12; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 UCBrowser/15.0.0.0 Mobile Safari/537.36",
      "UC Browser",
      "15",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chromium/117.0.5938.62 Chrome/117.0.5938.62 Safari/537.36",
      "Chromium",
      "117.0.5938.62",
    ],
    [
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36 EdgA/115.0.1901.183",
      "Microsoft Edge",
      "115.0.1901.183",
    ],
  ])("detects %s as a Blink browser", (ua, name, version) => {
    const result = parse(ua);
    expect(result.browser).toEqual({
      name,
      version,
      major: version.split(".", 1)[0],
    });
    expect(result.engine.name).toBe("Blink");
    expect(result.client).toEqual({ type: "browser", name, version });
  });
});

describe("iOS browser variants reuse the WebKit shell", () => {
  it.each([
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.109 Mobile/15E148 Safari/604.1",
      "Chrome",
      "119.0.6045.109",
      "17.0",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/121.0 Mobile/15E148 Safari/605.1.15",
      "Firefox",
      "121.0",
      "17.0",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/121.0.2277.107 Mobile/15E148 Safari/605.1.15",
      "Microsoft Edge",
      "121.0.2277.107",
      "17.0",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) OPiOS/16.0.10.121212 Mobile/15E148 Safari/9537.53",
      "Opera",
      "16.0.10.121212",
      "17.0",
    ],
  ])("detects %s on iOS with WebKit", (ua, name, version, osVersion) => {
    const result = parse(ua);
    expect(result.browser.name).toBe(name);
    expect(result.browser.version).toBe(version);
    expect(result.engine.name).toBe("WebKit");
    expect(result.os).toEqual({ name: "iOS", version: osVersion });
    expect(result.device.type).toBe("mobile");
  });
});

describe("legacy browsers and their engines", () => {
  it("detects Internet Explorer 11 with Trident", () => {
    const result = parse(
      "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
    );
    expect(result.browser).toEqual({
      name: "Internet Explorer",
      version: "11.0",
      major: "11",
    });
    expect(result.engine).toEqual({ name: "Trident", version: "7.0" });
    expect(result.os).toEqual({ name: "Windows", version: "10.0" });
  });

  it("detects older MSIE-token Internet Explorer", () => {
    const result = parse(
      "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)",
    );
    expect(result.browser.name).toBe("Internet Explorer");
    expect(result.browser.version).toBe("9.0");
    expect(result.engine.name).toBe("Trident");
  });

  it("detects legacy EdgeHTML Edge over the compatibility Chrome token", () => {
    const result = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3282.140 Safari/537.36 Edge/18.17763",
    );
    expect(result.browser.name).toBe("Microsoft Edge");
    expect(result.browser.version).toBe("18.17763");
    expect(result.engine).toEqual({ name: "EdgeHTML", version: "18.17763" });
  });

  it("detects Presto-era Opera", () => {
    const result = parse(
      "Opera/9.80 (Windows NT 6.1; U; en) Presto/2.12.388 Version/12.16",
    );
    expect(result.browser.name).toBe("Opera");
    expect(result.browser.version).toBe("12.16");
    expect(result.engine).toEqual({ name: "Presto", version: "2.12.388" });
    expect(result.os).toEqual({ name: "Windows", version: "6.1" });
  });
});

describe("in-app WebViews report the host app as a webview client", () => {
  it.each([
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.32.108;FBBV/1;]",
      "Facebook",
      "450.0.0.32.108",
    ],
    [
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Mobile Safari/537.36 Instagram 302.0.0.34.111 Android",
      "Instagram",
      "302.0.0.34.111",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.40(0x18002824) NetType/WIFI",
      "WeChat",
      "8.0.40",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.11.0",
      "LINE",
      "13.11.0",
    ],
  ])("classifies %s as a webview", (ua, name, version) => {
    const result = parse(ua);
    expect(result.browser.name).toBe(name);
    expect(result.browser.version).toBe(version);
    expect(result.client.type).toBe("webview");
    expect(result.client.name).toBe(name);
  });
});

describe("bots, crawlers, and libraries suppress browser detection", () => {
  it.each([
    [
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "crawler",
      "bingbot",
      "2.0",
    ],
    [
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
      "ai-crawler",
      "GPTBot",
      "1.1",
    ],
    [
      "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      "ai-crawler",
      "ClaudeBot",
      "1.0",
    ],
    [
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "bot",
      "facebookexternalhit",
      "1.1",
    ],
    ["python-requests/2.31.0", "library", "python-requests", "2.31.0"],
    ["okhttp/4.12.0", "library", "OkHttp", "4.12.0"],
    ["Go-http-client/1.1", "library", "Go-http-client", "1.1"],
  ])("classifies %s", (ua, type, name, version) => {
    const result = parse(ua);
    expect(result.client).toEqual({ type, name, version });
    expect(result.browser).toEqual({});
  });

  it("prefers a crawler token embedded alongside Chrome", () => {
    const result = parse(
      "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    );
    expect(result.client).toEqual({
      type: "crawler",
      name: "Googlebot",
      version: "2.1",
    });
    expect(result.browser).toEqual({});
  });
});

describe("console and TV devices", () => {
  it("detects a PlayStation console", () => {
    const result = parse(
      "Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15",
    );
    expect(result.device).toEqual({ type: "console", vendor: "Sony" });
  });

  it("detects an Xbox console on Windows", () => {
    const result = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.110 Safari/537.36 Edge/18.19041",
    );
    expect(result.device).toEqual({ type: "console", vendor: "Microsoft" });
    expect(result.os.name).toBe("Windows");
  });

  it("detects a Nintendo Switch console", () => {
    const result = parse(
      "Mozilla/5.0 (Nintendo Switch; WifiWebAuthApplet) AppleWebKit/609.4 (KHTML, like Gecko) NF/6.0.2.21.3 NintendoBrowser/5.1.0.22474",
    );
    expect(result.device).toEqual({ type: "console", vendor: "Nintendo" });
  });

  it("detects an Apple TV", () => {
    const result = parse("AppleTV6,2/11.1");
    expect(result.device).toEqual({
      type: "tv",
      vendor: "Apple",
      model: "Apple TV",
    });
  });

  it("detects a Roku streaming device", () => {
    const result = parse("Roku/DVP-9.10 (509.10E04111A)");
    expect(result.device).toEqual({ type: "tv", vendor: "Roku" });
  });

  it("detects a Chromecast on Linux/ARM", () => {
    const result = parse(
      "Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/31.0.1650.0 Safari/537.36 CrKey/1.54.250320",
    );
    expect(result.device).toEqual({
      type: "tv",
      vendor: "Google",
      model: "Chromecast",
    });
    expect(result.cpu).toEqual({ architecture: "arm", bitness: "32" });
  });

  it("detects a Samsung Tizen smart TV", () => {
    const result = parse(
      "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.0 TV Safari/537.36",
    );
    expect(result.device).toEqual({ type: "tv", vendor: "Samsung" });
    expect(result.os).toEqual({ name: "Tizen", version: "6.0" });
  });
});

describe("additional operating systems", () => {
  it("detects Windows Phone before the Android compatibility token", () => {
    const result = parse(
      "Mozilla/5.0 (Windows Phone 10.0; Android 6.0.1; Microsoft; Lumia 950) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Mobile Safari/537.36 Edge/15.15254",
    );
    expect(result.os).toEqual({ name: "Windows Phone", version: "10.0" });
    expect(result.device.type).toBe("mobile");
  });

  it("detects KaiOS feature phones", () => {
    const result = parse(
      "Mozilla/5.0 (Mobile; LYF/F90M/LYF-F90M-000-01-15-130118; Linux; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5.4",
    );
    expect(result.os).toEqual({ name: "KaiOS", version: "2.5.4" });
    expect(result.browser.name).toBe("Firefox");
    expect(result.device.type).toBe("mobile");
  });

  it("detects webOS smart TVs", () => {
    const result = parse(
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36",
    );
    expect(result.os.name).toBe("webOS");
    expect(result.device.type).toBe("tv");
  });
});

describe("additional CPU architectures", () => {
  it("maps aarch64 to arm64", () => {
    const result = parse(
      "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );
    expect(result.cpu).toEqual({ architecture: "arm64", bitness: "64" });
  });
});

describe("malformed and boundary tokens", () => {
  it("keeps the browser name when a version is absent", () => {
    const result = parse(
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/ Chrome/115.0.0.0 Mobile Safari/537.36",
    );
    expect(result.browser).toEqual({ name: "Samsung Internet" });
    expect(result.engine.name).toBe("Blink");
  });
});
