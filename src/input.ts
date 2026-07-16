import { InputLimitError } from "./errors.js";
import {
  DEFAULT_MAX_USER_AGENT_LENGTH,
  MAX_CONFIGURED_USER_AGENT_LENGTH,
  MAX_HINT_BRANDS,
  MAX_HINT_STRING_LENGTH,
} from "./limits.js";
import type {
  ClientHintBrand,
  ClientHints,
  InputOverflowBehavior,
} from "./types.js";

export interface NormalizedParserOptions {
  readonly maxUserAgentLength: number;
  readonly overflowBehavior: InputOverflowBehavior;
}

export function normalizeParserOptions(
  options: Readonly<Record<string, unknown>>,
): NormalizedParserOptions {
  const configuredMaximum =
    options.maxUserAgentLength ?? DEFAULT_MAX_USER_AGENT_LENGTH;
  if (
    typeof configuredMaximum !== "number" ||
    !Number.isSafeInteger(configuredMaximum) ||
    configuredMaximum < 1 ||
    configuredMaximum > MAX_CONFIGURED_USER_AGENT_LENGTH
  ) {
    throw new RangeError(
      `maxUserAgentLength must be an integer from 1 to ${String(MAX_CONFIGURED_USER_AGENT_LENGTH)}`,
    );
  }

  const configuredOverflow = options.overflowBehavior ?? "throw";
  if (configuredOverflow !== "throw" && configuredOverflow !== "truncate") {
    throw new TypeError('overflowBehavior must be "throw" or "truncate"');
  }

  return Object.freeze({
    maxUserAgentLength: configuredMaximum,
    overflowBehavior: configuredOverflow,
  });
}

export function normalizeUserAgent(
  userAgent: unknown,
  options: NormalizedParserOptions,
): string {
  if (typeof userAgent !== "string") {
    throw new TypeError("userAgent must be a string");
  }

  let bounded = userAgent;
  if (bounded.length > options.maxUserAgentLength) {
    if (options.overflowBehavior === "throw") {
      throw new InputLimitError(bounded.length, options.maxUserAgentLength);
    }
    bounded = bounded.slice(0, options.maxUserAgentLength);
  }

  return replaceUnpairedSurrogates(bounded);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function replaceUnpairedSurrogates(value: string): string {
  let normalized = "";
  let lastCopyStart = 0;

  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    const isHigh = unit >= 0xd800 && unit <= 0xdbff;
    const isLow = unit >= 0xdc00 && unit <= 0xdfff;

    if (isHigh && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        index += 1;
        continue;
      }
    }

    if (isHigh || isLow) {
      normalized += value.slice(lastCopyStart, index) + "\uFFFD";
      lastCopyStart = index + 1;
    }
  }

  return normalized.length === 0
    ? value
    : normalized + value.slice(lastCopyStart);
}

export function normalizeClientHints(hints: unknown): ClientHints | undefined {
  if (hints === undefined) return undefined;
  if (!isRecord(hints)) {
    throw new TypeError("clientHints must be an object");
  }

  const normalized: {
    brands?: readonly ClientHintBrand[];
    fullVersionList?: readonly ClientHintBrand[];
    mobile?: boolean;
    platform?: string;
    platformVersion?: string;
    architecture?: string;
    bitness?: string;
    model?: string;
  } = {};

  if (hints.brands !== undefined)
    normalized.brands = normalizeBrands(hints.brands, "brands");
  if (hints.fullVersionList !== undefined) {
    normalized.fullVersionList = normalizeBrands(
      hints.fullVersionList,
      "fullVersionList",
    );
  }
  if (hints.mobile !== undefined) {
    if (typeof hints.mobile !== "boolean")
      throw new TypeError("clientHints.mobile must be boolean");
    normalized.mobile = hints.mobile;
  }

  for (const key of [
    "platform",
    "platformVersion",
    "architecture",
    "bitness",
    "model",
  ] as const) {
    const value = hints[key];
    if (value !== undefined) normalized[key] = normalizeHintString(value, key);
  }

  return Object.freeze(normalized);
}

export function getClientHints(options: unknown): ClientHints | undefined {
  if (options === undefined) return undefined;
  if (!isRecord(options)) {
    throw new TypeError("parse options must be an object");
  }
  return normalizeClientHints(options.clientHints);
}

function normalizeBrands(
  brands: unknown,
  key: string,
): readonly ClientHintBrand[] {
  if (!Array.isArray(brands) || brands.length > MAX_HINT_BRANDS) {
    throw new TypeError(
      `clientHints.${key} must contain at most ${String(MAX_HINT_BRANDS)} brands`,
    );
  }

  const items = brands as readonly unknown[];
  return Object.freeze(
    items.map((item, index): ClientHintBrand => {
      if (!isRecord(item)) {
        throw new TypeError(
          `clientHints.${key}[${String(index)}] must be an object`,
        );
      }
      return Object.freeze({
        brand: normalizeHintString(
          item.brand,
          `${key}[${String(index)}].brand`,
        ),
        version: normalizeHintString(
          item.version,
          `${key}[${String(index)}].version`,
        ),
      });
    }),
  );
}

function normalizeHintString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.length > MAX_HINT_STRING_LENGTH) {
    throw new TypeError(
      `clientHints.${key} must be a string of at most ${String(MAX_HINT_STRING_LENGTH)} characters`,
    );
  }
  return replaceUnpairedSurrogates(value);
}
