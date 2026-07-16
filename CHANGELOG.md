# Changelog

All notable changes follow semantic versioning.

## 0.1.0 - Unreleased

- Scaffold the ESM-only TypeScript package and explicit root export.
- Add immutable parsing results, structured Client Hints, safe custom rule packs, and initial browser/client, engine, OS, device, and CPU coverage.
- Add strict input limits, malformed UTF-16 normalization, validation, fuzz/security tests, coverage gates, benchmark and package-size baselines, and packed-consumer verification.
- Add statistical runtime benchmarks, fresh-process and worker cold-start measurements, TypeScript compiler diagnostics, hostile-input p95 gates, JSON artifacts, and controlled-hardware regression comparison.
- Correct Client Hint CPU bitness and negative mobile precedence, enforce the packed-size limit, and add type-level, license, and exact-archive consumer release gates.
- Expand detection coverage: vendor Chromium browsers (Amazon Silk, Meta Quest Browser, MIUI, Huawei, Naver Whale, Maxthon), Gecko forks (Waterfox, Pale Moon, SeaMonkey) with the Goanna engine, BSD/Solaris operating systems, the `amd64` CPU token, and additional crawler, preview, monitoring, and feed bots (Googlebot-Image, MJ12bot, DotBot, SeznamBot, Naver Yeti, Pinterestbot, redditbot, UptimeRobot, Pingdom, Feedly).
