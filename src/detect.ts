import type {
  BrowserInfo,
  ClientHints,
  ClientInfo,
  CpuInfo,
  DetectionRule,
  DeviceInfo,
  EngineInfo,
  OperatingSystemInfo,
  ParseResult,
  RuleResult,
} from "./types.js";

interface MutableDetection {
  browser: BrowserInfo;
  engine: EngineInfo;
  os: OperatingSystemInfo;
  device: DeviceInfo;
  cpu: CpuInfo;
  client: ClientInfo;
}

// Rules bucketed by target so each detection pass scans only its own target's
// candidates (in original precedence order) rather than the whole rule list.
export type CompiledRules = Readonly<
  Partial<Record<RuleResult["target"], readonly DetectionRule[]>>
>;

export function compileRules(rules: readonly DetectionRule[]): CompiledRules {
  const buckets: Partial<Record<RuleResult["target"], DetectionRule[]>> =
    Object.create(null) as Partial<
      Record<RuleResult["target"], DetectionRule[]>
    >;
  for (const rule of rules) {
    const target = rule.result.target;
    (buckets[target] ??= []).push(rule);
  }
  for (const key of Object.keys(buckets)) {
    Object.freeze(buckets[key as RuleResult["target"]]);
  }
  return Object.freeze(buckets);
}

export function detect(
  userAgent: string,
  clientHints: ClientHints | undefined,
  rules: CompiledRules,
): ParseResult {
  const detection: MutableDetection = {
    browser: compact<BrowserInfo>({}),
    engine: compact<EngineInfo>({}),
    os: compact<OperatingSystemInfo>({}),
    device: compact<DeviceInfo>({ type: "unknown" }),
    cpu: compact<CpuInfo>({}),
    client: compact<ClientInfo>({ type: "unknown" }),
  };
  const uaReduced = isReducedUserAgent(userAgent);

  applyFirstRule("client", userAgent, rules, detection);
  if (detection.client.type === "unknown")
    applyFirstRule("browser", userAgent, rules, detection);
  applyFirstRule("engine", userAgent, rules, detection);
  applyFirstRule("os", userAgent, rules, detection);
  applyFirstRule("device", userAgent, rules, detection);
  applyFirstRule("cpu", userAgent, rules, detection);
  if (uaReduced) scrubReducedArtifacts(detection);
  applyClientHints(clientHints, detection);

  if (
    detection.client.type !== "unknown" &&
    detection.client.type !== "browser" &&
    detection.client.type !== "webview"
  ) {
    detection.browser = compact<BrowserInfo>({});
  }

  return freezeResult(userAgent, uaReduced, detection);
}

// Chromium froze the minor.build.patch version segments to "0.0.0" and the
// platform tokens to static values during User-Agent reduction, so a Chromium
// version with a ".0.0.0" tail marks a reduced UA whose platform details are
// placeholders rather than facts.
const REDUCED_VERSION_SUFFIX = ".0.0.0";
const REDUCED_MACOS_VERSION = "10.15.7";

function isReducedUserAgent(userAgent: string): boolean {
  const chromeVersion = extractVersion(userAgent, "Chrome/");
  return chromeVersion?.endsWith(REDUCED_VERSION_SUFFIX) ?? false;
}

function scrubReducedArtifacts(detection: MutableDetection): void {
  const browserMajor = reducedVersionMajor(detection.browser.version);
  if (browserMajor !== undefined) {
    detection.browser = compact<BrowserInfo>({
      name: detection.browser.name,
      version: browserMajor,
      major: browserMajor,
    });
  }
  const clientMajor = reducedVersionMajor(detection.client.version);
  if (clientMajor !== undefined) {
    detection.client = compact<ClientInfo>({
      type: detection.client.type,
      name: detection.client.name,
      version: clientMajor,
    });
  }

  const os = detection.os;
  if (
    (os.name === "Android" && os.version === "10") ||
    (os.name === "macOS" && os.version === REDUCED_MACOS_VERSION) ||
    (os.name === "Windows" && os.version === "10.0")
  ) {
    detection.os = compact<OperatingSystemInfo>({ name: os.name });
  }
}

function reducedVersionMajor(version: string | undefined): string | undefined {
  if (!version?.endsWith(REDUCED_VERSION_SUFFIX)) {
    return undefined;
  }
  const major = version.slice(
    0,
    version.length - REDUCED_VERSION_SUFFIX.length,
  );
  return major.length === 0 ? undefined : major;
}

function applyFirstRule(
  target: RuleResult["target"],
  userAgent: string,
  rules: CompiledRules,
  detection: MutableDetection,
): void {
  const candidates = rules[target];
  if (candidates === undefined) return;
  for (const candidate of candidates) {
    if (!matches(userAgent, candidate)) continue;
    applyRuleResult(candidate, userAgent, detection);
    return;
  }
}

function matches(userAgent: string, rule: DetectionRule): boolean {
  for (const token of rule.match.all)
    if (!userAgent.includes(token)) return false;
  if (rule.match.none !== undefined) {
    for (const token of rule.match.none)
      if (userAgent.includes(token)) return false;
  }
  return true;
}

function applyRuleResult(
  rule: DetectionRule,
  userAgent: string,
  detection: MutableDetection,
): void {
  const extractedVersion =
    rule.versionPrefix === undefined
      ? undefined
      : extractVersion(userAgent, rule.versionPrefix);
  const result = rule.result;
  const version =
    extractedVersion ?? ("version" in result ? result.version : undefined);

  switch (result.target) {
    case "browser": {
      detection.browser = versionedInfo(result.name, version);
      detection.client = compact<ClientInfo>({
        type: result.clientType ?? "browser",
        name: result.name,
        version,
      });
      return;
    }
    case "client":
      detection.client = compact<ClientInfo>({
        type: result.type,
        name: result.name,
        version,
      });
      return;
    case "engine":
      detection.engine = compact<EngineInfo>({ name: result.name, version });
      return;
    case "os":
      detection.os = compact<OperatingSystemInfo>({
        name: result.name,
        version: normalizeOsVersion(version),
      });
      return;
    case "device":
      detection.device = compact<DeviceInfo>({
        type: result.type,
        vendor: result.vendor,
        model: result.model,
      });
      return;
    case "cpu":
      detection.cpu = compact<CpuInfo>({
        architecture: result.architecture,
        bitness: result.bitness,
      });
  }
}

function applyClientHints(
  hints: ClientHints | undefined,
  detection: MutableDetection,
): void {
  if (hints === undefined) return;
  const brands = hints.fullVersionList ?? hints.brands;
  const browser = selectBrowserBrand(brands);
  if (
    browser !== undefined &&
    (detection.client.type === "unknown" || detection.client.type === "browser")
  ) {
    detection.browser = versionedInfo(browser.name, browser.version);
    detection.client = compact<ClientInfo>({
      type: "browser",
      name: browser.name,
      version: browser.version,
    });
  }

  const platform = normalizePlatform(hints.platform);
  if (platform !== undefined) {
    // A low-entropy platform hint often arrives without a platform version.
    // When the hint agrees with the UA-derived OS, keep the real UA version
    // rather than discarding it for an empty one.
    const hintVersion = osVersionFromHints(platform, hints.platformVersion);
    detection.os = compact<OperatingSystemInfo>({
      name: platform,
      version:
        hintVersion ??
        (detection.os.name === platform ? detection.os.version : undefined),
    });
  }

  if (hints.mobile !== undefined) {
    // Sec-CH-UA-Mobile is a UX-preference boolean (WICG ua-client-hints), not a
    // hardware-class assertion: ?1 means "prefers a mobile experience" and is
    // sent by both phones and watches; ?0 means "prefers a non-mobile
    // experience" and does NOT prove desktop hardware. So promote to mobile only
    // from unknown/desktop, and demote a contradicting mobile to unknown (never
    // assert desktop). iOS Safari and Firefox do not send this hint, so a
    // UA-derived iPhone/mobile class is never clobbered by it.
    const current = detection.device.type;
    const type = hints.mobile
      ? current === "unknown" || current === "desktop"
        ? "mobile"
        : current
      : current === "mobile"
        ? "unknown"
        : current;
    detection.device = compact<DeviceInfo>({
      type,
      vendor: detection.device.vendor,
      model:
        hints.model === ""
          ? detection.device.model
          : (hints.model ?? detection.device.model),
    });
  } else if (hints.model !== undefined && hints.model !== "") {
    detection.device = compact<DeviceInfo>({
      ...detection.device,
      model: hints.model,
    });
  }

  if (hints.architecture !== undefined && hints.architecture !== "") {
    detection.cpu = compact<CpuInfo>({
      architecture: normalizeArchitecture(hints.architecture, hints.bitness),
      bitness: hints.bitness,
    });
  } else if (hints.bitness !== undefined && hints.bitness !== "") {
    // A bitness-only hint still refines the UA CPU evidence; keep any
    // UA-derived architecture and apply the reported bitness.
    detection.cpu = compact<CpuInfo>({
      architecture: detection.cpu.architecture,
      bitness: hints.bitness,
    });
  }
}

// Brand lists are an unordered, GREASE-protected set: user agents must inject
// an arbitrary brand with randomized ordering, so ordering carries no meaning
// and GREASE entries must be filtered before selection.
const SPECIFIC_BRAND_MAPPINGS = [
  { brand: "Microsoft Edge", name: "Microsoft Edge" },
  { brand: "Opera", name: "Opera" },
  { brand: "Brave", name: "Brave" },
  { brand: "Samsung Internet", name: "Samsung Internet" },
  { brand: "Vivaldi", name: "Vivaldi" },
  { brand: "Google Chrome", name: "Chrome" },
] as const;

function isGreaseBrand(brand: string): boolean {
  const lowered = brand.toLowerCase();
  return lowered.includes("not") && lowered.includes("brand");
}

function selectBrowserBrand(
  brands:
    readonly { readonly brand: string; readonly version: string }[] | undefined,
): { readonly name: string; readonly version: string } | undefined {
  if (brands === undefined) return undefined;
  const candidates = brands.filter(
    (candidate): boolean => !isGreaseBrand(candidate.brand),
  );
  for (const mapping of SPECIFIC_BRAND_MAPPINGS) {
    const found = candidates.find(
      (candidate): boolean => candidate.brand === mapping.brand,
    );
    if (found !== undefined)
      return { name: mapping.name, version: found.version };
  }
  // Unrecognized brands are not reported verbatim: an unknown label is a
  // claim this parser cannot classify, so fall back to Chromium when present
  // and otherwise report nothing.
  const chromium = candidates.find(
    (candidate): boolean => candidate.brand === "Chromium",
  );
  if (chromium !== undefined)
    return { name: "Chromium", version: chromium.version };
  return undefined;
}

function normalizePlatform(platform: string | undefined): string | undefined {
  switch (platform) {
    case "Windows":
    case "Android":
    case "Linux":
      return platform;
    case "macOS":
      return "macOS";
    case "Chrome OS":
    case "Chromium OS":
      return "ChromeOS";
    default:
      return undefined;
  }
}

function normalizeArchitecture(
  architecture: string,
  bitness: string | undefined,
): string {
  const lowered = architecture.toLowerCase();
  if (lowered === "x86_64") return "x86_64";
  if (lowered === "x86") return bitness === "64" ? "x86_64" : "x86";
  if (lowered === "arm64") return "arm64";
  if (lowered === "arm") return bitness === "64" ? "arm64" : "arm";
  return architecture;
}

function extractVersion(userAgent: string, prefix: string): string | undefined {
  const prefixIndex = userAgent.indexOf(prefix);
  if (prefixIndex < 0) return undefined;
  const start = prefixIndex + prefix.length;
  let end = start;
  while (end < userAgent.length && end - start < 64) {
    const code = userAgent.charCodeAt(end);
    const accepted =
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      code === 45 ||
      code === 46 ||
      code === 95;
    if (!accepted) break;
    end += 1;
  }
  return end === start ? undefined : userAgent.slice(start, end);
}

function normalizeOsVersion(version: string | undefined): string | undefined {
  return version?.replaceAll("_", ".");
}

// On Windows, Sec-CH-UA-Platform-Version reports the build-derived version
// where a major of 13 or higher means Windows 11 and 1..12 mean Windows 10;
// 0 covers older releases that cannot be distinguished, so report unknown.
function osVersionFromHints(
  platform: string,
  platformVersion: string | undefined,
): string | undefined {
  if (platformVersion === undefined || platformVersion === "") {
    return undefined;
  }
  if (platform === "Windows") {
    const major = Number.parseInt(platformVersion.split(".", 1)[0] ?? "", 10);
    if (Number.isNaN(major) || major < 1) return undefined;
    return major >= 13 ? "11" : "10";
  }
  return normalizeOsVersion(platformVersion);
}

function versionedInfo(
  name: string | undefined,
  version: string | undefined,
): BrowserInfo {
  return compact<BrowserInfo>({
    name,
    version,
    major: version?.split(".", 1)[0],
  });
}

function compact<T extends object>(
  value: Readonly<Partial<Record<keyof T, unknown>>>,
): T {
  const compacted: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >;
  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue !== undefined) compacted[key] = fieldValue;
  }
  return compacted as T;
}

function freezeResult(
  userAgent: string,
  uaReduced: boolean,
  detection: MutableDetection,
): ParseResult {
  const browser = Object.freeze(detection.browser);
  const engine = Object.freeze(detection.engine);
  const os = Object.freeze(detection.os);
  const device = Object.freeze(detection.device);
  const cpu = Object.freeze(detection.cpu);
  const client = Object.freeze(detection.client);
  return Object.freeze(
    compact<ParseResult>({
      ua: userAgent,
      uaReduced,
      browser,
      engine,
      os,
      device,
      cpu,
      client,
    }),
  );
}
