import { describe, expect, it } from "vitest";

import { createParser, parse } from "../src/index.js";

// Fixtures below are independently composed from public UA token formats with
// synthetic versions; they are not copied from another parser's corpus.

describe("evidence (matched rule-id tracing)", () => {
  it("is omitted by default", () => {
    const result = parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
    );
    expect(result).not.toHaveProperty("evidence");
  });

  it("captures the matched bundled rule id per category when enabled", () => {
    const parser = createParser({ evidence: true });
    const result = parser.parse(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.120 Safari/537.36",
    );
    expect(result.evidence).toEqual({
      browser: "browser-chrome",
      engine: "engine-blink",
      os: "os-windows",
      device: "device-desktop",
      cpu: "cpu-win64",
    });
    // No `client` rule matched because the browser rule set the client.
    expect(result.evidence).not.toHaveProperty("client");
    expect(Object.isFrozen(result.evidence)).toBe(true);
  });

  it("captures a custom rule id when it matches", () => {
    const parser = createParser({
      evidence: true,
      customRulePacks: [
        {
          name: "internal",
          rules: [
            {
              id: "acme-monitor",
              match: { all: ["AcmeMonitor/"] },
              result: { target: "client", type: "bot", name: "Acme Monitor" },
              versionPrefix: "AcmeMonitor/",
            },
          ],
        },
      ],
    });
    const result = parser.parse("AcmeMonitor/1.2");
    expect(result.evidence?.client).toBe("acme-monitor");
  });

  it("records a crawler client rule instead of a browser rule", () => {
    const result = parse(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      // The default parser has evidence off; rebuild with it on.
    );
    expect(result).not.toHaveProperty("evidence");

    const parser = createParser({ evidence: true });
    const withEvidence = parser.parse(
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    );
    expect(withEvidence.evidence?.client).toBe("client-googlebot");
    // A non-browser client suppresses browser detection, so no browser rule id.
    expect(withEvidence.evidence).not.toHaveProperty("browser");
  });

  it("rejects a non-boolean evidence option", () => {
    expect(() => createParser({ evidence: "yes" as never })).toThrow(
      "evidence must be boolean",
    );
  });
});
