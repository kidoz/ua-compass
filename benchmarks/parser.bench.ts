import { bench, describe } from "vitest";

import { createParser, parse } from "../dist/index.js";
import type { RulePack } from "../dist/index.js";

const BENCHMARK_OPTIONS = {
  iterations: 100,
  time: 500,
  warmupIterations: 25,
  warmupTime: 200,
} as const;

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36";
const FIREFOX_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0";
const SAFARI_MACOS =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const CURL = "curl/8.12.1";
const UNKNOWN = "ExampleClient/1.0 (unrecognized token set)";
const CORPUS = [
  CHROME_WINDOWS,
  FIREFOX_LINUX,
  SAFARI_MACOS,
  CURL,
  UNKNOWN,
] as const;

const customPack: RulePack = {
  name: "benchmark-pack",
  rules: Array.from({ length: 64 }, (_, index) => ({
    id: `benchmark-rule-${String(index)}`,
    match: { all: [`BenchmarkToken${String(index)}/`] },
    result: {
      target: "client" as const,
      type: "library" as const,
      name: "Benchmark Client",
    },
    versionPrefix: `BenchmarkToken${String(index)}/`,
  })),
};

let sink = 0;
let corpusIndex = 0;

function consume(value: string | undefined): void {
  sink = (sink + (value?.length ?? 0)) | 0;
}

describe("built parser runtime", () => {
  bench(
    "parse Chrome desktop",
    () => {
      consume(parse(CHROME_WINDOWS).browser.major);
    },
    BENCHMARK_OPTIONS,
  );

  bench(
    "parse rotating representative corpus",
    () => {
      const userAgent = CORPUS[corpusIndex % CORPUS.length] ?? UNKNOWN;
      corpusIndex += 1;
      consume(parse(userAgent).client.type);
    },
    BENCHMARK_OPTIONS,
  );

  bench(
    "parse with structured Client Hints",
    () => {
      const result = parse(CHROME_WINDOWS, {
        clientHints: {
          brands: [{ brand: "Google Chrome", version: "143" }],
          mobile: false,
          platform: "Windows",
          architecture: "x86",
          bitness: "64",
        },
      });
      consume(result.browser.major);
    },
    BENCHMARK_OPTIONS,
  );

  bench(
    "parse unknown client",
    () => {
      consume(parse(UNKNOWN).client.type);
    },
    BENCHMARK_OPTIONS,
  );

  bench(
    "create default parser",
    () => {
      consume(createParser().parse(CURL).client.name);
    },
    BENCHMARK_OPTIONS,
  );

  bench(
    "create parser with maximum-size rule pack",
    () => {
      consume(
        createParser({ customRulePacks: [customPack] }).parse(CURL).client.name,
      );
    },
    BENCHMARK_OPTIONS,
  );
});
