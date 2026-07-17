# Changelog

All notable changes follow semantic versioning.

## 1.1.0 - 2026-07-17

- Add `ClientHints.formFactors` and parse the `Sec-CH-UA-Form-Factors` header in `clientHintsFromHeaders()`, with a bounded structured-field list (`MAX_HINT_FORM_FACTORS`) that drops the whole header on any malformed, oversized, or non-conformant item.
- Promote an `unknown`/`desktop`/`mobile` device to `wearable` or `xr` from the case-sensitive `"Watch"` and `"XR"` form-factor tokens — the only way to recover those classes when Wear OS and some XR runtimes emit no distinguishing User-Agent token — while a concrete UA device class always wins over the hint.
- Document `Sec-CH-UA-Mobile` as a UX-preference signal rather than a hardware assertion: `?1` promotes only from `unknown`/`desktop`, `?0` demotes a contradicting `mobile` to `unknown` instead of asserting `desktop`, and browsers that omit the hint never clobber a UA-derived class.

## 1.0.0 - 2026-07-17

- Scaffold the ESM-only TypeScript package and explicit root export.
- Add immutable parsing results, structured Client Hints, safe custom rule packs, and initial browser/client, engine, OS, device, and CPU coverage.
- Add strict input limits, malformed UTF-16 normalization, validation, fuzz/security tests, coverage gates, benchmark and package-size baselines, and packed-consumer verification.
- Add statistical runtime benchmarks, fresh-process and worker cold-start measurements, TypeScript compiler diagnostics, hostile-input p95 gates, JSON artifacts, and controlled-hardware regression comparison.
- Correct Client Hint CPU bitness and negative mobile precedence, enforce the packed-size limit, and add type-level, license, and exact-archive consumer release gates.
- Expand detection coverage: vendor Chromium browsers (Amazon Silk, Meta Quest Browser, MIUI, Huawei, Naver Whale, Maxthon), Gecko forks (Waterfox, Pale Moon, SeaMonkey) with the Goanna engine, BSD/Solaris operating systems, the `amd64` CPU token, and additional crawler, preview, monitoring, and feed bots (Googlebot-Image, MJ12bot, DotBot, SeznamBot, Naver Yeti, Pinterestbot, redditbot, UptimeRobot, Pingdom, Feedly).
- Add email-client (`email`) and media-player (`mediaplayer`) client types (Thunderbird, Outlook, VLC, iTunes, Kodi, AppleCoreMedia), Electron embedded-runtime detection, the `xr` device type with Meta Quest detection, and Apple Watch / Galaxy Watch / Wear OS wearable detection.
- Add the `isChromeFamily`, `isMobile`, `isTablet`, and `isDesktop` type guards.
- Accept `email`, `mediaplayer`, and `xr` result types in custom rule packs (the validator previously rejected types the public API and bundled rules already used).
- Preserve a UA-derived OS version when a Client-Hints platform hint carries no version, stop a `mobile: true` hint from overriding a more specific UA device class (tablet/tv/console/wearable/xr), and honor a bitness-only Client Hint.
- Reject custom rule IDs that collide with bundled rule IDs; bucket rules by target for lower worst-case hostile-input cost; build all result objects with a null prototype.
- Broaden fuzz coverage across the input-length limits (both overflow modes), raw `Sec-CH-UA*` headers, structured Client Hints, and custom rule packs.
- Drop published source maps and declaration maps to keep the archive lean and avoid shipping maps that reference unpublished sources; add `CONTRIBUTING.md`.
- Raise the minimum supported Node.js to 24 (`engines` and CI).
- Add tracked architecture, rule-authoring, and fixture/source provenance documentation, plus a real headless-Chromium package smoke test in CI and release workflows.
