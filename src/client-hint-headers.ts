import {
  MAX_HINT_BRANDS,
  MAX_HINT_FORM_FACTORS,
  MAX_HINT_HEADER_LENGTH,
  MAX_HINT_STRING_LENGTH,
} from "./limits.js";
import { getOwnProperty } from "./own-property.js";
import type { ClientHintBrand, ClientHints } from "./types.js";

// Normalizes raw `Sec-CH-UA*` request headers into the structured ClientHints
// shape accepted by parse()/createParser(). Header values arrive from the
// wire and are treated as hostile: parsing is linear-time, regex-free, and
// bounded, and malformed or oversized components are dropped rather than
// thrown so a hostile header cannot make a server error out.
export function clientHintsFromHeaders(
  headers: Readonly<Record<string, unknown>>,
): ClientHints | undefined {
  const candidate: unknown = headers;
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    throw new TypeError("headers must be an object");
  }
  const source = candidate as Readonly<Record<string, unknown>>;

  const hints: {
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

  const brands = parseBrandList(readHeader(source, "sec-ch-ua", "Sec-CH-UA"));
  if (brands !== undefined) hints.brands = brands;
  const fullVersionList = parseBrandList(
    readHeader(
      source,
      "sec-ch-ua-full-version-list",
      "Sec-CH-UA-Full-Version-List",
    ),
  );
  if (fullVersionList !== undefined) hints.fullVersionList = fullVersionList;

  const mobile = readHeader(source, "sec-ch-ua-mobile", "Sec-CH-UA-Mobile");
  if (mobile === "?1") hints.mobile = true;
  else if (mobile === "?0") hints.mobile = false;

  const platform = parseQuotedValue(
    readHeader(source, "sec-ch-ua-platform", "Sec-CH-UA-Platform"),
  );
  if (platform !== undefined) hints.platform = platform;
  const platformVersion = parseQuotedValue(
    readHeader(
      source,
      "sec-ch-ua-platform-version",
      "Sec-CH-UA-Platform-Version",
    ),
  );
  if (platformVersion !== undefined) hints.platformVersion = platformVersion;
  const architecture = parseQuotedValue(
    readHeader(source, "sec-ch-ua-arch", "Sec-CH-UA-Arch"),
  );
  if (architecture !== undefined) hints.architecture = architecture;
  const bitness = parseQuotedValue(
    readHeader(source, "sec-ch-ua-bitness", "Sec-CH-UA-Bitness"),
  );
  if (bitness !== undefined) hints.bitness = bitness;
  const model = parseQuotedValue(
    readHeader(source, "sec-ch-ua-model", "Sec-CH-UA-Model"),
  );
  if (model !== undefined) hints.model = model;

  const formFactors = parseFormFactors(
    readHeader(source, "sec-ch-ua-form-factors", "Sec-CH-UA-Form-Factors"),
  );
  if (formFactors !== undefined) hints.formFactors = formFactors;

  return Object.keys(hints).length === 0 ? undefined : Object.freeze(hints);
}

function readHeader(
  source: Readonly<Record<string, unknown>>,
  lowerName: string,
  canonicalName: string,
): string | undefined {
  const value =
    getOwnProperty(source, lowerName) ?? getOwnProperty(source, canonicalName);
  const list: readonly unknown[] | undefined = Array.isArray(value)
    ? value
    : undefined;
  const single = list === undefined ? value : list[0];
  if (typeof single !== "string" || single.length > MAX_HINT_HEADER_LENGTH) {
    return undefined;
  }
  return single;
}

function parseQuotedValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  const unquoted = trimmed.startsWith('"')
    ? readQuotedString(trimmed, 0)?.value
    : trimmed;
  if (
    unquoted === undefined ||
    unquoted.length === 0 ||
    unquoted.length > MAX_HINT_STRING_LENGTH
  ) {
    return undefined;
  }
  return unquoted;
}

// Parses a structured-field item list of the form `Watch, Mobile` (bare tokens)
// or `"Watch", "Mobile"` (quoted tokens). WICG form-factor tokens are
// case-sensitive ASCII words; unknown tokens are dropped (the spec may add
// values over time), but a structurally malformed or oversized list drops the
// whole header so a hostile value cannot smuggle a class change or error out.
function parseFormFactors(
  value: string | undefined,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  const items: string[] = [];
  for (const raw of trimmed.split(",")) {
    const token = raw.trim();
    if (token.length === 0) continue;
    // A quoted item must be well-formed; any quoting error drops the header.
    const resolved = token.startsWith('"')
      ? readQuotedString(token, 0)?.value
      : token;
    if (resolved === undefined) return undefined;
    if (
      resolved.length === 0 ||
      resolved.length > MAX_HINT_STRING_LENGTH ||
      !isFormFactorToken(resolved)
    ) {
      // A single non-conformant item invalidates the structured-field list.
      return undefined;
    }
    items.push(resolved);
    if (items.length > MAX_HINT_FORM_FACTORS) return undefined;
  }
  return items.length === 0 ? undefined : Object.freeze(items);
}

// Form-factor values are ASCII-letter words (WICG uses tokens such as `Watch`,
// `XR`, `EInk`). Restricting the grammar to letters rejects quoted strings,
// parameters, separators, and digits from a malformed structured-field list;
// case-sensitivity is enforced later by exact-match in detection, so a
// lowercased `watch` is carried through but never matches a recognized class.
function isFormFactorToken(value: string): boolean {
  if (value.length === 0) return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const isUpperLetter = code >= 65 && code <= 90;
    const isLowerLetter = code >= 97 && code <= 122;
    if (!isUpperLetter && !isLowerLetter) return false;
  }
  return true;
}

// Parses a structured-field list of the form `"Brand";v="1", "Other";v="2"`,
// tracking quoting so brand names containing separators cannot desynchronize
// the scan. Returns undefined when the list is malformed or empty.
function parseBrandList(
  value: string | undefined,
): readonly ClientHintBrand[] | undefined {
  if (value === undefined) return undefined;
  const brands: ClientHintBrand[] = [];
  let index = 0;
  while (index < value.length && brands.length < MAX_HINT_BRANDS) {
    while (isSeparator(value.charAt(index))) index += 1;
    if (index >= value.length) break;
    const brand = readQuotedString(value, index);
    if (brand === undefined) return undefined;
    index = brand.end;

    let version = "";
    while (index < value.length && value.charAt(index) !== ",") {
      if (value.charAt(index) !== ";") {
        index += 1;
        continue;
      }
      index += 1;
      while (value.charAt(index) === " ") index += 1;
      let key = "";
      while (
        index < value.length &&
        !"=;,".includes(value.charAt(index)) &&
        key.length <= MAX_HINT_STRING_LENGTH
      ) {
        key += value.charAt(index);
        index += 1;
      }
      if (value.charAt(index) !== "=") continue;
      index += 1;
      if (value.charAt(index) === '"') {
        const parameter = readQuotedString(value, index);
        if (parameter === undefined) return undefined;
        if (key === "v") version = parameter.value;
        index = parameter.end;
      } else {
        let token = "";
        while (index < value.length && !";,".includes(value.charAt(index))) {
          token += value.charAt(index);
          index += 1;
        }
        if (key === "v") version = token.trim();
      }
    }

    if (
      brand.value.length > 0 &&
      brand.value.length <= MAX_HINT_STRING_LENGTH &&
      version.length <= MAX_HINT_STRING_LENGTH
    ) {
      brands.push(Object.freeze({ brand: brand.value, version }));
    }
  }
  return brands.length === 0 ? undefined : Object.freeze(brands);
}

function isSeparator(char: string): boolean {
  return char === " " || char === "," || char === "\t";
}

interface QuotedRead {
  readonly value: string;
  readonly end: number;
}

function readQuotedString(
  input: string,
  start: number,
): QuotedRead | undefined {
  if (input.charAt(start) !== '"') return undefined;
  let value = "";
  let index = start + 1;
  while (index < input.length) {
    const char = input.charAt(index);
    if (char === "\\") {
      const escaped = input.charAt(index + 1);
      if (escaped === "") return undefined;
      value += escaped;
      index += 2;
      continue;
    }
    if (char === '"') return { value, end: index + 1 };
    value += char;
    index += 1;
  }
  return undefined;
}
