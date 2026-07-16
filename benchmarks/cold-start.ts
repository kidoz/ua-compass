import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { Worker } from "node:worker_threads";

import { optionValue, summarize, writeJson } from "./lib.js";

interface ColdMeasurement {
  readonly importMilliseconds: number;
  readonly firstParseMilliseconds: number;
}

const TRIALS = 15;
const imports: number[] = [];
const firstParses: number[] = [];
const workerStartupImportAndParse: number[] = [];

function measureWorker(): Promise<number> {
  const start = performance.now();
  return new Promise<number>((resolveMeasurement, reject) => {
    const worker = new Worker(
      new URL("./cold-worker-child.js", import.meta.url),
    );
    worker.once("message", () => {
      const duration = performance.now() - start;
      void worker.terminate();
      resolveMeasurement(duration);
    });
    worker.once("error", reject);
  });
}

for (let trial = 0; trial < TRIALS; trial += 1) {
  const output = execFileSync(
    process.execPath,
    [new URL("./cold-child.js", import.meta.url).pathname],
    { encoding: "utf8" },
  );
  const measurement = JSON.parse(output) as ColdMeasurement;
  imports.push(measurement.importMilliseconds);
  firstParses.push(measurement.firstParseMilliseconds);
  workerStartupImportAndParse.push(await measureWorker());
}

const report = {
  trials: TRIALS,
  importMilliseconds: summarize(imports),
  firstParseMilliseconds: summarize(firstParses),
  workerStartupImportAndParseMilliseconds: summarize(
    workerStartupImportAndParse,
  ),
};

await writeJson(optionValue("output"), report);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
