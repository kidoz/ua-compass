import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";

import type { Summary } from "./lib.js";

interface Baseline {
  readonly recordedPackedBytes: number;
  readonly maximumPackedBytes: number;
  readonly runtime: Readonly<
    Record<string, { readonly medianMilliseconds: number }>
  >;
  readonly coldStart: {
    readonly importMedianMilliseconds: number;
    readonly firstParseMedianMilliseconds: number;
    readonly workerStartupImportAndParseMedianMilliseconds: number;
  };
  readonly typescript: {
    readonly checkOnlyTotalMedianMilliseconds: number;
    readonly declarationBuildTotalMedianMilliseconds: number;
    readonly checkOnlyMemoryMedianKilobytes: number;
    readonly declarationBuildMemoryMedianKilobytes: number;
  };
  readonly security: {
    readonly recordedP95Milliseconds: Readonly<Record<string, number>>;
  };
  readonly policy: {
    readonly strictRuntimeMaximumRatio: number;
  };
}

interface RuntimeBenchmark {
  readonly name: string;
  readonly median: number;
  readonly p99: number;
  readonly rme: number;
  readonly sampleCount: number;
}

interface RuntimeReport {
  readonly files: readonly {
    readonly groups: readonly {
      readonly benchmarks: readonly RuntimeBenchmark[];
    }[];
  }[];
}

interface ColdStartReport {
  readonly trials: number;
  readonly importMilliseconds: Summary;
  readonly firstParseMilliseconds: Summary;
  readonly workerStartupImportAndParseMilliseconds: Summary;
}

interface TypeScriptReport {
  readonly trials: number;
  readonly checkOnly: {
    readonly totalMilliseconds: Summary;
    readonly checkMilliseconds: Summary;
    readonly memoryKilobytes: Summary;
  };
  readonly declarationBuild: {
    readonly totalMilliseconds: Summary;
    readonly checkMilliseconds: Summary;
    readonly memoryKilobytes: Summary;
  };
}

interface SecurityReport {
  readonly batches: number;
  readonly scenarios: Readonly<Record<string, Summary>>;
}

interface Comparison {
  readonly current: number;
  readonly recorded: number;
  readonly ratio: number;
}

interface RuntimeComparison {
  readonly medianMilliseconds: number;
  readonly recordedMedianMilliseconds: number;
  readonly ratio: number;
  readonly p99Milliseconds: number;
  readonly relativeMarginOfErrorPercent: number;
  readonly samples: number;
}

const resultsDirectory = resolve(".benchmark-results");
await mkdir(resultsDirectory, { recursive: true });

const check = process.argv.includes("--check");
const strictRuntime = process.argv.includes("--strict-runtime");

function run(
  script: string,
  output: string,
  extraArguments: readonly string[] = [],
): void {
  execFileSync(
    process.execPath,
    [
      new URL(script, import.meta.url).pathname,
      `--output=${resolve(resultsDirectory, output)}`,
      ...extraArguments,
    ],
    { stdio: "inherit" },
  );
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function measurePackedBytes(): Promise<number> {
  const packageDirectory = await mkdtemp(join(resultsDirectory, "package-"));
  try {
    execFileSync("pnpm", ["pack", "--pack-destination", packageDirectory], {
      stdio: "pipe",
    });
    const archive = (await readdir(packageDirectory)).find((entry): boolean =>
      entry.endsWith(".tgz"),
    );
    if (archive === undefined)
      throw new Error("pnpm pack did not create an archive");
    return (await stat(join(packageDirectory, archive))).size;
  } finally {
    await rm(packageDirectory, { recursive: true, force: true });
  }
}

execFileSync(
  process.execPath,
  [
    resolve("node_modules/vitest/vitest.mjs"),
    "bench",
    `--outputJson=${resolve(resultsDirectory, "runtime.json")}`,
  ],
  { stdio: "inherit" },
);
run("./cold-start.js", "cold-start.json");
run("./typescript.js", "typescript.json");
run("./security.js", "security.json", check ? ["--check"] : []);

const baseline = await readJson<Baseline>(resolve("benchmarks/baseline.json"));
const runtime = await readJson<RuntimeReport>(
  resolve(resultsDirectory, "runtime.json"),
);
const coldStart = await readJson<ColdStartReport>(
  resolve(resultsDirectory, "cold-start.json"),
);
const typescript = await readJson<TypeScriptReport>(
  resolve(resultsDirectory, "typescript.json"),
);
const security = await readJson<SecurityReport>(
  resolve(resultsDirectory, "security.json"),
);
const packedBytes = await measurePackedBytes();

function comparison(current: number, recorded: number): Comparison {
  return { current, recorded, ratio: current / recorded };
}

const runtimeComparisons: Record<string, RuntimeComparison> = {};
for (const file of runtime.files) {
  for (const group of file.groups) {
    for (const benchmark of group.benchmarks) {
      const recorded = baseline.runtime[benchmark.name];
      if (recorded === undefined)
        throw new Error(`Missing runtime baseline for ${benchmark.name}`);
      runtimeComparisons[benchmark.name] = {
        medianMilliseconds: benchmark.median,
        recordedMedianMilliseconds: recorded.medianMilliseconds,
        ratio: benchmark.median / recorded.medianMilliseconds,
        p99Milliseconds: benchmark.p99,
        relativeMarginOfErrorPercent: benchmark.rme,
        samples: benchmark.sampleCount,
      };
    }
  }
}

const securityComparisons = Object.fromEntries(
  Object.entries(security.scenarios).map(([name, measurement]) => {
    const recorded = baseline.security.recordedP95Milliseconds[name];
    if (recorded === undefined)
      throw new Error(`Missing recorded security benchmark for ${name}`);
    return [name, comparison(measurement.p95, recorded)];
  }),
);

const summary = {
  generatedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
  packageSize: {
    bytes: packedBytes,
    recordedBytes: baseline.recordedPackedBytes,
    maximumBytes: baseline.maximumPackedBytes,
    ratioToRecorded: packedBytes / baseline.recordedPackedBytes,
  },
  runtime: runtimeComparisons,
  coldStart: {
    measurements: coldStart,
    comparisons: {
      importMedianMilliseconds: comparison(
        coldStart.importMilliseconds.median,
        baseline.coldStart.importMedianMilliseconds,
      ),
      firstParseMedianMilliseconds: comparison(
        coldStart.firstParseMilliseconds.median,
        baseline.coldStart.firstParseMedianMilliseconds,
      ),
      workerStartupImportAndParseMedianMilliseconds: comparison(
        coldStart.workerStartupImportAndParseMilliseconds.median,
        baseline.coldStart.workerStartupImportAndParseMedianMilliseconds,
      ),
    },
  },
  typescript: {
    measurements: typescript,
    comparisons: {
      checkOnlyTotalMedianMilliseconds: comparison(
        typescript.checkOnly.totalMilliseconds.median,
        baseline.typescript.checkOnlyTotalMedianMilliseconds,
      ),
      declarationBuildTotalMedianMilliseconds: comparison(
        typescript.declarationBuild.totalMilliseconds.median,
        baseline.typescript.declarationBuildTotalMedianMilliseconds,
      ),
      checkOnlyMemoryMedianKilobytes: comparison(
        typescript.checkOnly.memoryKilobytes.median,
        baseline.typescript.checkOnlyMemoryMedianKilobytes,
      ),
      declarationBuildMemoryMedianKilobytes: comparison(
        typescript.declarationBuild.memoryKilobytes.median,
        baseline.typescript.declarationBuildMemoryMedianKilobytes,
      ),
    },
  },
  security: {
    measurements: security,
    comparisons: securityComparisons,
  },
};

const summaryPath = resolve(resultsDirectory, "summary.json");
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`Benchmark summary written to ${summaryPath}\n`);

if (check && packedBytes > baseline.maximumPackedBytes) {
  throw new Error(
    `Packed archive size ${String(packedBytes)} bytes exceeds ${String(baseline.maximumPackedBytes)} bytes`,
  );
}

if (strictRuntime) {
  const regressions = Object.entries(runtimeComparisons)
    .filter(
      ([, result]) => result.ratio > baseline.policy.strictRuntimeMaximumRatio,
    )
    .map(([name, result]) => `${name}: ${result.ratio.toFixed(2)}x baseline`);
  if (regressions.length > 0) {
    throw new Error(
      `Runtime benchmark regressions:\n${regressions.join("\n")}`,
    );
  }
}
