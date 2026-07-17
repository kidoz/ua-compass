# Architecture

UA Compass is an ESM-only, dependency-free TypeScript library. Its runtime is
deterministic, synchronous, stateless, and free of I/O. User-Agent strings,
Client Hints, raw headers, parser options, and custom rule packs are treated as
untrusted input.

## Runtime pipeline

```text
Public API
  -> input and option normalization
  -> custom-rule validation and copying
  -> rules compiled into target-specific buckets
  -> browser/client, engine, OS, device, and CPU detection
  -> Client Hints refinement
  -> null-prototype, deeply frozen ParseResult
```

The public entry point is `src/index.ts`. It exports the parser functions,
classification helpers, errors, limits, and public types. It does not perform
I/O or inspect the host environment during import.

## Module responsibilities

| Module                       | Responsibility                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/parser.ts`              | Public parser construction, default parser, and coordination.                                                                                            |
| `src/input.ts`               | User-Agent limits, malformed UTF-16 normalization, parser options, structured Client Hints, and the browser-side `clientHintsFromUserAgentData` adapter. |
| `src/client-hint-headers.ts` | Bounded, regex-free conversion of raw `Sec-CH-UA*` headers.                                                                                              |
| `src/rule-validation.ts`     | Runtime validation, limits, copying, and freezing of custom rules.                                                                                       |
| `src/bundled-rules.ts`       | Independently authored literal-token detection rules in precedence order.                                                                                |
| `src/detect.ts`              | Rule bucketing, matching, Client Hints refinement, Android model extraction, evidence capture, result normalization, and freezing.                       |
| `src/intent.ts`              | Advisory fetch-intent classification over `ParseResult`.                                                                                                 |
| `src/cli.ts`                 | Node CLI entry point (`bin`); reads argv/stdin, prints JSON. Built under its own tsconfig; not part of the importable library graph.                     |
| `src/guards.ts`              | Boolean classification helpers over `ParseResult` for client and device types.                                                                           |
| `src/types.ts`               | Public API contracts and declarative rule schema.                                                                                                        |
| `src/limits.ts`              | Security and resource ceilings shared by normalization and validation.                                                                                   |

## Rule execution and precedence

Rules are grouped once when a parser is created, preserving their original
order inside each target. Each category evaluates only its own bucket and uses
the first matching rule. Custom rules precede bundled rules, while duplicate
IDs—including collisions with bundled IDs—are rejected.

Rules use bounded literal `String.includes` checks. Caller-provided regular
expressions and executable callbacks are not supported. Version extraction is
also bounded and accepts only a restricted token alphabet.

Detection categories remain independent. A browser token does not by itself
invent an OS or device, and non-browser clients clear browser-specific output.
Recognized Client Hints refine lower-confidence UA evidence after UA matching:
mobile and model hints run first, then `Sec-CH-UA-Form-Factors` `"Watch"`,
`"XR"`, and `"Tablet"` tokens may promote a device from
`unknown`/`desktop`/`mobile` to `wearable`/`xr`/`tablet`. A concrete UA-derived
class (tablet, TV, console, wearable, XR) always wins over a Client Hint, so a
hint never overrides stronger evidence.

## Data and mutation boundaries

- Input strings are rejected or truncated at a configured limit and malformed
  UTF-16 surrogate code units are replaced deterministically.
- CLI stdin is byte-bounded before decoding and then passes through the same
  exact UTF-16 input limit as the library API.
- Public object inputs are read through own-property checks, preventing
  inherited values from altering configuration or results.
- Custom rules are validated, copied, and frozen before use; caller mutation
  after parser construction cannot change behavior.
- Result records use a null prototype, omit unknown optional fields, and are
  frozen at every public level.
- No shared mutable caches or per-request retained state exist.

## Packaging

TypeScript compiles `src/` into ESM under `dist/`. `package.json` exposes only
the root ESM entry point and generated declarations, declares `sideEffects` as
false, and publishes an explicit file allowlist. Tests and internal tooling are
excluded from the archive.

The release gates build from a clean `dist/`, inspect the archive, install the
exact tarball into a temporary ESM/TypeScript consumer, and execute the built
package in a real headless Chromium process.

## Extension boundary

The supported extension mechanism is `ParserOptions.customRulePacks`. Internal
detectors and compiled rule buckets are intentionally not package exports.
Rules must conform to the public schema and the limits documented in
[Rule authoring](rule-authoring.md).

## Non-goals

- Universal or authoritative client identification.
- Authentication based on User-Agent or bot classification.
- Executable, regex-based, or asynchronous custom detectors.
- I/O, telemetry, environment inspection, or mutable global caches in parsing.
- CommonJS packaging.
