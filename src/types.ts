export type ClientType =
  | "browser"
  | "webview"
  | "bot"
  | "crawler"
  | "ai-crawler"
  | "ai-assistant"
  | "cli"
  | "library"
  | "embedded"
  | "unknown";

export type DeviceType =
  | "desktop"
  | "mobile"
  | "tablet"
  | "tv"
  | "console"
  | "wearable"
  | "embedded"
  | "unknown";

export interface BrowserInfo {
  readonly name?: string;
  readonly version?: string;
  readonly major?: string;
}

export interface EngineInfo {
  readonly name?: string;
  readonly version?: string;
}

export interface OperatingSystemInfo {
  readonly name?: string;
  readonly version?: string;
}

export interface DeviceInfo {
  readonly type: DeviceType;
  readonly vendor?: string;
  readonly model?: string;
}

export interface CpuInfo {
  readonly architecture?: string;
  readonly bitness?: string;
}

export interface ClientInfo {
  readonly type: ClientType;
  readonly name?: string;
  readonly version?: string;
}

export interface ParseResult {
  readonly ua: string;
  readonly uaReduced: boolean;
  readonly browser: BrowserInfo;
  readonly engine: EngineInfo;
  readonly os: OperatingSystemInfo;
  readonly device: DeviceInfo;
  readonly cpu: CpuInfo;
  readonly client: ClientInfo;
}

export interface ClientHintBrand {
  readonly brand: string;
  readonly version: string;
}

export interface ClientHints {
  readonly brands?: readonly ClientHintBrand[];
  readonly fullVersionList?: readonly ClientHintBrand[];
  readonly mobile?: boolean;
  readonly platform?: string;
  readonly platformVersion?: string;
  readonly architecture?: string;
  readonly bitness?: string;
  readonly model?: string;
}

export interface ParseOptions {
  readonly clientHints?: ClientHints | undefined;
}

export type InputOverflowBehavior = "throw" | "truncate";

export interface RuleMatch {
  readonly all: readonly string[];
  readonly none?: readonly string[];
}

interface BaseRuleResult {
  readonly name?: string;
  readonly version?: string;
}

export interface BrowserRuleResult extends BaseRuleResult {
  readonly target: "browser";
  readonly clientType?: "browser" | "webview";
}

export interface ClientRuleResult extends BaseRuleResult {
  readonly target: "client";
  readonly type: Exclude<ClientType, "browser" | "webview" | "unknown">;
}

export interface EngineRuleResult extends BaseRuleResult {
  readonly target: "engine";
}

export interface OperatingSystemRuleResult extends BaseRuleResult {
  readonly target: "os";
}

export interface DeviceRuleResult {
  readonly target: "device";
  readonly type: DeviceType;
  readonly vendor?: string;
  readonly model?: string;
}

export interface CpuRuleResult {
  readonly target: "cpu";
  readonly architecture: string;
  readonly bitness?: string;
}

export type RuleResult =
  | BrowserRuleResult
  | ClientRuleResult
  | EngineRuleResult
  | OperatingSystemRuleResult
  | DeviceRuleResult
  | CpuRuleResult;

export interface DetectionRule {
  readonly id: string;
  readonly match: RuleMatch;
  readonly result: RuleResult;
  readonly versionPrefix?: string;
}

export interface RulePack {
  readonly name: string;
  readonly rules: readonly DetectionRule[];
}

export interface ParserOptions {
  readonly maxUserAgentLength?: number;
  readonly overflowBehavior?: InputOverflowBehavior;
  readonly customRulePacks?: readonly RulePack[];
}

export interface Parser {
  parse(userAgent: string, options?: ParseOptions): ParseResult;
}
