import { performance } from "node:perf_hooks";

const importStart = performance.now();
const { parse } = await import("ua-compass");
const importMilliseconds = performance.now() - importStart;

const parseStart = performance.now();
parse("curl/8.12.1");
const firstParseMilliseconds = performance.now() - parseStart;

process.stdout.write(
  JSON.stringify({ importMilliseconds, firstParseMilliseconds }),
);
