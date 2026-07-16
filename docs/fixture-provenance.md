# Fixture and source provenance

This record covers the bundled rules in `src/bundled-rules.ts` and the fixture
strings under `tests/`. It exists to make clean-room authorship and MIT
redistribution decisions reviewable.

## Provenance status

- **Authorship:** Original work created for UA Compass.
- **License:** MIT under the repository `LICENSE`.
- **External rule or fixture imports:** None.
- **Incompatible parser corpora consulted:** None.
- **Fixture construction:** Synthetic strings composed from public token-format
  documentation, standards, and observable product conventions. Version values
  are illustrative unless a test explicitly exercises a documented reduced-UA
  placeholder.
- **Redistribution basis:** The repository redistributes its own rule objects and
  synthetic fixtures, not source prose, code, regexes, or datasets from the
  references below.

Initial rules and fixtures were introduced in commit `b976632`; later original
coverage was added in `0eb22b5`, `107602c`, and `4af08d1`.

## Fixture inventory

| File                                | Coverage                                                                               | Origin and redistribution basis                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `tests/parser.test.ts`              | Public API, major browsers, OS/CPU, custom rules, limits, immutability                 | Independently composed UA Compass fixtures; MIT original work.                                    |
| `tests/client-hint-headers.test.ts` | Structured header parsing, GREASE-like brands, malformed and oversized values          | Synthetic structured-field values derived from public Client Hints formats; MIT original work.    |
| `tests/reduced-ua.test.ts`          | Chromium reduced version and platform placeholders                                     | Synthetic combinations based on public Chromium reduction behavior; MIT original work.            |
| `tests/ai-clients.test.ts`          | Search, AI-training, and user-triggered crawler categories                             | Synthetic product-token fixtures based on vendors' public crawler identifiers; MIT original work. |
| `tests/coverage.test.ts`            | Browser, engine, OS, device, CPU, crawler, CLI, and library rule matrix                | Independently assembled token combinations; no imported corpus; MIT original work.                |
| `tests/detection-features.test.ts`  | Email, media player, Electron, XR, wearable, helper, and Client Hints refinements      | Synthetic product-version combinations authored for UA Compass; MIT original work.                |
| `tests/security.test.ts`            | Limits, prototype isolation, malformed Unicode, rule validation, deterministic fuzzing | Generated or synthetic adversarial values; deterministic local generator; MIT original work.      |

## Public reference catalog

Accessed **2026-07-17**. These sources were used only to understand observable
formats and product behavior. No source text, executable code, regular
expressions, or fixture collections were imported.

| Owner / source                                                                                                                                                        | Purpose                                                                       | Incorporation and license treatment                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [RFC 9110: User-Agent](https://www.rfc-editor.org/rfc/rfc9110.html#name-user-agent)                                                                                   | HTTP `User-Agent` field semantics and product-token grammar.                  | Normative behavior reference only; no RFC text copied into rules or fixtures.               |
| [User-Agent Client Hints specification](https://wicg.github.io/ua-client-hints/)                                                                                      | Brand lists, mobile/platform fields, high-entropy hints, and GREASE behavior. | Format reference only; synthetic values authored locally.                                   |
| [Chrome User-Agent Client Hints](https://developer.chrome.com/docs/privacy-security/user-agent-client-hints)                                                          | Chromium hint delivery and reduced-UA migration behavior.                     | Product documentation reference only; no examples imported verbatim.                        |
| [Microsoft Edge UA guidance](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/user-agent-guidance)                                                       | Edge platform tokens and Client Hints behavior.                               | Product documentation reference only; synthetic versions and combinations authored locally. |
| [Microsoft Windows Client Hints guidance](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/how-to-detect-win11)                                          | Windows platform-version and architecture interpretation.                     | Behavior reference only; no sample implementation copied.                                   |
| [MDN User-Agent header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/User-Agent)                                                               | Cross-browser UA structure and limitations.                                   | Documentation reference only; no fixture list imported.                                     |
| [WebKit Safari 26 UA update](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)                                                                           | Safari reduced/frozen OS-version behavior.                                    | Product behavior reference only; locally composed fixtures.                                 |
| [Google crawler documentation](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers)                                                  | Googlebot product identifiers and crawler categories.                         | Identifier reference only; no crawler dataset imported.                                     |
| [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots)                                                                                           | GPTBot, OAI-SearchBot, and user-triggered agent roles.                        | Identifier and role reference only; no source material redistributed.                       |
| [Anthropic crawler documentation](https://support.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) | ClaudeBot and Claude-User roles.                                              | Identifier and role reference only; no source material redistributed.                       |
| [Electron `app.userAgentFallback`](https://www.electronjs.org/docs/latest/api/app#appuseragentfallback)                                                               | Electron's application-level User-Agent behavior.                             | API behavior reference only; synthetic Electron fixture authored locally.                   |

## Adding or importing material

Every future rule or fixture change must extend this record. For original
material, record the affected files, public behavior reference, authoring
method, and commit. For imported material, record all of the following before
merge:

- exact URL and source owner/author;
- access date and immutable version or revision when available;
- explicit license and evidence that MIT redistribution is allowed;
- exact files and fields imported;
- transformations performed;
- reviewer and approval decision.

If redistribution permission is unclear, omit the material. Never use another
parser's source, regex database, fixture corpus, comments, naming structure, or
rule ordering as an authoring source.
