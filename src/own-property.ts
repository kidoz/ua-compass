export function getOwnProperty(
  value: Readonly<Record<string, unknown>>,
  key: string,
): unknown {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}
