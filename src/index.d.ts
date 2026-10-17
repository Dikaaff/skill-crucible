export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Grade = "A" | "B" | "C" | "D" | "F";
export type Verdict = "ship" | "revise" | "reject";
export type FailOn = Severity | "none";
export type Manager = "npm" | "pypi";

export interface Finding {
  ruleId: string;
  severity: Severity;
  category: string;
  message: string;
  file?: string;
  line?: number;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface Score {
  score: number;
  grade: Grade;
  verdict: Verdict;
  safetyGate: boolean;
}

export interface SkillUnit {
  main: string;
  dir: string;
  root: string;
  name: string;
  files: string[];
  findings?: Finding[];
  score?: number;
  grade?: Grade;
  verdict?: Verdict;
}

export interface ParseOk {
  ok: true;
  reason: null;
  detail: null;
  data: Record<string, unknown>;
  body: string;
  bodyStartLine: number;
  raw: string;
}

export interface ParseError {
  ok: false;
  reason: "missing-frontmatter" | "invalid-yaml" | "frontmatter-not-a-map";
  detail: string;
  data: null;
  body: string;
  bodyStartLine: number;
  raw: string;
}

export type ParseResult = ParseOk | ParseError;

export interface PackageRef {
  manager: Manager;
  name: string;
  command: string;
  line: number;
  file?: string;
}

export interface PackageVerification extends PackageRef {
  status: number | null;
  exists: boolean | null;
  error?: string;
}

export interface BadgeOptions {
  label?: string;
  message?: string;
}

export interface BadgeSvgOptions {
  label?: string;
  message: string;
  color: string;
}

export interface VerifyOptions {
  timeout?: number;
  fetchImpl?: typeof fetch;
}

export interface Report {
  toolVersion: string;
  inputs: string[];
  units: SkillUnit[];
  findings: Finding[];
  overall: Score;
  online: boolean;
}

export interface TextReport extends Report {
  color?: boolean;
}

export const SEVERITIES: Severity[];
export const RANK: Record<Severity, number>;
export const VERSION: string;

export function countBySeverity(findings: Finding[]): SeverityCounts;
export function computeScore(findings: Finding[]): Score;
export function worstSeverity(findings: Finding[], failOn: FailOn): boolean;

export function discoverSkills(inputPath: string): SkillUnit[];
export function isScannable(file: string): boolean;
export function readTextFile(file: string, maxBytes?: number): string | null;

export function parseSkill(raw: string): ParseResult;
export function lineOfIndex(raw: string, index: number): number;
export function findKeyLine(raw: string, key: string): number;

export function runStructureChecks(unit: SkillUnit, parsed: ParseResult, raw: string): Finding[];
export function runSecurityChecks(unit: SkillUnit, file: string, text: string): Finding[];

export function extractPackages(text: string): PackageRef[];
export function verifyPackages(packages: PackageRef[], options?: VerifyOptions): Promise<PackageVerification[]>;
export function hallucinatedFindings(verifications: PackageVerification[]): Finding[];

export function toJsonReport(report: Report): unknown;
export function toSarif(report: Pick<Report, "toolVersion" | "findings">): unknown;
export function renderText(report: TextReport): string;

export function badgeSvg(options: BadgeSvgOptions): string;
export function badgeColor(score: number): string;
export function badgeForScore(score: number, grade: string, options?: BadgeOptions): string;

export function main(argv: string[]): Promise<number>;
