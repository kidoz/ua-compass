import type { DetectionRule } from "./types.js";

function rule(ruleValue: DetectionRule): DetectionRule {
  Object.freeze(ruleValue.match.all);
  if (ruleValue.match.none !== undefined) Object.freeze(ruleValue.match.none);
  Object.freeze(ruleValue.match);
  Object.freeze(ruleValue.result);
  return Object.freeze(ruleValue);
}

// Rules are evaluated first-match-wins per target, so specific signatures must
// precede generic fallbacks. Clients are resolved before browsers, so a bot or
// library signature suppresses an embedded Chrome/Safari token. Legacy engine
// rules precede Blink because compatibility User-Agents still carry `Chrome/`.
export const BUNDLED_RULES: readonly DetectionRule[] = Object.freeze([
  // --- Clients: crawlers -------------------------------------------------
  rule({
    id: "client-googlebot",
    match: { all: ["Googlebot/"] },
    result: { target: "client", type: "crawler", name: "Googlebot" },
    versionPrefix: "Googlebot/",
  }),
  rule({
    id: "client-bingbot",
    match: { all: ["bingbot/"] },
    result: { target: "client", type: "crawler", name: "bingbot" },
    versionPrefix: "bingbot/",
  }),
  rule({
    id: "client-yandexbot",
    match: { all: ["YandexBot/"] },
    result: { target: "client", type: "crawler", name: "YandexBot" },
    versionPrefix: "YandexBot/",
  }),
  rule({
    id: "client-duckduckbot",
    match: { all: ["DuckDuckBot"] },
    result: { target: "client", type: "crawler", name: "DuckDuckBot" },
  }),
  rule({
    id: "client-baiduspider",
    match: { all: ["Baiduspider"] },
    result: { target: "client", type: "crawler", name: "Baiduspider" },
  }),
  rule({
    id: "client-applebot",
    match: { all: ["Applebot/"] },
    result: { target: "client", type: "crawler", name: "Applebot" },
    versionPrefix: "Applebot/",
  }),
  rule({
    id: "client-petalbot",
    match: { all: ["PetalBot"] },
    result: { target: "client", type: "crawler", name: "PetalBot" },
  }),
  rule({
    id: "client-ahrefsbot",
    match: { all: ["AhrefsBot/"] },
    result: { target: "client", type: "crawler", name: "AhrefsBot" },
    versionPrefix: "AhrefsBot/",
  }),
  rule({
    id: "client-semrushbot",
    match: { all: ["SemrushBot"] },
    result: { target: "client", type: "crawler", name: "SemrushBot" },
  }),
  // --- Clients: AI crawlers (training and AI-search indexing) ------------
  rule({
    id: "client-gptbot",
    match: { all: ["GPTBot/"] },
    result: { target: "client", type: "ai-crawler", name: "GPTBot" },
    versionPrefix: "GPTBot/",
  }),
  rule({
    id: "client-oai-searchbot",
    match: { all: ["OAI-SearchBot/"] },
    result: { target: "client", type: "ai-crawler", name: "OAI-SearchBot" },
    versionPrefix: "OAI-SearchBot/",
  }),
  rule({
    id: "client-claudebot",
    match: { all: ["ClaudeBot/"] },
    result: { target: "client", type: "ai-crawler", name: "ClaudeBot" },
    versionPrefix: "ClaudeBot/",
  }),
  rule({
    id: "client-claude-searchbot",
    match: { all: ["Claude-SearchBot/"] },
    result: {
      target: "client",
      type: "ai-crawler",
      name: "Claude-SearchBot",
    },
    versionPrefix: "Claude-SearchBot/",
  }),
  rule({
    id: "client-perplexitybot",
    match: { all: ["PerplexityBot/"] },
    result: { target: "client", type: "ai-crawler", name: "PerplexityBot" },
    versionPrefix: "PerplexityBot/",
  }),
  rule({
    id: "client-ccbot",
    match: { all: ["CCBot/"] },
    result: { target: "client", type: "ai-crawler", name: "CCBot" },
    versionPrefix: "CCBot/",
  }),
  rule({
    id: "client-meta-externalagent",
    match: { all: ["meta-externalagent/"] },
    result: {
      target: "client",
      type: "ai-crawler",
      name: "meta-externalagent",
    },
    versionPrefix: "meta-externalagent/",
  }),
  rule({
    id: "client-bytespider",
    match: { all: ["Bytespider"] },
    result: { target: "client", type: "ai-crawler", name: "Bytespider" },
  }),
  // --- Clients: user-triggered AI assistants ------------------------------
  rule({
    id: "client-chatgpt-user",
    match: { all: ["ChatGPT-User/"] },
    result: { target: "client", type: "ai-assistant", name: "ChatGPT-User" },
    versionPrefix: "ChatGPT-User/",
  }),
  rule({
    id: "client-claude-user",
    match: { all: ["Claude-User/"] },
    result: { target: "client", type: "ai-assistant", name: "Claude-User" },
    versionPrefix: "Claude-User/",
  }),
  rule({
    id: "client-perplexity-user",
    match: { all: ["Perplexity-User/"] },
    result: {
      target: "client",
      type: "ai-assistant",
      name: "Perplexity-User",
    },
    versionPrefix: "Perplexity-User/",
  }),
  rule({
    id: "client-meta-externalfetcher",
    match: { all: ["meta-externalfetcher/"] },
    result: {
      target: "client",
      type: "ai-assistant",
      name: "meta-externalfetcher",
    },
    versionPrefix: "meta-externalfetcher/",
  }),
  rule({
    id: "client-amazonbot",
    match: { all: ["Amazonbot/"] },
    result: { target: "client", type: "crawler", name: "Amazonbot" },
    versionPrefix: "Amazonbot/",
  }),
  // --- Clients: social and messaging preview bots ------------------------
  rule({
    id: "client-facebook-external",
    match: { all: ["facebookexternalhit/"] },
    result: { target: "client", type: "bot", name: "facebookexternalhit" },
    versionPrefix: "facebookexternalhit/",
  }),
  rule({
    id: "client-twitterbot",
    match: { all: ["Twitterbot/"] },
    result: { target: "client", type: "bot", name: "Twitterbot" },
    versionPrefix: "Twitterbot/",
  }),
  rule({
    id: "client-slackbot",
    match: { all: ["Slackbot"] },
    result: { target: "client", type: "bot", name: "Slackbot" },
  }),
  rule({
    id: "client-discordbot",
    match: { all: ["Discordbot"] },
    result: { target: "client", type: "bot", name: "Discordbot" },
  }),
  rule({
    id: "client-telegrambot",
    match: { all: ["TelegramBot"] },
    result: { target: "client", type: "bot", name: "TelegramBot" },
  }),
  rule({
    id: "client-linkedinbot",
    match: { all: ["LinkedInBot"] },
    result: { target: "client", type: "bot", name: "LinkedInBot" },
  }),
  rule({
    id: "client-whatsapp",
    match: { all: ["WhatsApp/"] },
    result: { target: "client", type: "bot", name: "WhatsApp" },
    versionPrefix: "WhatsApp/",
  }),
  // --- Clients: command-line tools ---------------------------------------
  rule({
    id: "client-curl",
    match: { all: ["curl/"] },
    result: { target: "client", type: "cli", name: "curl" },
    versionPrefix: "curl/",
  }),
  rule({
    id: "client-wget",
    match: { all: ["Wget/"] },
    result: { target: "client", type: "cli", name: "Wget" },
    versionPrefix: "Wget/",
  }),
  rule({
    id: "client-httpie",
    match: { all: ["HTTPie/"] },
    result: { target: "client", type: "cli", name: "HTTPie" },
    versionPrefix: "HTTPie/",
  }),
  // --- Clients: HTTP libraries -------------------------------------------
  rule({
    id: "client-python-requests",
    match: { all: ["python-requests/"] },
    result: { target: "client", type: "library", name: "python-requests" },
    versionPrefix: "python-requests/",
  }),
  rule({
    id: "client-aiohttp",
    match: { all: ["aiohttp/"] },
    result: { target: "client", type: "library", name: "aiohttp" },
    versionPrefix: "aiohttp/",
  }),
  rule({
    id: "client-axios",
    match: { all: ["axios/"] },
    result: { target: "client", type: "library", name: "axios" },
    versionPrefix: "axios/",
  }),
  rule({
    id: "client-node-fetch",
    match: { all: ["node-fetch/"] },
    result: { target: "client", type: "library", name: "node-fetch" },
    versionPrefix: "node-fetch/",
  }),
  rule({
    id: "client-go-http",
    match: { all: ["Go-http-client/"] },
    result: { target: "client", type: "library", name: "Go-http-client" },
    versionPrefix: "Go-http-client/",
  }),
  rule({
    id: "client-java",
    match: { all: ["Java/"] },
    result: { target: "client", type: "library", name: "Java" },
    versionPrefix: "Java/",
  }),
  rule({
    id: "client-okhttp",
    match: { all: ["okhttp/"] },
    result: { target: "client", type: "library", name: "OkHttp" },
    versionPrefix: "okhttp/",
  }),
  rule({
    id: "client-postman",
    match: { all: ["PostmanRuntime/"] },
    result: { target: "client", type: "library", name: "PostmanRuntime" },
    versionPrefix: "PostmanRuntime/",
  }),
  rule({
    id: "client-libwww-perl",
    match: { all: ["libwww-perl/"] },
    result: { target: "client", type: "library", name: "libwww-perl" },
    versionPrefix: "libwww-perl/",
  }),
  // --- Browsers: named in-app WebViews (before generic Android WebView) ---
  rule({
    id: "browser-facebook",
    match: { all: ["FBAV/"] },
    result: { target: "browser", name: "Facebook", clientType: "webview" },
    versionPrefix: "FBAV/",
  }),
  rule({
    id: "browser-instagram",
    match: { all: ["Instagram "] },
    result: { target: "browser", name: "Instagram", clientType: "webview" },
    versionPrefix: "Instagram ",
  }),
  rule({
    id: "browser-line",
    match: { all: ["Line/"] },
    result: { target: "browser", name: "LINE", clientType: "webview" },
    versionPrefix: "Line/",
  }),
  rule({
    id: "browser-wechat",
    match: { all: ["MicroMessenger/"] },
    result: { target: "browser", name: "WeChat", clientType: "webview" },
    versionPrefix: "MicroMessenger/",
  }),
  rule({
    id: "browser-snapchat",
    match: { all: ["Snapchat/"] },
    result: { target: "browser", name: "Snapchat", clientType: "webview" },
    versionPrefix: "Snapchat/",
  }),
  rule({
    id: "browser-android-webview",
    match: { all: ["; wv", "Version/4.0", "Chrome/"] },
    result: {
      target: "browser",
      name: "Android WebView",
      clientType: "webview",
    },
    versionPrefix: "Chrome/",
  }),
  // --- Browsers: Chromium family (before generic Chrome) -----------------
  rule({
    id: "browser-edge",
    match: { all: ["Edg/"] },
    result: { target: "browser", name: "Microsoft Edge" },
    versionPrefix: "Edg/",
  }),
  rule({
    id: "browser-edge-android",
    match: { all: ["EdgA/"] },
    result: { target: "browser", name: "Microsoft Edge" },
    versionPrefix: "EdgA/",
  }),
  rule({
    id: "browser-edge-ios",
    match: { all: ["EdgiOS/"] },
    result: { target: "browser", name: "Microsoft Edge" },
    versionPrefix: "EdgiOS/",
  }),
  rule({
    id: "browser-edge-legacy",
    match: { all: ["Edge/"] },
    result: { target: "browser", name: "Microsoft Edge" },
    versionPrefix: "Edge/",
  }),
  rule({
    id: "browser-opera-mini",
    match: { all: ["Opera Mini/"] },
    result: { target: "browser", name: "Opera Mini" },
    versionPrefix: "Opera Mini/",
  }),
  rule({
    id: "browser-opera-ios",
    match: { all: ["OPiOS/"] },
    result: { target: "browser", name: "Opera" },
    versionPrefix: "OPiOS/",
  }),
  rule({
    id: "browser-opera",
    match: { all: ["OPR/"] },
    result: { target: "browser", name: "Opera" },
    versionPrefix: "OPR/",
  }),
  rule({
    id: "browser-opera-presto",
    match: { all: ["Opera/", "Presto/"] },
    result: { target: "browser", name: "Opera" },
    versionPrefix: "Version/",
  }),
  rule({
    id: "browser-samsung",
    match: { all: ["SamsungBrowser/"] },
    result: { target: "browser", name: "Samsung Internet" },
    versionPrefix: "SamsungBrowser/",
  }),
  rule({
    id: "browser-yandex",
    match: { all: ["YaBrowser/"] },
    result: { target: "browser", name: "Yandex Browser" },
    versionPrefix: "YaBrowser/",
  }),
  rule({
    id: "browser-vivaldi",
    match: { all: ["Vivaldi/"] },
    result: { target: "browser", name: "Vivaldi" },
    versionPrefix: "Vivaldi/",
  }),
  rule({
    id: "browser-uc",
    match: { all: ["UCBrowser/"] },
    result: { target: "browser", name: "UC Browser" },
    versionPrefix: "UCBrowser/",
  }),
  rule({
    id: "browser-chrome-ios",
    match: { all: ["CriOS/"] },
    result: { target: "browser", name: "Chrome" },
    versionPrefix: "CriOS/",
  }),
  rule({
    id: "browser-firefox-ios",
    match: { all: ["FxiOS/"] },
    result: { target: "browser", name: "Firefox" },
    versionPrefix: "FxiOS/",
  }),
  rule({
    id: "browser-chromium",
    match: { all: ["Chromium/"] },
    result: { target: "browser", name: "Chromium" },
    versionPrefix: "Chromium/",
  }),
  // --- Browsers: Gecko, legacy IE, and generic fallbacks -----------------
  rule({
    id: "browser-firefox",
    match: { all: ["Firefox/"] },
    result: { target: "browser", name: "Firefox" },
    versionPrefix: "Firefox/",
  }),
  rule({
    id: "browser-ie-trident",
    match: { all: ["Trident/", "rv:"] },
    result: { target: "browser", name: "Internet Explorer" },
    versionPrefix: "rv:",
  }),
  rule({
    id: "browser-ie-legacy",
    match: { all: ["MSIE "] },
    result: { target: "browser", name: "Internet Explorer" },
    versionPrefix: "MSIE ",
  }),
  rule({
    id: "browser-chrome",
    match: { all: ["Chrome/"] },
    result: { target: "browser", name: "Chrome" },
    versionPrefix: "Chrome/",
  }),
  rule({
    id: "browser-mobile-safari",
    match: { all: ["Version/", "Mobile/", "Safari/"] },
    result: { target: "browser", name: "Mobile Safari" },
    versionPrefix: "Version/",
  }),
  rule({
    id: "browser-safari",
    match: { all: ["Version/", "Safari/"], none: ["Chrome/", "Chromium/"] },
    result: { target: "browser", name: "Safari" },
    versionPrefix: "Version/",
  }),
  // --- Engines (legacy engines before Blink) -----------------------------
  rule({
    id: "engine-edgehtml",
    match: { all: ["Edge/"] },
    result: { target: "engine", name: "EdgeHTML" },
    versionPrefix: "Edge/",
  }),
  rule({
    id: "engine-trident",
    match: { all: ["Trident/"] },
    result: { target: "engine", name: "Trident" },
    versionPrefix: "Trident/",
  }),
  rule({
    id: "engine-presto",
    match: { all: ["Presto/"] },
    result: { target: "engine", name: "Presto" },
    versionPrefix: "Presto/",
  }),
  rule({
    id: "engine-blink",
    match: { all: ["Chrome/"] },
    result: { target: "engine", name: "Blink" },
  }),
  rule({
    id: "engine-gecko",
    match: { all: ["Gecko/", "Firefox/"] },
    result: { target: "engine", name: "Gecko" },
    versionPrefix: "rv:",
  }),
  rule({
    id: "engine-webkit",
    match: { all: ["AppleWebKit/"] },
    result: { target: "engine", name: "WebKit" },
    versionPrefix: "AppleWebKit/",
  }),
  // --- Operating systems (specific before Android/Linux fallbacks) -------
  rule({
    id: "os-windows-phone",
    match: { all: ["Windows Phone "] },
    result: { target: "os", name: "Windows Phone" },
    versionPrefix: "Windows Phone ",
  }),
  rule({
    id: "os-android",
    match: { all: ["Android "] },
    result: { target: "os", name: "Android" },
    versionPrefix: "Android ",
  }),
  rule({
    id: "os-ios-phone",
    match: { all: ["iPhone OS "] },
    result: { target: "os", name: "iOS" },
    versionPrefix: "iPhone OS ",
  }),
  rule({
    id: "os-ios-tablet",
    match: { all: ["CPU OS "] },
    result: { target: "os", name: "iOS" },
    versionPrefix: "CPU OS ",
  }),
  rule({
    id: "os-windows",
    match: { all: ["Windows NT "] },
    result: { target: "os", name: "Windows" },
    versionPrefix: "Windows NT ",
  }),
  rule({
    id: "os-chromeos",
    match: { all: ["CrOS "] },
    result: { target: "os", name: "ChromeOS" },
  }),
  rule({
    id: "os-kaios",
    match: { all: ["KAIOS/"] },
    result: { target: "os", name: "KaiOS" },
    versionPrefix: "KAIOS/",
  }),
  rule({
    id: "os-tizen",
    match: { all: ["Tizen "] },
    result: { target: "os", name: "Tizen" },
    versionPrefix: "Tizen ",
  }),
  rule({
    id: "os-webos",
    match: { all: ["Web0S"] },
    result: { target: "os", name: "webOS" },
  }),
  rule({
    id: "os-macos",
    match: { all: ["Mac OS X "] },
    result: { target: "os", name: "macOS" },
    versionPrefix: "Mac OS X ",
  }),
  rule({
    id: "os-linux",
    match: { all: ["Linux"] },
    result: { target: "os", name: "Linux" },
  }),
  // --- Devices (specific classes before the desktop fallback) ------------
  rule({
    id: "device-windows-phone",
    match: { all: ["Windows Phone "] },
    result: { target: "device", type: "mobile" },
  }),
  rule({
    id: "device-ipad",
    match: { all: ["iPad"] },
    result: {
      target: "device",
      type: "tablet",
      vendor: "Apple",
      model: "iPad",
    },
  }),
  rule({
    id: "device-iphone",
    match: { all: ["iPhone"] },
    result: {
      target: "device",
      type: "mobile",
      vendor: "Apple",
      model: "iPhone",
    },
  }),
  rule({
    id: "device-playstation",
    match: { all: ["PlayStation"] },
    result: { target: "device", type: "console", vendor: "Sony" },
  }),
  rule({
    id: "device-xbox",
    match: { all: ["Xbox"] },
    result: { target: "device", type: "console", vendor: "Microsoft" },
  }),
  rule({
    id: "device-nintendo",
    match: { all: ["Nintendo"] },
    result: { target: "device", type: "console", vendor: "Nintendo" },
  }),
  rule({
    id: "device-apple-tv",
    match: { all: ["AppleTV"] },
    result: {
      target: "device",
      type: "tv",
      vendor: "Apple",
      model: "Apple TV",
    },
  }),
  rule({
    id: "device-roku",
    match: { all: ["Roku"] },
    result: { target: "device", type: "tv", vendor: "Roku" },
  }),
  rule({
    id: "device-chromecast",
    match: { all: ["CrKey"] },
    result: {
      target: "device",
      type: "tv",
      vendor: "Google",
      model: "Chromecast",
    },
  }),
  rule({
    id: "device-samsung-tv",
    match: { all: ["SMART-TV"] },
    result: { target: "device", type: "tv", vendor: "Samsung" },
  }),
  rule({
    id: "device-kaios",
    match: { all: ["KAIOS/"] },
    result: { target: "device", type: "mobile" },
  }),
  rule({
    id: "device-android-mobile",
    match: { all: ["Android", "Mobile"] },
    result: { target: "device", type: "mobile" },
  }),
  rule({
    id: "device-android-tablet",
    match: { all: ["Android"], none: ["Mobile"] },
    result: { target: "device", type: "tablet" },
  }),
  rule({
    id: "device-smart-tv",
    match: { all: ["SmartTV"] },
    result: { target: "device", type: "tv" },
  }),
  rule({
    id: "device-desktop",
    match: {
      all: ["Mozilla/"],
      none: ["Android", "iPhone", "iPad", "SmartTV"],
    },
    result: { target: "device", type: "desktop" },
  }),
  // --- CPU ----------------------------------------------------------------
  rule({
    id: "cpu-arm64",
    match: { all: ["arm64"] },
    result: { target: "cpu", architecture: "arm64", bitness: "64" },
  }),
  rule({
    id: "cpu-aarch64",
    match: { all: ["aarch64"] },
    result: { target: "cpu", architecture: "arm64", bitness: "64" },
  }),
  rule({
    id: "cpu-armv7",
    match: { all: ["armv7"] },
    result: { target: "cpu", architecture: "arm", bitness: "32" },
  }),
  rule({
    id: "cpu-x64",
    match: { all: ["x86_64"] },
    result: { target: "cpu", architecture: "x86_64", bitness: "64" },
  }),
  rule({
    id: "cpu-win64",
    match: { all: ["Win64", "x64"] },
    result: { target: "cpu", architecture: "x86_64", bitness: "64" },
  }),
  rule({
    id: "cpu-x86",
    match: { all: ["i686"] },
    result: { target: "cpu", architecture: "x86", bitness: "32" },
  }),
]);
