import { execFileSync } from "node:child_process";

const PRODUCTION_LICENSES: ReadonlySet<string> = new Set([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
]);
const TOOLCHAIN_LICENSES: ReadonlySet<string> = new Set([
  ...PRODUCTION_LICENSES,
  "BlueOak-1.0.0",
  "MPL-2.0",
]);

function licenseGroups(arguments_: readonly string[]): readonly string[] {
  const output = execFileSync(
    "pnpm",
    ["licenses", "list", ...arguments_, "--json"],
    { encoding: "utf8" },
  ).trim();
  if (output === "No licenses in packages found") return [];
  const parsed: unknown = JSON.parse(output);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("pnpm returned an invalid license report");
  }
  return Object.keys(parsed);
}

function rejectUnexpected(
  scope: string,
  licenses: readonly string[],
  allowed: ReadonlySet<string>,
): void {
  const unexpected = licenses.filter(
    (license): boolean => !allowed.has(license),
  );
  if (unexpected.length > 0) {
    throw new Error(
      `${scope} dependencies contain unapproved licenses: ${unexpected.join(", ")}`,
    );
  }
}

rejectUnexpected("Production", licenseGroups(["--prod"]), PRODUCTION_LICENSES);
rejectUnexpected("Development", licenseGroups([]), TOOLCHAIN_LICENSES);
process.stdout.write("Dependency licenses are approved.\n");
