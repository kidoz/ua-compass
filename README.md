<div align="center">

# UA Compass

[![CI](https://github.com/kidoz/ua-compass/actions/workflows/ci.yml/badge.svg)](https://github.com/kidoz/ua-compass/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ua-compass.svg)](https://www.npmjs.com/package/ua-compass)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/node/v/ua-compass.svg)](https://nodejs.org)
[![Types: TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org)
[![Module: ESM](https://img.shields.io/badge/module-ESM--only-f7df1e.svg)](https://nodejs.org/api/esm.html)

</div>

UA Compass is a secure, dependency-free parser for User-Agent strings and structured User-Agent Client Hints. It returns immutable browser, engine, operating-system, device, CPU, and client classifications without presenting ambiguous input as certain.

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
- [Documentation](#documentation)
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
- **Bot and AI-client detection** — classifies crawlers, AI crawlers, AI assistants, CLI tools, HTTP libraries, email clients, media players, and embedded runtimes (Electron).
- **XR and wearable devices** — recognizes Meta Quest headsets (`xr`) and Apple Watch / Wear OS wearables alongside desktop, mobile, tablet, TV, and console classes.
- **Classification helpers** — `isBot`, `isAiClient`, `isChromeFamily`, `isMobile`, `isTablet`, and `isDesktop` provide concise boolean checks over parsed results.

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

The default maximum User-Agent length is 4096 UTF-16 code units. Input over that limit throws `InputLimitError`; `"truncate"` is available when deterministic truncation is more appropriate. Configured limits must be integers from 1 through 65,536.

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

Recognized structured hints take precedence over lower-confidence UA evidence. Unknown brands and platforms are not guessed. Brand lists are treated as unordered, and GREASE-like entries such as `"Not/A)Brand"` are ignored.

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

Header parsing is bounded and regex-free; malformed or oversized header values are dropped rather than thrown, so hostile wire data cannot make a server error out. Availability of individual Client Hints varies by browser, request policy, and granted high-entropy hints, so UA-string parsing remains the fallback path.

`Sec-CH-UA-Mobile` is treated as a UX-preference signal, not a hardware assertion: `?1` promotes an `unknown`/`desktop` device to `mobile` but never overrides a more specific UA-derived class (tablet, TV, console, wearable, XR); `?0` demotes a contradicting `mobile` class to `unknown` rather than asserting `desktop`. iOS Safari and Firefox do not send this hint, so an iOS or mobile UA-derived class is never affected.

When the high-entropy `Sec-CH-UA-Form-Factors` hint is supplied, its `"Watch"` and `"XR"` tokens promote an `unknown`/`desktop`/`mobile` device to `wearable` or `xr` respectively — the only way to recover those classes, since Wear OS emits no distinguishing User-Agent token. Other form-factor values (`Mobile`, `Tablet`, `Desktop`, `EInk`) are ignored because the User-Agent string already exposes them. Form-factor tokens are matched case-sensitively, so a lowercased value cannot promote a class.

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

Custom rules precede bundled rules and are validated, copied, and frozen when the parser is created. A parser accepts at most four packs with 64 rules per pack, four literal tokens per `all` or `none` list, and 128 UTF-16 code units per textual rule field. Rule IDs must be unique across all custom packs and must not reuse a bundled rule ID.

### Bundled-rule provenance

The bundled detection rules and test fixtures are original work authored for this repository and distributed under its MIT License. Initial rules were introduced in commit `b976632`, expanded in `0eb22b5` and `107602c`, and covered by independently authored feature fixtures in `4af08d1`; no external rule database or test corpus was imported. Rules use independently selected literal product tokens and independently constructed examples based on publicly observable User-Agent behavior and public vendor documentation.

Future imported detection data or fixtures must record their source, author, retrieval date, and license before release. Data without clear MIT-compatible redistribution rights must not be included.

## API overview

- `parse(userAgent, options?)` parses with secure defaults.
- `createParser(options?)` creates a reusable configured parser.
- `ParseResult` contains readonly `ua`, `uaReduced`, `browser`, `engine`, `os`, `device`, `cpu`, and `client` fields.
- `ParserOptions` controls input limits, overflow behavior, and custom rule packs.
- `ParseOptions` supplies structured Client Hints per call.
- `clientHintsFromHeaders(headers)` normalizes raw `Sec-CH-UA*` headers into `ClientHints`.
- `isBot(result)` returns true for bots, crawlers, and AI crawlers; `isAiClient(result)` covers AI crawlers and user-triggered AI assistants.
- `isChromeFamily(result)` recognizes Blink-engine or known Chromium-family results; `isMobile`, `isTablet`, and `isDesktop` check `device.type`.
- `InputLimitError` and `RuleValidationError` distinguish predictable boundary failures.

`client.type` can be `browser`, `webview`, `bot`, `crawler`, `ai-crawler`, `ai-assistant`, `cli`, `library`, `email`, `mediaplayer`, `embedded`, or `unknown`. AI training and search crawlers (GPTBot, ClaudeBot, OAI-SearchBot, CCBot, and others) report `ai-crawler`; user-triggered AI fetchers (ChatGPT-User, Claude-User, Perplexity-User) report `ai-assistant`. Email clients (Thunderbird, Outlook), media players (VLC, iTunes, Kodi, AppleCoreMedia), and Electron apps report `email`, `mediaplayer`, and `embedded` respectively. Non-browser clients leave `browser` empty. A User-Agent match identifies who a client claims to be — it is not verification, so treat bot classification as advisory rather than authentication.

`device.type` can be `desktop`, `mobile`, `tablet`, `tv`, `console`, `wearable`, `xr`, `embedded`, or `unknown`. Meta Quest headsets report `xr`; Apple Watch, Galaxy Watch, and Wear OS smartwatches report `wearable`. Because Wear OS exposes no generic watch token, wearable detection keys on explicit product/model tokens, and broader smartwatch coverage remains future work.

## Runtime compatibility

UA Compass is ESM-only and has no CommonJS entry point. It has no runtime dependencies, DOM access, Node-specific imports, I/O, or import-time environmental side effects. The package declares Node.js 24 or newer; CI tests Node.js 24 and 26. The same runtime-neutral build is intended for modern browsers, workers, serverless functions, and edge runtimes. The library builds with TypeScript 6; generated declarations and the exact packed archive are verified in a clean TypeScript consumer, and the built ESM package is executed in real headless Chromium.

## Security

User-Agent strings, Client Hints, raw headers, parser options, and custom rules cross untrusted-input boundaries. UA Compass bounds inputs and rule packs, normalizes malformed UTF-16, uses literal matching instead of dynamic regular expressions, ignores inherited configuration properties, validates extension shapes, and freezes normalized configuration and returned data. Parsing performs no I/O and keeps no cross-call mutable state.

To report a vulnerability, see [SECURITY.md](SECURITY.md). Please do not open a public issue for security reports.

## Accuracy and limitations

The `1.0.0` rule set provides focused coverage for:

- Major browsers and engines: Chrome/Chromium, Microsoft Edge, Firefox, Safari/Mobile Safari, Opera, Samsung Internet, vendor Chromium builds, Gecko forks, common WebViews, and selected legacy engines.
- Operating systems and CPUs: Windows, macOS, iOS, Android, ChromeOS, Linux, BSD variants, Solaris, mobile/TV operating systems, and common ARM/x86 architecture tokens.
- Devices: desktop, mobile, tablet, TV/streaming, console, selected wearables, Meta Quest XR, and unknown classifications.
- Non-browser clients: search and AI crawlers, user-triggered AI assistants, social-preview and monitoring bots, CLI tools, HTTP libraries, email clients, media players, and Electron.
- Client Hint brands: Microsoft Edge, Opera, Brave, Samsung Internet, Vivaldi, Chrome, and Chromium.

Coverage is deliberately selective rather than universal. Future work includes broader wearable and Android-model coverage from UA strings, distro-level Linux identification, and out-of-band bot verification metadata. User-Agent values can be reduced or spoofed; use feature detection when behavior depends on capabilities. Reduced Chromium UAs are flagged via `uaReduced`, and Windows reports no version on reduced UAs because NT `10.0` cannot distinguish Windows 10 from 11—supply `Sec-CH-UA-Platform-Version` to recover it.

## Bundle size

The current packed archive is approximately 29 KB; the reviewed milestone limit is 50,000 bytes. `pnpm benchmark:check` packs the project and enforces this limit, while `pnpm pack:consumer` installs the exact archive into a clean ESM and TypeScript consumer.

## Benchmarks

`pnpm benchmark` measures the built package with warmup and statistical sampling, fresh-process import and first-parse latency, worker startup, TypeScript compiler diagnostics, and hostile inputs. Shared CI retains JSON artifacts and hard-gates only package size and generous adversarial p95 limits; `pnpm benchmark:regression` is reserved for controlled hardware.

## Documentation

- [Architecture](docs/architecture.md) describes runtime boundaries, module responsibilities, rule execution, immutability, and packaging.
- [Rule authoring](docs/rule-authoring.md) defines the declarative schema, security limits, precedence rules, and required tests.
- [Fixture and source provenance](docs/fixture-provenance.md) records fixture authorship, the test inventory, public behavior references, licensing treatment, and the process for future imports.

## Contributing

Contributions are welcome. UA Compass is an MIT-licensed library, and its detection data and rules must be independently authored — do not copy tokens, regexes, or fixtures from incompatibly licensed sources.

```sh
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Please open an issue to discuss substantial changes before sending a pull request, keep the security posture intact, and add fixtures for any new detection. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow and contribution guidelines, [CHANGELOG.md](CHANGELOG.md) for release history, and [SECURITY.md](SECURITY.md) for the security policy.

## License

UA Compass is available under the [MIT License](LICENSE). It is an independently authored, original implementation. The MIT license applies to the library and all bundled detection data, with no copyleft obligations and no commercial tiers: proprietary and commercial use are permitted on the same terms as open source.
