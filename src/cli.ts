#!/usr/bin/env node
// Minimal, dependency-free CLI: parse a User-Agent string to JSON.
// Reads the UA from argv (first positional) or stdin (--stdin / piped input).
// No network, no config files, no environment inspection beyond argv/stdin.

import {
  DEFAULT_MAX_USER_AGENT_LENGTH,
  InputLimitError,
  createParser,
} from "./index.js";

// A UTF-8 scalar uses at most three bytes per UTF-16 code unit. Permit a final
// CRLF that is removed before parsing, but stop buffering well before an
// untrusted pipe can consume meaningful memory. Anything buffered past this
// cap is guaranteed to decode to more code units than the parser accepts, so
// the parser stays the single authority for the limit and its error message.
const MAX_STDIN_BYTES = DEFAULT_MAX_USER_AGENT_LENGTH * 3 + 2;

const HELP = `Usage: ua-compass <user-agent> [options]
       echo "<user-agent>" | ua-compass --stdin

Parse a User-Agent string and print the structured result as JSON.

Options:
  <user-agent>   The User-Agent string to parse (first positional argument).
  --stdin        Read the User-Agent string from stdin instead of argv.
  --evidence     Include matched rule ids (the evidence field).
  --             End of options; later arguments are positional (for a
                 User-Agent that starts with "-").
  --help, -h     Show this help.

Exit codes: 0 success, 1 usage error, 2 input exceeds length limit.`;

interface CliOptions {
  readonly stdin: boolean;
  readonly evidence: boolean;
  readonly help: boolean;
  readonly positional: readonly string[];
}

function parseArgs(argv: readonly string[]): CliOptions {
  const positional: string[] = [];
  let stdin = false;
  let evidence = false;
  let help = false;
  let optionsEnded = false;
  for (const argument of argv) {
    if (optionsEnded) positional.push(argument);
    else if (argument === "--") optionsEnded = true;
    else if (argument === "--stdin") stdin = true;
    else if (argument === "--evidence") evidence = true;
    else if (argument === "--help" || argument === "-h") help = true;
    else if (argument.startsWith("--")) {
      throw new UsageError(`unknown option: ${argument}`);
    } else positional.push(argument);
  }
  if (positional.length > 1) {
    throw new UsageError("only one positional User-Agent argument is allowed");
  }
  return { stdin, evidence, help, positional };
}

class UsageError extends Error {
  public override readonly name = "UsageError" as const;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = chunk as Buffer;
    totalBytes += buffer.byteLength;
    chunks.push(buffer);
    // Stop consuming the pipe once the buffered bytes already guarantee an
    // over-limit decoded length; the parser then reports the real length of
    // exactly what was read instead of a number synthesized here. Breaking
    // out of for-await destroys the stream, so stdin cannot keep buffering.
    if (totalBytes > MAX_STDIN_BYTES) break;
  }
  return Buffer.concat(chunks)
    .toString("utf8")
    .replace(/\r?\n$/, "");
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }

  let userAgent: string;
  if (options.stdin) {
    userAgent = await readStdin();
  } else if (options.positional.length === 1) {
    userAgent = options.positional[0] ?? "";
  } else {
    process.stderr.write(`${HELP}\n`);
    return 1;
  }

  const parser = createParser({ evidence: options.evidence });
  const result = parser.parse(userAgent);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
}

// Set process.exitCode instead of calling process.exit: piped stdout writes
// are asynchronous, and an immediate exit could truncate the JSON mid-write.
main()
  .then((status: number) => {
    process.exitCode = status;
  })
  .catch((error: unknown) => {
    if (error instanceof UsageError) {
      process.stderr.write(`error: ${error.message}\n\n${HELP}\n`);
      process.exitCode = 1;
    } else if (error instanceof InputLimitError) {
      process.stderr.write(`error: ${error.message}\n`);
      process.exitCode = 2;
    } else {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`error: ${message}\n`);
      process.exitCode = 1;
    }
  });
