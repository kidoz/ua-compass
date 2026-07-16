import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { optionValue, summarize, writeJson } from "./lib.js";

interface CompilerMeasurement {
  readonly totalMilliseconds: ReturnType<typeof summarize>;
  readonly checkMilliseconds: ReturnType<typeof summarize>;
  readonly memoryKilobytes: ReturnType<typeof summarize>;
}

const TRIALS = 5;
const compiler = resolve("node_modules/typescript/bin/tsc");

function extractMetric(output: string, label: string): number {
  const match = new RegExp(`^${label}:\\s+([0-9.]+)([A-Za-z]+)?$`, "mu").exec(
    output,
  );
  const value = match?.[1];
  if (value === undefined)
    throw new Error(`TypeScript diagnostics did not include ${label}`);
  return Number(value);
}

function measure(
  configuration: string,
  extraArguments: readonly string[],
): CompilerMeasurement {
  const totals: number[] = [];
  const checks: number[] = [];
  const memory: number[] = [];
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const output = execFileSync(
      process.execPath,
      [
        compiler,
        "-p",
        configuration,
        "--extendedDiagnostics",
        "--pretty",
        "false",
        ...extraArguments,
      ],
      { encoding: "utf8" },
    );
    totals.push(extractMetric(output, "Total time") * 1_000);
    checks.push(extractMetric(output, "Check time") * 1_000);
    memory.push(extractMetric(output, "Memory used"));
  }
  return {
    totalMilliseconds: summarize(totals),
    checkMilliseconds: summarize(checks),
    memoryKilobytes: summarize(memory),
  };
}

const report = {
  trials: TRIALS,
  checkOnly: measure("tsconfig.json", ["--noEmit"]),
  declarationBuild: measure("tsconfig.build.json", ["--incremental", "false"]),
};

await writeJson(optionValue("output"), report);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
