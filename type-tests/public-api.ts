import {
  clientHintsFromHeaders,
  createParser,
  isAiClient,
  isBot,
  parse,
} from "ua-compass";
import type { ClientHints, ParseResult, Parser, RulePack } from "ua-compass";

const hints: ClientHints = {
  brands: [{ brand: "Chromium", version: "143" }],
  mobile: false,
};
const pack: RulePack = {
  name: "consumer",
  rules: [
    {
      id: "consumer-client",
      match: { all: ["Consumer/"] },
      result: { target: "client", type: "library", name: "Consumer" },
    },
  ],
};
const parser: Parser = createParser({ customRulePacks: [pack] });
const result: ParseResult = parser.parse("Consumer/1", {
  clientHints: hints,
});
const headerHints: ClientHints | undefined = clientHintsFromHeaders({
  "sec-ch-ua": '"Chromium";v="143"',
});

parse("", { clientHints: headerHints });
isBot(result);
isAiClient(result);
