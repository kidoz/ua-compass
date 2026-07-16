import { writeFile } from "node:fs/promises";

export interface Summary {
  readonly minimum: number;
  readonly median: number;
  readonly p95: number;
  readonly maximum: number;
  readonly mean: number;
  readonly samples: number;
}

export function percentile(
  values: readonly number[],
  fraction: number,
): number {
  if (values.length === 0) throw new Error("Cannot summarize an empty sample");
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil(sorted.length * fraction) - 1,
  );
  const value = sorted[index];
  if (value === undefined) throw new Error("Percentile index was out of range");
  return value;
}

export function summarize(values: readonly number[]): Summary {
  if (values.length === 0) throw new Error("Cannot summarize an empty sample");
  const mean =
    values.reduce((total, value) => total + value, 0) / values.length;
  return {
    minimum: Math.min(...values),
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    maximum: Math.max(...values),
    mean,
    samples: values.length,
  };
}

export function optionValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
}

export async function writeJson(
  path: string | undefined,
  value: unknown,
): Promise<void> {
  if (path === undefined) return;
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
