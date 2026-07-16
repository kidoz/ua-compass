import { RuleValidationError } from "./errors.js";
import {
  MAX_RULE_PACKS,
  MAX_RULES_PER_PACK,
  MAX_RULE_STRING_LENGTH,
  MAX_RULE_TOKENS,
} from "./limits.js";
import type { DetectionRule, RuleResult } from "./types.js";

const CLIENT_TYPES: ReadonlySet<string> = new Set([
  "bot",
  "crawler",
  "ai-crawler",
  "ai-assistant",
  "cli",
  "library",
  "embedded",
]);
const DEVICE_TYPES: ReadonlySet<string> = new Set([
  "desktop",
  "mobile",
  "tablet",
  "tv",
  "console",
  "wearable",
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
  const ids = new Set<string>();
  for (let packIndex = 0; packIndex < packValues.length; packIndex += 1) {
    const pack = packValues[packIndex];
    if (!isRecord(pack)) throw invalid(packIndex, "must be an object");
    validateText(pack.name, `customRulePacks[${String(packIndex)}].name`);
    if (!Array.isArray(pack.rules) || pack.rules.length > MAX_RULES_PER_PACK) {
      throw invalid(
        packIndex,
        `rules must contain at most ${String(MAX_RULES_PER_PACK)} entries`,
      );
    }
    const ruleValues = pack.rules as readonly unknown[];
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
  const id = validateText(value.id, `rules[${String(ruleIndex)}].id`);
  const match = value.match;
  if (!isRecord(match) || !Array.isArray(match.all) || match.all.length < 1) {
    throw invalid(
      packIndex,
      `rules[${String(ruleIndex)}].match.all must be a non-empty array`,
    );
  }
  if (match.all.length > MAX_RULE_TOKENS) {
    throw invalid(
      packIndex,
      `rules[${String(ruleIndex)}].match.all has too many tokens`,
    );
  }
  const all = Object.freeze(
    match.all.map((token, tokenIndex): string =>
      validateToken(
        token,
        `rules[${String(ruleIndex)}].match.all[${String(tokenIndex)}]`,
      ),
    ),
  );
  const none = validateOptionalTokens(match.none, packIndex, ruleIndex);
  const result = validateResult(value.result, packIndex, ruleIndex);
  const versionPrefix =
    value.versionPrefix === undefined
      ? undefined
      : validateToken(
          value.versionPrefix,
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
  if (!isRecord(value) || !isRuleTarget(value.target)) {
    throw invalid(
      packIndex,
      `rules[${String(ruleIndex)}].result has an invalid target`,
    );
  }

  const name =
    value.name === undefined
      ? undefined
      : validateText(value.name, "result.name");
  const version =
    value.version === undefined
      ? undefined
      : validateText(value.version, "result.version");
  const common = {
    ...(name === undefined ? {} : { name }),
    ...(version === undefined ? {} : { version }),
  };

  switch (value.target) {
    case "browser": {
      const clientType = value.clientType;
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
      if (typeof value.type !== "string" || !CLIENT_TYPES.has(value.type)) {
        throw invalid(
          packIndex,
          `rules[${String(ruleIndex)}].result.type is invalid`,
        );
      }
      return Object.freeze({
        target: "client",
        type: value.type,
        ...common,
      }) as RuleResult;
    }
    case "engine":
      return Object.freeze({ target: "engine", ...common });
    case "os":
      return Object.freeze({ target: "os", ...common });
    case "device": {
      if (typeof value.type !== "string" || !DEVICE_TYPES.has(value.type)) {
        throw invalid(
          packIndex,
          `rules[${String(ruleIndex)}].result.type is invalid`,
        );
      }
      const vendor =
        value.vendor === undefined
          ? undefined
          : validateText(value.vendor, "result.vendor");
      const model =
        value.model === undefined
          ? undefined
          : validateText(value.model, "result.model");
      return Object.freeze({
        target: "device",
        type: value.type,
        ...(vendor === undefined ? {} : { vendor }),
        ...(model === undefined ? {} : { model }),
      }) as RuleResult;
    }
    case "cpu": {
      const architecture = validateText(
        value.architecture,
        "result.architecture",
      );
      const bitness =
        value.bitness === undefined
          ? undefined
          : validateText(value.bitness, "result.bitness");
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
