# Rule authoring

UA Compass rules are original, declarative, bounded literal-token rules. Do not
copy or mechanically adapt another parser's source, regular expressions, rule
database, fixture corpus, comments, naming, or ordering.

Before adding a token or fixture, read
[Fixture and source provenance](fixture-provenance.md) and record enough
evidence for a reviewer to reproduce the clean-room decision.

## Rule schema

```ts
import type { RulePack } from "ua-compass";

const pack: RulePack = {
  name: "internal-clients",
  rules: [
    {
      id: "internal-acme-monitor",
      match: { all: ["AcmeMonitor/"], none: ["AcmeMonitor-Test/"] },
      result: { target: "client", type: "bot", name: "Acme Monitor" },
      versionPrefix: "AcmeMonitor/",
    },
  ],
};
```

- `id` is stable and unique across custom and bundled rules.
- `match.all` is required and every token must occur.
- `match.none` is optional and prevents a match when any token occurs.
- `versionPrefix` extracts a bounded version token following that literal.
- `result.target` selects exactly one output category.

Supported result targets are `browser`, `client`, `engine`, `os`, `device`, and
`cpu`. Client results may use `bot`, `crawler`, `ai-crawler`, `ai-assistant`,
`cli`, `library`, `email`, `mediaplayer`, or `embedded`. Device results may use
`desktop`, `mobile`, `tablet`, `tv`, `console`, `wearable`, `xr`, `embedded`, or
`unknown`.

## Security limits

A parser accepts at most:

- 4 custom packs;
- 64 rules per pack;
- 4 literals in each `all` or `none` list;
- 128 UTF-16 code units in every textual rule field.

Text must be non-empty, match literals must not be blank, and rule IDs must not
collide. Rules are copied and frozen when `createParser()` is called. Dynamic
regular expressions, callbacks, and unbounded token lists are deliberately
unsupported.

## Ordering and evidence

Bundled rules are first-match-wins within a target. Put a specific signature
before a generic compatibility token. For example, a vendor browser token must
precede a generic `Chrome/` fallback when both can occur in one UA.

Only infer fields justified by the evidence:

- A browser token does not automatically prove an operating system or device.
- A crawler or library should populate `client`, leaving `browser` empty.
- Unknown values should remain absent or `unknown`; do not invent versions,
  models, vendors, or architectures.
- Client Hints may refine UA evidence, but disagreement must not produce an
  impossible combination.

## Required tests

Add independently authored fixtures alongside every rule change:

1. a positive match with version extraction where applicable;
2. a negative or near-miss case;
3. a precedence case when signatures overlap;
4. malformed or boundary input when a new shape is introduced;
5. an immutable-result assertion for any new result category.

Record the fixture's authorship, source category, and redistribution basis in
[Fixture and source provenance](fixture-provenance.md). Imported fixture text is
not permitted unless its license explicitly allows MIT redistribution and the
record identifies the exact source, author, license, access date, modifications,
and files using it.

Run at least:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm benchmark:security
```

Rule-set changes must also pass `pnpm benchmark:check`, license validation, and
the packed-consumer gate before release.
