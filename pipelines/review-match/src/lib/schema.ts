// result.json（Claude Code セッションが書く分析結果）のバリデーション（純関数・依存なし）。
// restructure-notes の手書き検証流儀に倣う。submit の入口ゲート。docs/13 のスキーマ契約が正。

export const SITUATIONS = [
  "neutral",
  "advantage",
  "disadvantage",
  "ledge",
  "edgeguard",
  "recovery",
] as const;
export type Situation = (typeof SITUATIONS)[number];

export const MISTAKE_TYPES = ["execution", "decision"] as const;
export type MistakeType = (typeof MISTAKE_TYPES)[number];

export const VERDICTS = ["achieved", "partial", "not_achieved", "not_observable"] as const;
export type Verdict = (typeof VERDICTS)[number];

export interface Death {
  stock: number;
  kill_move: string;
  initiating_action: string;
}

export interface RawFinding {
  t_sec: number;
  situation: Situation;
  observation: string;
  suggestion: string;
  habit_tag: string | null;
  mistake_type: MistakeType;
  confidence: number;
  death?: Death;
}

export interface RawScene {
  t_sec: number;
  findings: RawFinding[];
  scene_summary: string;
}

export interface RawFocusEvaluation {
  focus_point_id: string;
  verdict: Verdict;
  evidence: string;
}

export interface ResultJson {
  scenes: RawScene[];
  summary_md: string;
  one_mistake: string;
  focus_evaluations: RawFocusEvaluation[];
}

export type ValidateResult =
  | { ok: true; value: ResultJson }
  | { ok: false; errors: string[] };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function validateDeath(v: unknown, path: string, errors: string[]): void {
  if (!isObject(v)) {
    errors.push(`${path}: object である必要があります`);
    return;
  }
  if (!isFiniteNumber(v.stock)) errors.push(`${path}.stock: 数値が必要です`);
  if (typeof v.kill_move !== "string") errors.push(`${path}.kill_move: 文字列が必要です`);
  if (typeof v.initiating_action !== "string") {
    errors.push(`${path}.initiating_action: 文字列が必要です`);
  }
}

function validateFinding(v: unknown, path: string, errors: string[]): void {
  if (!isObject(v)) {
    errors.push(`${path}: object である必要があります`);
    return;
  }
  if (!isFiniteNumber(v.t_sec)) errors.push(`${path}.t_sec: 数値が必要です`);
  if (!SITUATIONS.includes(v.situation as Situation)) {
    errors.push(`${path}.situation: ${SITUATIONS.join("|")} のいずれか（受領: ${String(v.situation)}）`);
  }
  if (typeof v.observation !== "string") errors.push(`${path}.observation: 文字列が必要です`);
  if (typeof v.suggestion !== "string") errors.push(`${path}.suggestion: 文字列が必要です`);
  if (!(v.habit_tag === null || typeof v.habit_tag === "string")) {
    errors.push(`${path}.habit_tag: 文字列または null が必要です`);
  }
  if (!MISTAKE_TYPES.includes(v.mistake_type as MistakeType)) {
    errors.push(
      `${path}.mistake_type: ${MISTAKE_TYPES.join("|")} のいずれか（受領: ${String(v.mistake_type)}）`,
    );
  }
  if (!isFiniteNumber(v.confidence) || v.confidence < 0 || v.confidence > 1) {
    errors.push(`${path}.confidence: 0.0〜1.0 の数値が必要です（受領: ${String(v.confidence)}）`);
  }
  if (v.death !== undefined) validateDeath(v.death, `${path}.death`, errors);
}

function validateScene(v: unknown, path: string, errors: string[]): void {
  if (!isObject(v)) {
    errors.push(`${path}: object である必要があります`);
    return;
  }
  if (!isFiniteNumber(v.t_sec)) errors.push(`${path}.t_sec: 数値が必要です`);
  if (typeof v.scene_summary !== "string") errors.push(`${path}.scene_summary: 文字列が必要です`);
  if (!Array.isArray(v.findings)) {
    errors.push(`${path}.findings: 配列が必要です`);
  } else {
    v.findings.forEach((f, i) => validateFinding(f, `${path}.findings[${i}]`, errors));
  }
}

function validateFocusEvaluation(v: unknown, path: string, errors: string[]): void {
  if (!isObject(v)) {
    errors.push(`${path}: object である必要があります`);
    return;
  }
  if (!isNonEmptyString(v.focus_point_id)) {
    errors.push(`${path}.focus_point_id: 空でない文字列が必要です`);
  }
  if (!VERDICTS.includes(v.verdict as Verdict)) {
    errors.push(`${path}.verdict: ${VERDICTS.join("|")} のいずれか（受領: ${String(v.verdict)}）`);
  }
  if (typeof v.evidence !== "string") errors.push(`${path}.evidence: 文字列が必要です`);
}

/** result.json の unknown を検証し、型付き ResultJson か エラー一覧を返す（純関数）。 */
export function validateResult(data: unknown): ValidateResult {
  const errors: string[] = [];
  if (!isObject(data)) {
    return { ok: false, errors: ["result: トップレベルは object である必要があります"] };
  }
  if (!Array.isArray(data.scenes)) {
    errors.push("result.scenes: 配列が必要です");
  } else {
    data.scenes.forEach((s, i) => validateScene(s, `result.scenes[${i}]`, errors));
  }
  if (typeof data.summary_md !== "string") errors.push("result.summary_md: 文字列が必要です");
  if (typeof data.one_mistake !== "string") errors.push("result.one_mistake: 文字列が必要です");
  if (!Array.isArray(data.focus_evaluations)) {
    errors.push("result.focus_evaluations: 配列が必要です");
  } else {
    data.focus_evaluations.forEach((e, i) =>
      validateFocusEvaluation(e, `result.focus_evaluations[${i}]`, errors),
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: data as unknown as ResultJson };
}

/** JSON 文字列をパースして検証する。パース失敗もエラーに含める。 */
export function parseAndValidateResult(jsonText: string): ValidateResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, errors: [`result.json のパース失敗: ${(e as Error).message}`] };
  }
  return validateResult(data);
}
