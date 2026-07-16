import { clientHintsFromHeaders, createParser, parse } from "ua-compass";

const chrome = parse(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
  {
    clientHints: clientHintsFromHeaders({
      "sec-ch-ua": '"Chromium";v="143", "Google Chrome";v="143"',
      "sec-ch-ua-platform": '"Windows"',
    }),
  },
);

const parser = createParser({
  customRulePacks: [
    {
      name: "browser-smoke",
      rules: [
        {
          id: "browser-smoke-client",
          match: { all: ["BrowserSmoke/"] },
          result: { target: "client", type: "library", name: "BrowserSmoke" },
          versionPrefix: "BrowserSmoke/",
        },
      ],
    },
  ],
});
const custom = parser.parse("BrowserSmoke/1.0");

if (
  chrome.browser.name !== "Chrome" ||
  chrome.os.name !== "Windows" ||
  !Object.isFrozen(chrome) ||
  !Object.isFrozen(chrome.browser) ||
  custom.client.name !== "BrowserSmoke" ||
  custom.client.version !== "1.0" ||
  "process" in globalThis
) {
  throw new Error("UA Compass returned an invalid browser smoke result");
}

document.documentElement.dataset.uaCompassSmoke = "passed";
