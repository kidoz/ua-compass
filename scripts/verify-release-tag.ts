import { readFile } from "node:fs/promises";

interface PackageMetadata {
  readonly version?: unknown;
}

const packageMetadata = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
) as PackageMetadata;
const version = packageMetadata.version;
if (typeof version !== "string" || version.length === 0) {
  throw new TypeError("package.json must contain a non-empty version string");
}

const referenceType = process.env.GITHUB_REF_TYPE;
const referenceName = process.env.GITHUB_REF_NAME;
const expectedTag = `v${version}`;
if (referenceType !== "tag" || referenceName !== expectedTag) {
  throw new Error(
    `release ref must be tag ${expectedTag}; received ${referenceType ?? "unknown"} ${referenceName ?? "unknown"}`,
  );
}

process.stdout.write(`Verified release tag ${expectedTag}.\n`);
