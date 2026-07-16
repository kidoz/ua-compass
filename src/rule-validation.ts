import { BUNDLED_RULES } from "./bundled-rules.js";
import { RuleValidationError } from "./errors.js";
import {
  MAX_RULE_PACKS,
  MAX_RULES_PER_PACK,
  MAX_RULE_STRING_LENGTH,
  MAX_RULE_TOKENS,
} from "./limits.js";
import { getOwnProperty } from "./own-property.js";
import type { DetectionRule, RuleResult } from "./types.js";

const CLIENT_TYPES: ReadonlySet<string> = new Set([
  "bot",
  "crawler",
  "ai-crawler",
  "ai-assistant",
  "cli",
  "library",
  "email",
  "mediaplayer",
  "embedded",
]);
const DEVICE_TYPES: ReadonlySet<string> = new Set([
  "desktop",
  "mobile",
  "tablet",
  "tv",
  "console",
  "wearable",
  "xr",
  "embedded",
  "unknown",
]);

export function validateRulePacks(packs: unknown): readonly DetectionRule[] {
  if (packs === undefined) return Object.freeze([]);
  const candidate: unknown = packs;
  if (!Array.isArray(candidate) || candidate.length > MAX_RULE_PACKS) {
    throw new RuleValidationError(
      `customRulePacks must contain at most ${String(MAX_RULE_PACKS)} packs`,
    );
  }

  const packValues = candidate as readonly unknown[];
  const rules: DetectionRule[] = [];
  // Seed with bundled ids so a custom rule cannot silently reuse a bundled id;
  // custom rules already win by ordering, so collisions are only confusing.
  const ids = new Set<string>(BUNDLED_RULES.map((rule): string => rule.id));
  for (let packIndex = 0; packIndex < packValues.length; packIndex += 1) {
    const pack = packValues[packIndex];
    if (!isRecord(pack)) throw invalid(packIndex, "must be an object");
    validateText(
      getOwnProperty(pack, "name"),
      `customRulePacks[${String(packIndex)}].name`,
    );
    const packRules = getOwnProperty(pack, "rules");
    if (!Array.isArray(packRules) || packRules.length > MAX_RULES_PER_PACK) {
      throw invalid(
        packIndex,
        `rules must contain at most ${String(MAX_RULES_PER_PACK)} entries`,
      );
    }
    const ruleValues = packRules as readonly unknown[];
    for (let ruleIndex = 0; ruleIndex < ruleValues.length; ruleIndex += 1) {
      const rule = validateRule(ruleValues[ruleIndex], packIndex, ruleIndex);
      if (ids.has(rule.id))
        throw invalid(packIndex, `contains duplicate rule id ${rule.id}`);
      ids.add(rule.id);
      rules.push(rule);
    }
  }

  return Object.freeze(rules);
}

function validateRule(
  value: unknown,
  packIndex: number,
  ruleIndex: number,
): DetectionRule {
  if (!isRecord(value))
    throw invalid(packIndex, `rules[${String(ruleIndex)}] must be an object`);
  const id = validateText(
    getOwnProperty(value, "id"),
    `rules[${String(ruleIndex)}].id`,
  );
  const match = getOwnProperty(value, "match");
  const allTokens = isRecord(match) ? getOwnProperty(match, "all") : undefined;
  if (!isRecord(match) || !Array.isArray(allTokens) || allTokens.length < 1) {
    throw invalid(
      packIndex,
      `rules[${String(ruleIndex)}].match.all must be a non-empty array`,
    );
  }
  if (allTokens.length > MAX_RULE_TOKENS) {
    throw invalid(
      packIndex,
      `rules[${String(ruleIndex)}].match.all has too many tokens`,
    );
  }
  const all = Object.freeze(
    allTokens.map((token, tokenIndex): string =>
      validateToken(
        token,
        `rules[${String(ruleIndex)}].match.all[${String(tokenIndex)}]`,
      ),
    ),
  );
  const none = validateOptionalTokens(
    getOwnProperty(match, "none"),
    packIndex,
    ruleIndex,
  );
  const result = validateResult(
    getOwnProperty(value, "result"),
    packIndex,
    ruleIndex,
  );
  const rawVersionPrefix = getOwnProperty(value, "versionPrefix");
  const versionPrefix =
    rawVersionPrefix === undefined
      ? undefined
      : validateToken(
          rawVersionPrefix,
          `rules[${String(ruleIndex)}].versionPrefix`,
        );

  return Object.freeze({
    id,
    match: Object.freeze(none === undefined ? { all } : { all, none }),
    result,
    ...(versionPrefix === undefined ? {} : { versionPrefix }),
  });
}

function validateOptionalTokens(
  value: unknown,
  packIndex: number,
  ruleIndex: number,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_RULE_TOKENS) {
    throw invalid(
      packIndex,
      `rules[${String(ruleIndex)}].match.none must be an array`,
    );
  }
  return Object.freeze(
    value.map((token, tokenIndex): string =>
      validateToken(
        token,
        `rules[${String(ruleIndex)}].match.none[${String(tokenIndex)}]`,
      ),
    ),
  );
}

function validateResult(
  value: unknown,
  packIndex: number,
  ruleIndex: number,
): RuleResult {
  const target = isRecord(value) ? getOwnProperty(value, "target") : undefined;
  if (!isRecord(value) || !isRuleTarget(target)) {
    throw invalid(
      packIndex,
      `rules[${String(ruleIndex)}].result has an invalid target`,
    );
  }

  const rawName = getOwnProperty(value, "name");
  const name =
    rawName === undefined ? undefined : validateText(rawName, "result.name");
  const rawVersion = getOwnProperty(value, "version");
  const version =
    rawVersion === undefined
      ? undefined
      : validateText(rawVersion, "result.version");
  const common = {
    ...(name === undefined ? {} : { name }),
    ...(version === undefined ? {} : { version }),
  };

  switch (target) {
    case "browser": {
      const clientType = getOwnProperty(value, "clientType");
      if (
        clientType !== undefined &&
        clientType !== "browser" &&
        clientType !== "webview"
      ) {
        throw invalid(
          packIndex,
          `rules[${String(ruleIndex)}].result.clientType is invalid`,
        );
      }
      return Object.freeze({
        target: "browser",
        ...common,
        ...(clientType === undefined ? {} : { clientType }),
      });
    }
    case "client": {
      const type = getOwnProperty(value, "type");
      if (typeof type !== "string" || !CLIENT_TYPES.has(type)) {
        throw invalid(
          packIndex,
          `rules[${String(ruleIndex)}].result.type is invalid`,
        );
      }
      return Object.freeze({
        target: "client",
        type,
        ...common,
      }) as RuleResult;
    }
    case "engine":
      return Object.freeze({ target: "engine", ...common });
    case "os":
      return Object.freeze({ target: "os", ...common });
    case "device": {
      const type = getOwnProperty(value, "type");
      if (typeof type !== "string" || !DEVICE_TYPES.has(type)) {
        throw invalid(
          packIndex,
          `rules[${String(ruleIndex)}].result.type is invalid`,
        );
      }
      const rawVendor = getOwnProperty(value, "vendor");
      const vendor =
        rawVendor === undefined
          ? undefined
          : validateText(rawVendor, "result.vendor");
      const rawModel = getOwnProperty(value, "model");
      const model =
        rawModel === undefined
          ? undefined
          : validateText(rawModel, "result.model");
      return Object.freeze({
        target: "device",
        type,
        ...(vendor === undefined ? {} : { vendor }),
        ...(model === undefined ? {} : { model }),
      }) as RuleResult;
    }
    case "cpu": {
      const architecture = validateText(
        getOwnProperty(value, "architecture"),
        "result.architecture",
      );
      const rawBitness = getOwnProperty(value, "bitness");
      const bitness =
        rawBitness === undefined
          ? undefined
          : validateText(rawBitness, "result.bitness");
      return Object.freeze({
        target: "cpu",
        architecture,
        ...(bitness === undefined ? {} : { bitness }),
      });
    }
  }
}

function isRuleTarget(value: unknown): value is RuleResult["target"] {
  return (
    value === "browser" ||
    value === "client" ||
    value === "engine" ||
    value === "os" ||
    value === "device" ||
    value === "cpu"
  );
}

function validateToken(value: unknown, path: string): string {
  const token = validateText(value, path);
  if (token.trim().length === 0)
    throw new RuleValidationError(`${path} must not be blank`);
  return token;
}

function validateText(value: unknown, path: string): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > MAX_RULE_STRING_LENGTH
  ) {
    throw new RuleValidationError(
      `${path} must be a string from 1 to ${String(MAX_RULE_STRING_LENGTH)} characters`,
    );
  }
  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(packIndex: number, message: string): RuleValidationError {
  return new RuleValidationError(
    `customRulePacks[${String(packIndex)}].${message}`,
  );
}
