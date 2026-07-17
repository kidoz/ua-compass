import { BUNDLED_RULES } from "./bundled-rules.js";
import { compileRules, detect } from "./detect.js";
import type { CompiledRules } from "./detect.js";
import {
  getClientHints,
  normalizeParserOptions,
  normalizeUserAgent,
} from "./input.js";
import { getOwnProperty } from "./own-property.js";
import { validateRulePacks } from "./rule-validation.js";
import type {
  ParseOptions,
  ParseResult,
  Parser,
  ParserOptions,
} from "./types.js";

class CompassParser implements Parser {
  readonly #options: ReturnType<typeof normalizeParserOptions>;
  readonly #rules: CompiledRules;

  public constructor(options: unknown) {
    if (
      typeof options !== "object" ||
      options === null ||
      Array.isArray(options)
    ) {
      throw new TypeError("parser options must be an object");
    }
    const record = options as Readonly<Record<string, unknown>>;
    this.#options = normalizeParserOptions(record);
    const customRules = validateRulePacks(
      getOwnProperty(record, "customRulePacks"),
    );
    this.#rules = compileRules([...customRules, ...BUNDLED_RULES]);
  }

  public parse(userAgent: string, options?: ParseOptions): ParseResult {
    const normalizedUserAgent = normalizeUserAgent(userAgent, this.#options);
    const clientHints = getClientHints(options);
    return detect(
      normalizedUserAgent,
      clientHints,
      this.#rules,
      this.#options.evidence,
    );
  }
}

export function createParser(options?: ParserOptions): Parser;
export function createParser(options: unknown = {}): Parser {
  return Object.freeze(new CompassParser(options));
}

const defaultParser: Parser = createParser();

export function parse(userAgent: string, options?: ParseOptions): ParseResult {
  return defaultParser.parse(userAgent, options);
}
