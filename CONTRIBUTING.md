# Contributing to UA Compass

Thanks for your interest in UA Compass — a secure, MIT-licensed User-Agent
parser for modern TypeScript. This guide covers the workflow and the quality
gates every change must pass.

## Original work and licensing

All contributions must be your own original work and redistributable under the
MIT License:

- Do not copy code, regular expressions, detection data, or fixtures from
  incompatibly licensed sources.
- Build detection rules and fixtures independently from public browser/vendor
  documentation, standards, and independently collected User-Agent samples.
- New runtime or dev dependencies must use permissive, MIT-compatible licenses
  (`pnpm licenses:check` enforces this).

## Development setup

UA Compass uses [pnpm](https://pnpm.io) (pinned via Corepack) and targets
Node.js 24+.

```sh
corepack enable
pnpm install
```

## Making a change

1. Open an issue to discuss substantial changes before sending a pull request.
2. Branch from `main`.
3. Write tests alongside the implementation, not afterward.
4. Keep the parser deterministic, stateless, and free of I/O and DOM access.
5. Preserve the security posture: literal-token matching only (no dynamic
   regular expressions), bounded input, immutable results, validated rule
   packs.
6. Run the full gate suite locally (below) before opening the PR.

### Adding detection rules

- Detection rules are declarative literal-token rules in `src/bundled-rules.ts`.
- Put specific signatures before generic fallbacks; document meaningful
  precedence with tests.
- Return `unknown` rather than guessing; keep browser/client, engine, OS,
  device, and CPU evidence independent.
- Add positive, negative, ambiguous, malformed, and precedence test cases with
  independently authored fixtures.
- Follow [Rule authoring](docs/rule-authoring.md) and update
  [Fixture and source provenance](docs/fixture-provenance.md). Only include
  token data or samples that are redistributable under the MIT License.

## Quality gates

Every change must pass the same gates CI runs:

```sh
pnpm format:check   # Prettier
pnpm lint           # ESLint
pnpm typecheck      # strict TypeScript (src, tests, scripts)
pnpm test           # Vitest unit/integration tests
pnpm test:coverage  # coverage floors: 95% stmt/line/func, 90% branch
pnpm test:types     # generated declarations in a clean TS consumer
pnpm test:browser   # built ESM package in real headless Chromium
pnpm build          # ESM build with declarations
pnpm licenses:check # MIT-compatible dependency licenses
pnpm benchmark:check # package-size and performance baselines
pnpm pack:consumer  # installs the packed archive into a clean ESM+TS consumer
```

Do not lower coverage thresholds, skip hostile-input tests, or weaken security
checks to get a green result. Fix the underlying issue instead.

## Commit and pull-request conventions

- Keep commits focused and their messages descriptive.
- Describe what changed and why in the PR, and note any new provenance records.
- Update `CHANGELOG.md`, and the README when public behavior changes.

## Security

Please do not open public issues for vulnerabilities. Follow the private
disclosure process in [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
