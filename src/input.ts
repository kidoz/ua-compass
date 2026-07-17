import { InputLimitError } from "./errors.js";
import {
  DEFAULT_MAX_USER_AGENT_LENGTH,
  MAX_CONFIGURED_USER_AGENT_LENGTH,
  MAX_HINT_BRANDS,
  MAX_HINT_FORM_FACTORS,
  MAX_HINT_STRING_LENGTH,
} from "./limits.js";
import { getOwnProperty } from "./own-property.js";
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
    getOwnProperty(options, "maxUserAgentLength") ??
    DEFAULT_MAX_USER_AGENT_LENGTH;
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

  const configuredOverflow =
    getOwnProperty(options, "overflowBehavior") ?? "throw";
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
    formFactors?: readonly string[];
  } = {};

  const brands = getOwnProperty(hints, "brands");
  if (brands !== undefined)
    normalized.brands = normalizeBrands(brands, "brands");
  const fullVersionList = getOwnProperty(hints, "fullVersionList");
  if (fullVersionList !== undefined) {
    normalized.fullVersionList = normalizeBrands(
      fullVersionList,
      "fullVersionList",
    );
  }
  const mobile = getOwnProperty(hints, "mobile");
  if (mobile !== undefined) {
    if (typeof mobile !== "boolean")
      throw new TypeError("clientHints.mobile must be boolean");
    normalized.mobile = mobile;
  }
  const formFactors = getOwnProperty(hints, "formFactors");
  if (formFactors !== undefined) {
    normalized.formFactors = normalizeFormFactors(formFactors);
  }

  for (const key of [
    "platform",
    "platformVersion",
    "architecture",
    "bitness",
    "model",
  ] as const) {
    const value = getOwnProperty(hints, key);
    if (value !== undefined) normalized[key] = normalizeHintString(value, key);
  }

  return Object.freeze(normalized);
}

export function getClientHints(options: unknown): ClientHints | undefined {
  if (options === undefined) return undefined;
  if (!isRecord(options)) {
    throw new TypeError("parse options must be an object");
  }
  return normalizeClientHints(getOwnProperty(options, "clientHints"));
}

// Converts a `navigator.userAgentData` object (the low-entropy fields) merged
// with any high-entropy values from `getHighEntropyValues()` into the structured
// `ClientHints` shape accepted by parse()/createParser(). The caller is
// responsible for reading the DOM and awaiting the high-entropy promise; this
// function stays DOM-free, stateless, and I/O-free so the core remains
// runtime-neutral. Field names already match the ClientHints shape, so this
// validates, copies own-properties, and freezes via the shared normalizer.
// Returns undefined when no own-properties survive (matching
// clientHintsFromHeaders) so a caller can branch on "were any hints provided".
export function clientHintsFromUserAgentData(
  userAgentData: unknown,
): ClientHints | undefined {
  const normalized = normalizeClientHints(userAgentData);
  if (normalized === undefined) return undefined;
  return Object.keys(normalized).length === 0 ? undefined : normalized;
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
      const brand = getOwnProperty(item, "brand");
      const version = getOwnProperty(item, "version");
      return Object.freeze({
        brand: normalizeHintString(brand, `${key}[${String(index)}].brand`),
        version: normalizeHintString(
          version,
          `${key}[${String(index)}].version`,
        ),
      });
    }),
  );
}

function normalizeFormFactors(formFactors: unknown): readonly string[] {
  if (
    !Array.isArray(formFactors) ||
    formFactors.length > MAX_HINT_FORM_FACTORS
  ) {
    throw new TypeError(
      `clientHints.formFactors must contain at most ${String(MAX_HINT_FORM_FACTORS)} items`,
    );
  }
  return Object.freeze(
    (formFactors as readonly unknown[]).map((item, index): string =>
      normalizeHintString(item, `formFactors[${String(index)}]`),
    ),
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
