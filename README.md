<div align="center">

# UA Compass

[![CI](https://github.com/kidoz/ua-compass/actions/workflows/ci.yml/badge.svg)](https://github.com/kidoz/ua-compass/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ua-compass.svg)](https://www.npmjs.com/package/ua-compass)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/node/v/ua-compass.svg)](https://nodejs.org)
[![Types: TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](https://www.typescriptlang.org)
[![Module: ESM](https://img.shields.io/badge/module-ESM--only-f7df1e.svg)](https://nodejs.org/api/esm.html)

</div>

UA Compass is a secure, dependency-free parser for User-Agent strings and structured User-Agent Client Hints. Its importable library core is synchronous, runtime-neutral, and side-effect-free; an optional Node.js CLI prints the same immutable browser, engine, operating-system, device, CPU, and client classifications as JSON. Ambiguous evidence stays unknown rather than being presented as certain.

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Configured parser](#configured-parser)
- [Client Hints](#client-hints)
- [Reduced User-Agents](#reduced-user-agents)
- [Custom rules](#custom-rules)
- [Fetch intent](#fetch-intent)
- [Evidence](#evidence)
- [CLI](#cli)
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
- **Client Hints aware** — recognizes structured `Sec-CH-UA*` hints, prefers them over lower-confidence UA evidence, and normalizes both raw HTTP headers and browser-side `navigator.userAgentData` objects directly.
- **Reduced-UA detection** — flags frozen Chromium User-Agents and recovers real values from Client Hints where the browser grants them.
- **Safe custom rules** — bounded literal-token rule packs; caller-provided regular expressions are deliberately unsupported.
- **Zero runtime dependencies** — the ESM-only library entry has no DOM access, I/O, Node-specific imports, or import-time side effects; the separate CLI is the only Node-specific entry point.
- **Bot and AI-client detection** — classifies crawlers, AI crawlers, AI assistants, CLI tools, HTTP libraries, email clients, media players, and embedded runtimes (Electron).
- **Advisory fetch intent** — `fetchIntent(result)` maps a detected client to a named purpose when known and preserves ambiguous automation or unknown clients as `automated-fetch` or `unknown` rather than guessing.
- **XR and wearable devices** — recognizes Meta Quest headsets (`xr`) and Apple Watch / Wear OS wearables alongside desktop, mobile, tablet, TV, and console classes.
- **Android device model** — surfaces `Build.MODEL` from the Android User-Agent position when no more specific device rule applies.
- **Classification helpers** — a full set of boolean guards over parsed results: `isBot`, `isCrawler`, `isAiClient`, `isChromeFamily`, plus device-type (`isMobile`, `isTablet`, `isDesktop`, `isTv`, `isConsole`, `isWearable`, `isXr`) and client-type (`isCli`, `isLibrary`, `isEmailClient`, `isMediaPlayer`, `isEmbedded`) checks.
- **Evidence mode** — opt-in `evidence` capture records which bundled or custom rule id matched each category, for debugging precedence and custom rule packs.
- **CLI** — `npx ua-compass "<user-agent>"` parses a User-Agent string to JSON from the terminal.

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

The package is ESM-only and declares Node.js 24 or newer. The importable library entry is also designed for modern browsers, workers, serverless functions, and edge runtimes.

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

On the browser side, `navigator.userAgentData` exposes the same hints as a JavaScript object. Merge the low-entropy fields with any values you requested from `getHighEntropyValues()` and pass the result through the adapter:

```ts
import { clientHintsFromUserAgentData, parse } from "ua-compass";

const uaData = navigator.userAgentData;
const highEntropy = await uaData.getHighEntropyValues([
  "fullVersionList",
  "platformVersion",
  "architecture",
  "bitness",
  "model",
  "formFactors",
]);
const result = parse(navigator.userAgent, {
  clientHints: clientHintsFromUserAgentData({ ...uaData, ...highEntropy }),
});
```

The adapter is DOM-free (the caller reads `navigator` and awaits the promise); it validates, copies own-properties, and freezes via the same path as structured Client Hints input.

`Sec-CH-UA-Mobile` is treated as a UX-preference signal, not a hardware assertion: `?1` promotes an `unknown`/`desktop` device to `mobile` but never overrides a more specific UA-derived class (tablet, TV, console, wearable, XR); `?0` demotes a contradicting `mobile` class to `unknown` rather than asserting `desktop`. Browsers such as iOS Safari and Firefox normally omit this hint; when it is absent, the UA-derived class is left untouched.

When the high-entropy `Sec-CH-UA-Form-Factors` hint is supplied, its `"Watch"`, `"XR"`, and `"Tablet"` tokens can promote an `unknown`/`desktop`/`mobile` device to `wearable`, `xr`, or `tablet`. `Tablet` is useful for reduced Android UAs whose model is frozen to `K`; `Mobile`, `Desktop`, and `EInk` remain no-ops. A concrete UA-derived class always wins, and form-factor tokens are matched case-sensitively.

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

## Fetch intent

`fetchIntent(result)` maps a detected client to an advisory fetch-purpose bucket for analytics and policy evaluation:

```ts
import { fetchIntent, parse } from "ua-compass";

const intent = fetchIntent(parse(request.headers.get("user-agent") ?? ""));
// "ai-training" | "search-index" | "social-preview" | "monitoring" |
// "content-feed" | "user-fetch" | "automation-library" | "media" |
// "embedded-app" | "browser" | "automated-fetch" | "unknown"
```

Known clients use their publicly documented purpose: for example, GPTBot maps to `ai-training`, OAI-SearchBot maps to `search-index`, and ChatGPT-User maps to `user-fetch`. Unrecognized automated clients return `automated-fetch`; input with no recognized client returns `unknown` rather than being mislabeled as a browser.

The taxonomy is original to UA Compass and is **advisory**. A User-Agent match identifies only who a client claims to be—it does not verify identity. Do not use `fetchIntent`, `isBot`, or any User-Agent classification as authentication or as the sole basis for access control.

## Evidence

Enable `evidence` on a parser to capture which bundled or custom rule id matched each category — useful for debugging precedence and custom rule packs:

```ts
import { createParser } from "ua-compass";

const parser = createParser({ evidence: true });
const result = parser.parse(userAgent);
result.evidence?.browser; // "browser-chrome"
result.evidence?.os; // "os-windows"
```

When `evidence` is off (the default), the `evidence` field is absent and no evidence object is allocated. Evidence contains matched rule IDs, not verification metadata; Client Hint refinements and Android model extraction are not rule matches and are therefore not recorded.

## CLI

Parse a User-Agent string to JSON from the terminal:

```sh
npx ua-compass "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Mobile Safari/537.36"
```

```sh
echo "<user-agent>" | npx ua-compass --stdin
npx ua-compass "<user-agent>" --evidence   # include matched rule ids
npx ua-compass -- "<user-agent>"           # "--" ends option parsing
npx ua-compass --help
```

The CLI requires Node.js 24 or newer. Stdin is byte-bounded before decoding and then passes through the same 4096 UTF-16-code-unit default limit as the library parser, so an unbounded pipe cannot bypass input hardening.

Exit codes: `0` success, `1` usage error, `2` input exceeds the length limit.

## API overview

- `parse(userAgent, options?)` parses with secure defaults.
- `createParser(options?)` creates a reusable configured parser.
- `ParseResult` contains readonly `ua`, `uaReduced`, `browser`, `engine`, `os`, `device`, `cpu`, `client`, and (when enabled) `evidence` fields.
- `ParserOptions` controls input limits, overflow behavior, custom rule packs, and the opt-in `evidence` flag.
- `ParseOptions` supplies structured Client Hints per call.
- `clientHintsFromHeaders(headers)` normalizes raw `Sec-CH-UA*` headers into `ClientHints`.
- `clientHintsFromUserAgentData(userAgentData)` normalizes a browser-side `navigator.userAgentData` object (merged with `getHighEntropyValues()` results) into `ClientHints`. The caller reads the DOM and awaits the high-entropy promise; the adapter stays DOM-free and reuses the same validation and freezing as the structured-input path.
- `isBot(result)` returns true for bots, crawlers, and AI crawlers; `isCrawler(result)` is the narrower crawling/indexing view (search and AI-training crawlers); `isAiClient(result)` covers AI crawlers and user-triggered AI assistants.
- `isChromeFamily(result)` recognizes Blink-engine or known Chromium-family results.
- Device-type guards: `isMobile`, `isTablet`, `isDesktop`, `isTv`, `isConsole`, `isWearable`, and `isXr`.
- Client-type guards: `isCli`, `isLibrary`, `isEmailClient`, `isMediaPlayer`, and `isEmbedded`.
- `fetchIntent(result)` returns an advisory fetch-purpose bucket for analytics and policy evaluation.
- `ua-compass` CLI parses a User-Agent string to JSON (`npx ua-compass "<ua>"`).
- `DEFAULT_MAX_USER_AGENT_LENGTH` exports the secure default (`4096`) for integrations that need to align their own input boundaries.
- `InputLimitError` and `RuleValidationError` distinguish predictable boundary failures.

The root entry also exports the readonly TypeScript contracts for results, hints, parser options, custom rules, evidence, client/device categories, and fetch intent. Internal detectors and bundled rule tables are intentionally not exported.

`client.type` can be `browser`, `webview`, `bot`, `crawler`, `ai-crawler`, `ai-assistant`, `cli`, `library`, `email`, `mediaplayer`, `embedded`, or `unknown`. AI training and search crawlers (GPTBot, ClaudeBot, OAI-SearchBot, CCBot, and others) report `ai-crawler`; user-triggered AI fetchers (ChatGPT-User, Claude-User, Perplexity-User) report `ai-assistant`. Email clients (Thunderbird, Outlook), media players (VLC, iTunes, Kodi, AppleCoreMedia), and Electron apps report `email`, `mediaplayer`, and `embedded` respectively. Non-browser clients leave `browser` empty. A User-Agent match identifies who a client claims to be — it is not verification, so treat bot classification as advisory rather than authentication.

`device.type` can be `desktop`, `mobile`, `tablet`, `tv`, `console`, `wearable`, `xr`, `embedded`, or `unknown`. Meta Quest headsets report `xr`; Apple Watch, Galaxy Watch, and Wear OS smartwatches report `wearable`. Because Wear OS exposes no generic watch token, wearable detection keys on explicit product/model tokens, and broader smartwatch coverage remains future work.

## Runtime compatibility

UA Compass is ESM-only and has no CommonJS entry point. The importable library graph has no runtime dependencies, DOM access, Node-specific imports, I/O, or import-time environmental side effects. The `ua-compass` binary is compiled separately and is the only Node-specific entry point. The package declares Node.js 24 or newer, and CI tests Node.js 24 and 26.

The same side-effect-free library build is intended for modern browsers, workers, serverless functions, and edge runtimes. The project builds with TypeScript 6; generated declarations and the exact packed archive are verified in a clean TypeScript consumer, the installed CLI is exercised from that archive, and the built ESM library runs in real headless Chromium.

## Security

User-Agent strings, Client Hints, raw headers, parser options, custom rules, and CLI stdin cross untrusted-input boundaries. UA Compass bounds inputs and rule packs, byte-bounds CLI stdin before decoding, normalizes malformed UTF-16, uses literal matching instead of dynamic regular expressions, ignores inherited configuration properties, validates extension shapes, and freezes normalized configuration and returned data. Library parsing performs no I/O and keeps no cross-call mutable state.

To report a vulnerability, see [SECURITY.md](SECURITY.md). Please do not open a public issue for security reports.

## Accuracy and limitations

The current bundled rule set provides focused coverage for:

- Major browsers and engines: Chrome/Chromium, Microsoft Edge, Firefox, Safari/Mobile Safari, Opera, Samsung Internet, vendor Chromium builds, Gecko forks, common WebViews, and selected legacy engines.
- Operating systems and CPUs: Windows, macOS, iOS, Android, ChromeOS, Linux, BSD variants, Solaris, mobile/TV operating systems, and common ARM/x86 architecture tokens.
- Devices: desktop, mobile, tablet, TV/streaming, console, selected wearables, Meta Quest XR, and unknown classifications.
- Non-browser clients: search and AI crawlers, user-triggered AI assistants, social-preview and monitoring bots, CLI tools, HTTP libraries, email clients, media players, and Electron.
- Client Hints: Microsoft Edge, Opera, Brave, Samsung Internet, Vivaldi, Chrome, and Chromium brands; platform, version, architecture, bitness, model, mobile preference, and form-factor refinements.

Coverage is deliberately selective rather than universal. Future work includes broader wearable coverage from UA strings, distro-level Linux identification, and out-of-band bot verification metadata. User-Agent values can be reduced or spoofed; use feature detection when behavior depends on capabilities. Reduced Chromium UAs are flagged via `uaReduced`, and Windows reports no version on reduced UAs because NT `10.0` cannot distinguish Windows 10 from 11—supply `Sec-CH-UA-Platform-Version` to recover it. Android `device.model` is read from the documented `Android <version>; [<model>] [Build/<build>]` segment when no more specific rule applies; UA reduction can omit the model, so `Sec-CH-UA-Model` is the forward path for that detail.

## Bundle size

The current packed archive is approximately 38 KB; the reviewed milestone limit is 50,000 bytes. `pnpm benchmark:check` packs the project and enforces this limit, while `pnpm pack:consumer` installs the exact archive into a clean ESM/TypeScript consumer and exercises both the library and CLI.

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
