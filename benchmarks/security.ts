import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

import { createParser, parse } from "ua-compass";
import type { ParseResult, RulePack } from "ua-compass";

import { optionValue, summarize, writeJson } from "./lib.js";
import type { Summary } from "./lib.js";

interface SecurityBaseline {
  readonly security: {
    readonly maximumP95Milliseconds: Readonly<Record<string, number>>;
  };
}

const BATCHES = 7;
let sink = 0;

function consume(value: ParseResult): void {
  sink = (sink + value.client.type.length + value.ua.length) | 0;
}

function measure(operation: () => ParseResult, iterations: number): Summary {
  for (let index = 0; index < 10; index += 1) consume(operation());
  const samples: number[] = [];
  for (let batch = 0; batch < BATCHES; batch += 1) {
    const start = performance.now();
    for (let iteration = 0; iteration < iterations; iteration += 1)
      consume(operation());
    samples.push((performance.now() - start) / iterations);
  }
  return summarize(samples);
}

const maximumRules: RulePack[] = Array.from({ length: 4 }, (_, packIndex) => ({
  name: `security-pack-${String(packIndex)}`,
  rules: Array.from({ length: 64 }, (_, ruleIndex) => ({
    id: `security-rule-${String(packIndex)}-${String(ruleIndex)}`,
    match: {
      all: [`AbsentToken${String(packIndex)}-${String(ruleIndex)}/`],
    },
    result: {
      target: "client" as const,
      type: "library" as const,
      name: "Security Benchmark",
    },
  })),
}));

const maximumParser = createParser({
  maxUserAgentLength: 65_536,
  customRulePacks: maximumRules,
});
const longInputParser = createParser({ maxUserAgentLength: 65_536 });
const longNearMiss = `${"Chrome".repeat(10_922)}!`.slice(0, 65_536);
const malformedUnicode = "\ud800".repeat(4_096);

const scenarios = {
  maximumLengthNearMiss: measure(() => longInputParser.parse(longNearMiss), 50),
  maximumRulePackNearMiss: measure(() => maximumParser.parse(longNearMiss), 25),
  malformedUnicode: measure(() => parse(malformedUnicode), 100),
};

const report = { batches: BATCHES, scenarios };
const baseline = JSON.parse(
  await readFile("benchmarks/baseline.json", "utf8"),
) as SecurityBaseline;
const violations: string[] = [];

for (const [name, measurement] of Object.entries(scenarios)) {
  const maximum = baseline.security.maximumP95Milliseconds[name];
  if (maximum === undefined)
    throw new Error(`Missing security benchmark limit for ${name}`);
  if (measurement.p95 > maximum) {
    violations.push(
      `${name} p95 ${measurement.p95.toFixed(3)} ms exceeds ${String(maximum)} ms`,
    );
  }
}

await writeJson(optionValue("output"), report);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (process.argv.includes("--check") && violations.length > 0) {
  throw new Error(
    `Security benchmark limits failed:\n${violations.join("\n")}`,
  );
}
