import { describe, expect, it } from "vitest";

import { RuleValidationError, createParser, parse } from "../src/index.js";
import type { DetectionRule, RulePack, RuleResult } from "../src/index.js";

function unsafePack(rule: unknown): readonly RulePack[] {
  return [{ name: "test", rules: [rule as DetectionRule] }];
}

describe("security boundaries", () => {
  it.each([
    [null, "must be an object"],
    [
      {
        id: "x",
        match: { all: [] },
        result: { target: "cpu", architecture: "x" },
      },
      "non-empty",
    ],
    [
      {
        id: "x",
        match: { all: [""] },
        result: { target: "cpu", architecture: "x" },
      },
      "from 1",
    ],
    [
      {
        id: "x",
        match: { all: ["   "] },
        result: { target: "cpu", architecture: "x" },
      },
      "blank",
    ],
    [
      {
        id: "x",
        match: { all: ["x"], none: "x" },
        result: { target: "cpu", architecture: "x" },
      },
      "must be an array",
    ],
    [
      { id: "x", match: { all: ["x"] }, result: { target: "invalid" } },
      "invalid target",
    ],
    [
      {
        id: "x",
        match: { all: ["x"] },
        result: { target: "client", type: "browser" },
      },
      "type is invalid",
    ],
    [
      {
        id: "x",
        match: { all: ["x"] },
        result: { target: "device", type: "spaceship" },
      },
      "type is invalid",
    ],
    [
      {
        id: "x",
        match: { all: ["x"] },
        result: { target: "browser", clientType: "bot" },
      },
      "clientType is invalid",
    ],
  ])("rejects malformed custom rule %#", (rule, message) => {
    expect(() => createParser({ customRulePacks: unsafePack(rule) })).toThrow(
      message,
    );
  });

  it("rejects duplicate ids, excessive token counts, rules, and long fields", () => {
    const valid: DetectionRule = {
      id: "same",
      match: { all: ["x"] },
      result: { target: "engine", name: "X" },
    };
    expect(() =>
      createParser({ customRulePacks: [{ name: "x", rules: [valid, valid] }] }),
    ).toThrow("duplicate");
    expect(() =>
      createParser({
        customRulePacks: unsafePack({
          ...valid,
          match: { all: ["1", "2", "3", "4", "5"] },
        }),
      }),
    ).toThrow("too many tokens");
    expect(() =>
      createParser({
        customRulePacks: [{ name: "x", rules: new Array(65).fill(valid) }],
      }),
    ).toThrow("at most 64");
    expect(() =>
      createParser({ customRulePacks: [{ name: "x".repeat(129), rules: [] }] }),
    ).toThrow(RuleValidationError);
  });

  it.each<RuleResult>([
    { target: "browser", name: "Custom", version: "1", clientType: "webview" },
    { target: "client", name: "Custom", version: "1", type: "embedded" },
    { target: "engine", name: "Custom", version: "1" },
    { target: "os", name: "Custom", version: "1" },
    { target: "device", type: "wearable", vendor: "Acme", model: "Watch" },
    { target: "cpu", architecture: "custom", bitness: "16" },
  ])("accepts and executes bounded result target $target", (result) => {
    const parser = createParser({
      customRulePacks: [
        {
          name: "targets",
          rules: [
            {
              id: `target-${result.target}`,
              match: { all: ["target"] },
              result,
            },
          ],
        },
      ],
    });
    expect(
      parser.parse("target")[result.target === "os" ? "os" : result.target],
    ).toBeDefined();
  });

  it("rejects malformed Client Hints", () => {
    expect(() => parse("x", { clientHints: null as never })).toThrow(
      "must be an object",
    );
    expect(() =>
      parse("x", {
        clientHints: {
          brands: new Array(17).fill({ brand: "x", version: "1" }),
        },
      }),
    ).toThrow("at most 16");
    expect(() =>
      parse("x", { clientHints: { brands: [null as never] } }),
    ).toThrow("must be an object");
    expect(() =>
      parse("x", {
        clientHints: { brands: [{ brand: "x".repeat(257), version: "1" }] },
      }),
    ).toThrow("at most 256");
    expect(() =>
      parse("x", { clientHints: { mobile: "yes" as never } }),
    ).toThrow("must be boolean");
    expect(() => parse("x", null as never)).toThrow(
      "parse options must be an object",
    );
  });

  it("ignores inherited parser and parse options", () => {
    const inheritedRulePacks = {
      customRulePacks: [
        {
          name: "inherited",
          rules: [
            {
              id: "inherited-client",
              match: { all: ["InheritedClient/"] },
              result: {
                target: "client",
                type: "bot",
                name: "Inherited",
              },
            },
          ],
        },
      ],
      maxUserAgentLength: 1,
      overflowBehavior: "truncate",
    };
    const parser = createParser(
      Object.create(inheritedRulePacks) as Record<string, never>,
    );
    expect(parser.parse("InheritedClient/1").client).toEqual({
      type: "unknown",
    });
    expect(parser.parse("curl/8").ua).toBe("curl/8");

    const parseOptions = Object.create({
      clientHints: { platform: "Windows" },
    }) as Record<string, never>;
    expect(parse("", parseOptions).os).toEqual({});
  });

  it("ignores inherited hint fields and rejects inherited rule structure", () => {
    const clientHints = Object.create({
      platform: "Windows",
      mobile: true,
    }) as unknown as { readonly platform?: string; readonly mobile?: boolean };
    expect(parse("", { clientHints }).os).toEqual({});
    expect(parse("", { clientHints }).device).toEqual({ type: "unknown" });

    const inheritedRule = Object.create({
      id: "inherited",
      match: { all: ["x"] },
      result: { target: "client", type: "bot" },
    }) as unknown as DetectionRule;
    expect(() =>
      createParser({
        customRulePacks: [{ name: "inherited", rules: [inheritedRule] }],
      }),
    ).toThrow(RuleValidationError);
  });

  it("maintains invariants across deterministic fuzz input", () => {
    let state = 0x1234abcd;
    for (let sample = 0; sample < 1_000; sample += 1) {
      let value = "";
      const length = sample % 257;
      for (let index = 0; index < length; index += 1) {
        state = (Math.imul(state, 1_664_525) + 1_013_904_223) | 0;
        value += String.fromCharCode(state & 0xffff);
      }
      const result = parse(value);
      expect(result.ua.length).toBeLessThanOrEqual(length);
      expect(Object.isFrozen(result)).toBe(true);
      expect([
        "browser",
        "webview",
        "bot",
        "crawler",
        "cli",
        "library",
        "embedded",
        "unknown",
      ]).toContain(result.client.type);
    }
  });

  it("handles hostile near-misses with bounded literal matching", () => {
    const parser = createParser({ maxUserAgentLength: 65_536 });
    const hostile = `${"Chrome".repeat(10_000)}!`;
    expect(parser.parse(hostile).browser).toEqual({});
  });
});
