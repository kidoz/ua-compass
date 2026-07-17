import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { join } from "node:path";

// The CLI is a Node ESM script; these tests shell out to the built dist/cli.js.
// The public test scripts build first so this file also works in a clean clone.

const CLI = join(process.cwd(), "dist", "cli.js");

function runCli(
  args: readonly string[],
  input?: string,
): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", status: 0 };
  } catch (error) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      status?: number;
    };
    return {
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
      status: execError.status ?? 1,
    };
  }
}

describe("ua-compass CLI", () => {
  it("parses a User-Agent argument and prints JSON", () => {
    const { stdout, status } = runCli([
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
    ]);
    expect(status).toBe(0);
    const result = JSON.parse(stdout) as { browser: { name: string } };
    expect(result.browser.name).toBe("Chrome");
  });

  it("includes evidence when --evidence is passed", () => {
    const { stdout, status } = runCli([
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
      "--evidence",
    ]);
    expect(status).toBe(0);
    const result = JSON.parse(stdout) as {
      evidence?: { browser?: string };
    };
    expect(result.evidence?.browser).toBe("browser-chrome");
  });

  it("reads the User-Agent from stdin with --stdin", () => {
    const { stdout, status } = runCli(
      ["--stdin"],
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Mobile Safari/537.36",
    );
    expect(status).toBe(0);
    const result = JSON.parse(stdout) as { os: { name: string } };
    expect(result.os.name).toBe("Android");
  });

  it("rejects oversized stdin without buffering an unbounded pipe", () => {
    const { status, stderr } = runCli(["--stdin"], "A".repeat(100_000));
    expect(status).toBe(2);
    expect(stderr).toContain("exceeds limit 4096");
  });

  it("prints help and exits 0 with --help", () => {
    const { stdout, status } = runCli(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toContain("Usage:");
  });

  it("exits 1 when no argument and no --stdin is given", () => {
    const { status } = runCli([]);
    expect(status).toBe(1);
  });

  it("exits 1 for an unknown option", () => {
    const { status, stderr } = runCli(["--bogus"]);
    expect(status).toBe(1);
    expect(stderr).toContain("unknown option");
  });

  it('treats every argument after "--" as positional', () => {
    const { stdout, status } = runCli(["--", "--stdin"]);
    expect(status).toBe(0);
    const result = JSON.parse(stdout) as {
      ua: string;
      client: { type: string };
    };
    expect(result.ua).toBe("--stdin");
    expect(result.client.type).toBe("unknown");
  });
});
