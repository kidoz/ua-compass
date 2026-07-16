# UA Compass task runner.
# Recipes delegate to the package.json scripts so pnpm stays the single source
# of truth. Run `just` (or `just --list`) to see everything.

# Show available recipes.
default:
    @just --list

# Install dependencies with the pinned pnpm version.
[group('setup')]
install:
    pnpm install

# Compile the distributable build.
[group('build')]
build:
    pnpm build

# Format sources in place.
[group('quality')]
format:
    pnpm format

# Fail if any file is not formatted.
[group('quality')]
format-check:
    pnpm format:check

# Lint with ESLint.
[group('quality')]
lint:
    pnpm lint

# Type-check the library and test project without emitting.
[group('quality')]
typecheck:
    pnpm typecheck

# Run the unit tests (extra args pass through to vitest, e.g. `just test coverage.test.ts`).
[group('test')]
test *args:
    pnpm test {{ args }}

# Run the tests with V8 coverage.
[group('test')]
coverage:
    pnpm test:coverage

# Verify the generated public declarations with the pinned compiler.
[group('test')]
test-types:
    pnpm test:types

# Run the throughput benchmark.
[group('benchmark')]
benchmark:
    pnpm benchmark

# Fail if the benchmark regresses against the baseline.
[group('benchmark')]
benchmark-check:
    pnpm benchmark:check

# Run the vitest runtime microbenchmarks.
[group('benchmark')]
benchmark-runtime:
    pnpm benchmark:runtime

# Measure cold-start cost.
[group('benchmark')]
benchmark-cold:
    pnpm benchmark:cold

# Measure TypeScript build cost.
[group('benchmark')]
benchmark-types:
    pnpm benchmark:types

# Check the security benchmark against the baseline.
[group('benchmark')]
benchmark-security:
    pnpm benchmark:security

# Run the strict runtime regression benchmark.
[group('benchmark')]
benchmark-regression:
    pnpm benchmark:regression

# Dry-run the npm pack to preview published files.
[group('package')]
pack-check:
    pnpm pack:check

# Install the exact archive into a clean ESM and TypeScript consumer.
[group('package')]
pack-consumer:
    pnpm pack:consumer

# Verify dependency licenses against the project allowlist.
[group('package')]
licenses-check:
    pnpm licenses:check

# Audit production dependencies for known vulnerabilities.
[group('package')]
audit:
    pnpm audit --prod

# Fast pre-commit gate: formatting, lint, types, unit tests.
[group('aggregate')]
check: format-check lint typecheck test

# Full release gate: quality, coverage, build, packaging, and benchmarks.
[group('aggregate')]
verify: format-check lint typecheck test coverage test-types build pack-check audit licenses-check pack-consumer benchmark-check
