import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const temporaryDirectory = await mkdtemp(
  join(tmpdir(), "ua-compass-consumer-"),
);
const packageDirectory = join(temporaryDirectory, "package");
const consumerDirectory = join(temporaryDirectory, "consumer");
const outputArgument = process.argv.find((argument): boolean =>
  argument.startsWith("--output="),
);

try {
  await mkdir(packageDirectory);
  await mkdir(consumerDirectory);
  execFileSync("pnpm", ["pack", "--pack-destination", packageDirectory], {
    stdio: "pipe",
  });
  const archiveName = (await readdir(packageDirectory)).find((entry): boolean =>
    entry.endsWith(".tgz"),
  );
  if (archiveName === undefined) {
    throw new Error("pnpm pack created no archive");
  }
  const archive = join(packageDirectory, archiveName);

  execFileSync("pnpm", ["--dir", consumerDirectory, "add", archive], {
    stdio: "pipe",
  });
  await writeFile(
    join(consumerDirectory, "consumer.mts"),
    `import { createParser, parse } from "ua-compass";
import type { ParseResult, Parser } from "ua-compass";
const parser: Parser = createParser();
const result: ParseResult = parser.parse("curl/8.12.1");
parse(result.ua);
`,
  );
  await writeFile(
    join(consumerDirectory, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
        },
        include: ["consumer.mts"],
      },
      null,
      2,
    )}\n`,
  );

  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { createParser, parse } from "ua-compass";
const parsed = createParser().parse("curl/8.12.1");
if (parsed.client.name !== "curl" || parse("").client.type !== "unknown") {
  throw new Error("Packed runtime exports returned unexpected results");
}`,
    ],
    { cwd: consumerDirectory, stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [
      resolve("node_modules/typescript/bin/tsc"),
      "-p",
      join(consumerDirectory, "tsconfig.json"),
    ],
    { stdio: "inherit" },
  );

  if (outputArgument !== undefined) {
    const output = resolve(outputArgument.slice("--output=".length));
    await mkdir(dirname(output), { recursive: true });
    await copyFile(archive, output);
  }
  const archiveSize = (await stat(archive)).size;
  process.stdout.write(
    `Packed consumer passed for ${archiveName} (${String(archiveSize)} bytes).\n`,
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
