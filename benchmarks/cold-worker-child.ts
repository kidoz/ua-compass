import { parentPort } from "node:worker_threads";

import { parse } from "ua-compass";

parse("curl/8.12.1");
parentPort?.postMessage("ready");
