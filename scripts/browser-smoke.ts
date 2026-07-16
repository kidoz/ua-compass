import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";

interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

const browserCandidates = [
  process.env.CHROME_BIN,
  process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined,
  process.platform === "darwin"
    ? "/Applications/Chromium.app/Contents/MacOS/Chromium"
    : undefined,
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
].filter((candidate): candidate is string => candidate !== undefined);

const contentTypes: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};
const browserSuccessMarker = 'data-ua-compass-smoke="passed"';

function run(
  command: string,
  arguments_: readonly string[],
  terminateWhenOutputIncludes?: string,
): Promise<CommandResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let expectedOutputSeen = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (
        !expectedOutputSeen &&
        terminateWhenOutputIncludes !== undefined &&
        stdout.includes(terminateWhenOutputIncludes)
      ) {
        expectedOutputSeen = true;
        child.kill();
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0 || expectedOutputSeen) resolvePromise({ stdout, stderr });
      else {
        reject(
          new Error(
            `${command} exited with ${String(code)}${stderr.length === 0 ? "" : `: ${stderr}`}`,
          ),
        );
      }
    });
  });
}

async function findBrowser(): Promise<string> {
  for (const candidate of browserCandidates) {
    try {
      await run(candidate, ["--version"]);
      return candidate;
    } catch {
      // Try the next explicit path or executable on PATH.
    }
  }
  throw new Error(
    "No Chrome or Chromium executable found; set CHROME_BIN to run the browser smoke test",
  );
}

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <script type="importmap">{"imports":{"ua-compass":"/dist/index.js"}}</script>
    <script type="module" src="/browser/runtime-tests/browser-entry.js"></script>
  </head>
  <body>UA Compass browser smoke</body>
</html>`;

const server = createServer((request, response) => {
  void (async (): Promise<void> => {
    const path = request.url?.split("?", 1)[0] ?? "/";
    if (path === "/") {
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
      });
      response.end(html);
      return;
    }

    const file = path.startsWith("/dist/")
      ? resolve(`.${path}`)
      : path.startsWith("/browser/")
        ? resolve(`.script-results${path}`)
        : undefined;
    const allowedRoot = path.startsWith("/dist/")
      ? resolve("dist")
      : resolve(".script-results/browser");
    if (!file?.startsWith(`${allowedRoot}/`)) {
      response.writeHead(404).end();
      return;
    }

    try {
      const body = await readFile(file);
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type":
          contentTypes[extname(file)] ?? "application/octet-stream",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  })().catch((error: unknown) => {
    response.writeHead(500).end(String(error));
  });
});

await new Promise<void>((resolvePromise, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolvePromise);
});

const address = server.address();
if (address === null || typeof address === "string") {
  server.close();
  throw new Error("Browser smoke server did not bind a TCP port");
}

const profile = resolve(tmpdir(), `ua-compass-chrome-${String(process.pid)}`);
try {
  const browser = await findBrowser();
  const flags = [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--user-data-dir=${profile}`,
    "--virtual-time-budget=5000",
    "--dump-dom",
  ];
  if (process.platform === "linux") flags.push("--no-sandbox");
  flags.push(`http://127.0.0.1:${String(address.port)}/`);
  const result = await run(browser, flags, browserSuccessMarker);
  if (!result.stdout.includes(browserSuccessMarker)) {
    throw new Error(
      `Browser smoke did not pass:\n${result.stdout}\n${result.stderr}`,
    );
  }
  process.stdout.write(`Browser smoke passed with ${browser}.\n`);
} finally {
  server.close();
  await rm(profile, { recursive: true, force: true });
}
