<div align="center">

# UA Compass

[![CI](https://github.com/kidoz/ua-compass/actions/workflows/ci.yml/badge.svg)](https://github.com/kidoz/ua-compass/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ua-compass.svg)](https://www.npmjs.com/package/ua-compass)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/node/v/ua-compass.svg)](https://nodejs.org)
[![Types: TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org)
[![Module: ESM](https://img.shields.io/badge/module-ESM--only-f7df1e.svg)](https://nodejs.org/api/esm.html)

</div>

UA Compass is parser for User-Agent strings and structured User-Agent Client Hints. It returns immutable browser, engine, operating-system, device, CPU, and client classifications without claiming that ambiguous input is certain.

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Configured parser](#configured-parser)
- [Client Hints](#client-hints)
- [Reduced User-Agents](#reduced-user-agents)
- [Custom rules](#custom-rules)
- [API overview](#api-overview)
- [Runtime compatibility](#runtime-compatibility)
- [Security](#security)
- [Accuracy and limitations](#accuracy-and-limitations)
- [Bundle size](#bundle-size)
- [Benchmarks](#benchmarks)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Secure by default** — bounds input and rule-pack sizes, normalizes malformed UTF-16, matches with literal tokens instead of dynamic regular expressions, and freezes returned data.
- **Immutable results** — every `ParseResult` and nested object is deeply frozen and safe to share.
- **Honest classifications** — ambiguous input reports `"unknown"` rather than guessing; unknown optional scalars are omitted.
- **Client Hints aware** — recognizes structured `Sec-CH-UA*` hints, prefers them over lower-confidence UA evidence, and normalizes raw headers directly.
- **Reduced-UA detection** — flags frozen Chromium User-Agents and recovers real values from Client Hints where the browser grants them.
- **Safe custom rules** — bounded literal-token rule packs; caller-provided regular expressions are deliberately unsupported.
- **Zero runtime dependencies** — ESM-only, no DOM access, no I/O, no import-time side effects.
- **Bot and AI-client detection** — classifies crawlers, AI crawlers, AI assistants, CLI tools, and HTTP libraries.

## Installation

```sh
pnpm add ua-compass
```

```sh
npm install ua-compass
```

```sh
yarn add ua-compass
```

## Quick start

```ts
import { parse } from "ua-compass";

const result = parse(request.headers.get("user-agent") ?? "");
console.log(result.browser.name, result.browser.major);
```

Unknown optional scalar fields are omitted. `device.type` and `client.type` are always present and use `"unknown"` when evidence is insufficient.

## Configured parser

```ts
import { createParser } from "ua-compass";

const parser = createParser({
  maxUserAgentLength: 2048,
  overflowBehavior: "throw",
});

const result = parser.parse(userAgent);
```

The default maximum User-Agent length is 4096 UTF-16 code units. Input over that limit throws `InputLimitError`; `"truncate"` is available when deterministic truncation is more appropriate.

## Client Hints

```ts
import { parse } from "ua-compass";

const result = parse(userAgent, {
  clientHints: {
    brands: [
      { brand: "Chromium", version: "143" },
      { brand: "Google Chrome", version: "143" },
    ],
    mobile: false,
    platform: "Windows",
    platformVersion: "15.0.0",
    architecture: "x86",
    bitness: "64",
  },
});
```

Recognized structured hints take precedence over lower-confidence UA evidence. Unknown brands and platforms are not guessed. Brand lists are treated as unordered and GREASE entries (for example `"Not/A)Brand"`) are ignored, as the Client Hints specification requires.

Raw `Sec-CH-UA*` request headers can be normalized directly:

```ts
import { clientHintsFromHeaders, parse } from "ua-compass";

const result = parse(request.headers.get("user-agent") ?? "", {
  clientHints: clientHintsFromHeaders({
    "sec-ch-ua": request.headers.get("sec-ch-ua"),
    "sec-ch-ua-mobile": request.headers.get("sec-ch-ua-mobile"),
    "sec-ch-ua-platform": request.headers.get("sec-ch-ua-platform"),
  }),
});
```

Header parsing is bounded and regex-free; malformed or oversized header values are dropped rather than thrown, so hostile wire data cannot make a server error out. High-entropy headers (`Sec-CH-UA-Model`, `Sec-CH-UA-Platform-Version`, and others) are only sent after an `Accept-CH` opt-in, and Client Hints ship in Chromium-based browsers only — UA-string parsing remains the permanent primary path.

## Reduced User-Agents

Chromium froze most User-Agent detail during its User-Agent reduction: version tails are pinned to `.0.0.0`, Android reports the placeholders `Android 10; K`, and desktop platform tokens are static. UA Compass detects these frozen shapes and sets `result.uaReduced` to `true` instead of reporting placeholders as facts: the fake version tail is trimmed to the real major version, and the frozen `10.15.7` (macOS), `10` (Android), and NT `10.0` (Windows) platform versions are omitted. Supplying Client Hints restores the real values where the browser grants them.

## Custom rules

Custom packs use bounded literal tokens; caller-provided regular expressions are deliberately unsupported.

```ts
import { createParser } from "ua-compass";

const parser = createParser({
  customRulePacks: [
    {
      name: "internal-clients",
      rules: [
        {
          id: "acme-monitor",
          match: { all: ["AcmeMonitor/"] },
          result: { target: "client", type: "bot", name: "Acme Monitor" },
          versionPrefix: "AcmeMonitor/",
        },
      ],
    },
  ],
});
```

Custom rules precede bundled rules and are validated and copied when the parser is created.

## API overview

- `parse(userAgent, options?)` parses with secure defaults.
- `createParser(options?)` creates a reusable configured parser.
- `ParseResult` contains readonly `ua`, `uaReduced`, `browser`, `engine`, `os`, `device`, `cpu`, and `client` fields.
- `ParserOptions` controls input limits, overflow behavior, and custom rule packs.
- `ParseOptions` supplies structured Client Hints per call.
- `clientHintsFromHeaders(headers)` normalizes raw `Sec-CH-UA*` headers into `ClientHints`.
- `isBot(result)` and `isAiClient(result)` classify client categories.
- `InputLimitError` and `RuleValidationError` distinguish predictable boundary failures.

`client.type` can be `browser`, `webview`, `bot`, `crawler`, `ai-crawler`, `ai-assistant`, `cli`, `library`, `embedded`, or `unknown`. AI training and search crawlers (GPTBot, ClaudeBot, OAI-SearchBot, CCBot, and others) report `ai-crawler`; user-triggered AI fetchers (ChatGPT-User, Claude-User, Perplexity-User) report `ai-assistant`. Non-browser clients leave `browser` empty. A User-Agent match identifies who a client claims to be — it is not verification, so treat bot classification as advisory rather than authentication.

## Runtime compatibility

UA Compass is ESM-only and has no CommonJS entry point. It targets modern JavaScript runtimes and has no runtime dependencies, DOM access, Node-specific imports, I/O, or import-time environmental side effects. It is intended for Node.js 22+, browsers, workers, serverless functions, and edge runtimes. The library builds with TypeScript 6, and its generated declarations and exact packed archive are verified in a clean TypeScript consumer.

## Security

User-Agent strings and custom rules are untrusted input. UA Compass bounds input and rule-pack sizes, normalizes malformed UTF-16, uses literal matching instead of dynamic regular expressions, validates extension shapes, and freezes returned data.

To report a vulnerability, see [SECURITY.md](SECURITY.md). Please do not open a public issue for security reports.

## Accuracy and limitations

This `0.1.0` slice covers the major desktop and mobile browsers (Chrome, Microsoft Edge, Firefox, Safari/Mobile Safari, Opera, Samsung Internet, Yandex, Vivaldi, UC, Chromium) plus vendor Chromium builds (Amazon Silk, Meta Quest Browser, MIUI, Huawei, Naver Whale, Maxthon) and Gecko forks (Waterfox, Pale Moon, SeaMonkey), their iOS variants (Chrome, Firefox, Edge, Opera via `CriOS`/`FxiOS`/`EdgiOS`/`OPiOS`), legacy Internet Explorer and EdgeHTML/Presto/Goanna engines, and named in-app WebViews (Facebook, Instagram, WeChat, LINE, Snapchat). It classifies core operating systems (Windows, macOS, Linux, Android, iOS, ChromeOS, Windows Phone, KaiOS, Tizen, webOS, FreeBSD, OpenBSD, NetBSD, Solaris), device classes including consoles (PlayStation, Xbox, Nintendo) and TV/streaming devices (Apple TV, Roku, Chromecast, Samsung), common CPU tokens, and a broad set of crawlers, AI crawlers, social preview, monitoring, and feed bots, CLI tools, and HTTP libraries (Googlebot, bingbot, GPTBot, ClaudeBot, MJ12bot, DotBot, SeznamBot, UptimeRobot, Feedly, curl, python-requests, and more). Client Hint brand mapping covers Microsoft Edge, Opera, Brave, Samsung Internet, Vivaldi, Chrome, and Chromium.

Still future work: wearables, detailed Android model extraction, distro-level Linux, and out-of-band bot verification metadata. User-Agent values can be reduced or spoofed; use feature detection when behavior depends on capabilities. Reduced Chromium UAs are flagged via `uaReduced`, and Windows reports no version on reduced UAs because NT `10.0` cannot distinguish Windows 10 from 11 — supply `Sec-CH-UA-Platform-Version` to recover it.

## Bundle size

The current packed archive is approximately 28 KB; the reviewed milestone limit is 50,000 bytes. `pnpm benchmark:check` packs the project and enforces this limit, while `pnpm pack:consumer` installs the exact archive into a clean ESM and TypeScript consumer.

## Benchmarks

`pnpm benchmark` measures the built package with warmup and statistical sampling, fresh-process import and first-parse latency, worker startup, TypeScript compiler diagnostics, and hostile inputs. Shared CI retains JSON artifacts and hard-gates only package size and generous adversarial p95 limits; `pnpm benchmark:regression` is reserved for controlled hardware.

## Contributing

Contributions are welcome. Because UA Compass is a clean-room, MIT-licensed implementation, detection data and rules must be independently authored — do not copy tokens, regexes, or fixtures from other parsers or from incompatibly licensed sources.

```sh
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Please open an issue to discuss substantial changes before sending a pull request, keep the security posture intact, and add fixtures for any new detection. See [CHANGELOG.md](CHANGELOG.md) for release history and [SECURITY.md](SECURITY.md) for the security policy.

## License

UA Compass is available under the [MIT License](LICENSE). It is an independently authored clean-room implementation, not a fork or port of another parser. The MIT license applies to the library and all bundled detection data, with no copyleft obligations and no commercial tiers: proprietary and commercial use are permitted on the same terms as open source.
