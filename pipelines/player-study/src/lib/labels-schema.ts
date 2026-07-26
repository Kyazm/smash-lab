// labels.json（Claude Code セッションが書くラベル結果）の検証（純関数・依存なし）。
// submit の入口ゲート。設計 v2 / docs/14 の契約が正。review-match の schema.ts 流儀に倣う。

// situation 語彙（9種）。docs/13 を拡張（崖を offense/defense 分離、landing/kill_confirm 追加）。
export const SITUATIONS = [
  "neutral",
  "advantage",
  "disadvantage",
  "ledge_offense",
  "ledge_defense",
  "landing",
  "edgeguard",
  "recovery",
  "kill_confirm",
] as const;
export type Situation = (typeof SITUATIONS)[number];

// 行動辞書 v1。粗カテゴリ（8種）+ 視認容易な個別技 slug + unknown。
export const ACTION_CATEGORIES = [
  "aerial",
  "ground_attack",
  "smash",
  "grab",
  "special",
  "shield_action",
  "movement",
  "ledge_option",
] as const;
export const ACTION_EASY_SLUGS = [
  "zair",
  "down_smash",
  "boost_kick",
  "flip_jump",
  "plasma_whip",
  "paralyzer",
] as const;
export const ACTION_VALUES = [...ACTION_CATEGORIES, ...ACTION_EASY_SLUGS, "unknown"] as const;
export type ActionValue = (typeof ACTION_VALUES)[number];

export const OUTCOMES = ["won", "lost", "even"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const SIDES = ["p1", "p2"] as const;
export type Side = (typeof SIDES)[number];

export interface LabelGame {
  game_index: number;
  opp_char: string;
  side: Side;
}

export interface LabelInteraction {
  t_sec: number;
  game_index: number;
  situation: Situation;
  action: ActionValue;
  outcome: Outcome;
  confidence: number;
  frame: string;
  sub_situation?: string;
  action_detail?: string;
  kill?: boolean;
  opp_char?: string;
  note?: string;
}

export interface LabelsJson {
  video_id?: string;
  games: LabelGame[];
  interactions: LabelInteraction[];
}

export type ValidateResult =
  | { ok: true; value: LabelsJson }
  | { ok: false; errors: string[] };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isInt(v: unknown): v is number {
  return isFiniteNumber(v) && Number.isInteger(v);
}
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function validateGame(v: unknown, path: string, errors: string[]): number | null {
  if (!isObject(v)) {
    errors.push(`${path}: object である必要があります`);
    return null;
  }
  let gi: number | null = null;
  if (!isInt(v.game_index) || (v.game_index as number) < 1) {
    errors.push(`${path}.game_index: 1以上の整数が必要です（受領: ${String(v.game_index)}）`);
  } else {
    gi = v.game_index as number;
  }
  if (!isNonEmptyString(v.opp_char)) errors.push(`${path}.opp_char: 空でない文字列が必要です`);
  if (!SIDES.includes(v.side as Side)) {
    errors.push(`${path}.side: ${SIDES.join("|")} のいずれか（受領: ${String(v.side)}）`);
  }
  return gi;
}

function validateInteraction(
  v: unknown,
  path: string,
  gameIndices: Set<number>,
  errors: string[],
): void {
  if (!isObject(v)) {
    errors.push(`${path}: object である必要があります`);
    return;
  }
  if (!isFiniteNumber(v.t_sec) || (v.t_sec as number) < 0) {
    errors.push(`${path}.t_sec: 0以上の数値が必要です（受領: ${String(v.t_sec)}）`);
  }
  if (!isInt(v.game_index)) {
    errors.push(`${path}.game_index: 整数が必要です（受領: ${String(v.game_index)}）`);
  } else if (gameIndices.size > 0 && !gameIndices.has(v.game_index as number)) {
    errors.push(`${path}.game_index: games に存在しない index (${v.game_index})`);
  }
  if (!SITUATIONS.includes(v.situation as Situation)) {
    errors.push(`${path}.situation: ${SITUATIONS.join("|")} のいずれか（受領: ${String(v.situation)}）`);
  }
  if (!ACTION_VALUES.includes(v.action as ActionValue)) {
    errors.push(`${path}.action: 行動辞書外の値（受領: ${String(v.action)}）`);
  }
  if (!OUTCOMES.includes(v.outcome as Outcome)) {
    errors.push(`${path}.outcome: ${OUTCOMES.join("|")} のいずれか（受領: ${String(v.outcome)}）`);
  }
  if (!isFiniteNumber(v.confidence) || (v.confidence as number) < 0 || (v.confidence as number) > 1) {
    errors.push(`${path}.confidence: 0.0〜1.0 の数値が必要です（受領: ${String(v.confidence)}）`);
  }
  if (!isNonEmptyString(v.frame)) {
    errors.push(`${path}.frame: 空でない文字列（バースト内フレームパス）が必要です`);
  }
  if (v.sub_situation !== undefined && typeof v.sub_situation !== "string") {
    errors.push(`${path}.sub_situation: 文字列が必要です`);
  }
  if (v.action_detail !== undefined && typeof v.action_detail !== "string") {
    errors.push(`${path}.action_detail: 文字列が必要です`);
  }
  if (v.kill !== undefined && typeof v.kill !== "boolean") {
    errors.push(`${path}.kill: 真偽値が必要です`);
  }
  if (v.opp_char !== undefined && typeof v.opp_char !== "string") {
    errors.push(`${path}.opp_char: 文字列が必要です`);
  }
  if (v.note !== undefined && typeof v.note !== "string") {
    errors.push(`${path}.note: 文字列が必要です`);
  }
}

/** labels.json の unknown を検証し、型付き LabelsJson か エラー一覧を返す（純関数）。 */
export function validateLabels(data: unknown): ValidateResult {
  const errors: string[] = [];
  if (!isObject(data)) {
    return { ok: false, errors: ["labels: トップレベルは object である必要があります"] };
  }
  if (data.video_id !== undefined && typeof data.video_id !== "string") {
    errors.push("labels.video_id: 文字列が必要です");
  }

  const gameIndices = new Set<number>();
  if (!Array.isArray(data.games)) {
    errors.push("labels.games: 配列が必要です");
  } else {
    for (let i = 0; i < data.games.length; i++) {
      const gi = validateGame(data.games[i], `labels.games[${i}]`, errors);
      if (gi !== null) {
        if (gameIndices.has(gi)) errors.push(`labels.games[${i}].game_index: 重複 (${gi})`);
        gameIndices.add(gi);
      }
    }
  }

  if (!Array.isArray(data.interactions)) {
    errors.push("labels.interactions: 配列が必要です");
  } else {
    data.interactions.forEach((it, i) =>
      validateInteraction(it, `labels.interactions[${i}]`, gameIndices, errors),
    );
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: data as unknown as LabelsJson };
}

/** JSON 文字列をパースして検証する。パース失敗もエラーに含める。 */
export function parseAndValidateLabels(jsonText: string): ValidateResult {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, errors: [`labels.json のパース失敗: ${(e as Error).message}`] };
  }
  return validateLabels(data);
}
