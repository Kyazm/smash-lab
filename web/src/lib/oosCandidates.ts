// DB形（Move/OosOption）を punish.ts の計算用型（OosCandidate/ShieldedMove）へ変換するヘルパー。
// oos_options は move_id で技を参照するのみで startup を持たないため、ここで各 oos_option を
// 自身の move（startup の出処）と結合してから OosCandidate を組み立てる。
import type { OosCandidate, ShieldedMove } from "./punish";
import type { Move, OosOption } from "../types";

/** ガード解除（shield_drop）で出せる技のガード解除ぶんの追加F。ジャスガ時は0扱い（FU-3）。 */
const SHIELD_DROP_EXTRA_FRAMES = 11;

/** ガード解除でも出せる技カテゴリ（ガーキャン不可のため一度ガードを解いてから出す） */
const SHIELD_DROP_CATEGORIES: ReadonlySet<Move["category"]> = new Set(["tilt", "smash", "dash"]);

/**
 * キャラの moves から shield_drop（ガード解除反撃）候補を生成する（FU-3・全キャラ共通コード生成）。
 *
 * 対象: category が tilt/smash/dash の全技、および jab はそのキャラで最小startupの1つだけ
 * （弱1〜3等の派生を並べても実用上は最速の1つしか使わないため）。
 * 除外: slug === 'up-smash'（上スマは直接OoSで出せるため shield_drop 側では重複させない）。
 */
export function buildShieldDropCandidates(moves: Move[]): OosCandidate[] {
  const candidates: OosCandidate[] = [];

  for (const move of moves) {
    if (move.startup == null) continue;
    if (move.slug === "up-smash") continue;
    if (!SHIELD_DROP_CATEGORIES.has(move.category)) continue;
    candidates.push({
      startup: move.startup,
      extraFrames: SHIELD_DROP_EXTRA_FRAMES,
      oosType: "shield_drop",
      label: `ガード解除→${move.name_ja ?? move.name_en ?? "（無名の技）"}`,
      rangeNote: null,
      id: `shield-drop:${move.id}`,
    });
  }

  // jab はそのキャラで最小startupの1つのみ（派生技の重複表示を避ける）
  let fastestJab: Move | null = null;
  for (const move of moves) {
    if (move.category !== "jab" || move.startup == null) continue;
    if (fastestJab == null || move.startup < (fastestJab.startup as number)) {
      fastestJab = move;
    }
  }
  if (fastestJab != null) {
    candidates.push({
      startup: fastestJab.startup as number,
      extraFrames: SHIELD_DROP_EXTRA_FRAMES,
      oosType: "shield_drop",
      label: `ガード解除→${fastestJab.name_ja ?? fastestJab.name_en ?? "（無名の技）"}`,
      rangeNote: null,
      id: `shield-drop:${fastestJab.id}`,
    });
  }

  return candidates;
}

/**
 * moves と oosOptions（同一キャラ分）から OosCandidate[] を構築する。
 * 対応する move が見つからない oos_option（startup が無い等）は候補から除外する。
 *
 * shield_drop タイプの oos_option は無視する（FU-3）。ガード解除で出せる具体技の候補は
 * buildShieldDropCandidates が moves から動的に生成する（旧: 単一の汎用「ガード解除」行だった）。
 */
export function buildOosCandidates(moves: Move[], oosOptions: OosOption[]): OosCandidate[] {
  const moveById = new Map(moves.map((m) => [m.id, m]));

  const candidates: OosCandidate[] = [];
  for (const oos of oosOptions) {
    if (oos.oos_type === "shield_drop") continue;
    const move = moveById.get(oos.move_id);
    if (!move || move.startup == null) continue;
    candidates.push({
      startup: move.startup,
      extraFrames: oos.extra_frames,
      oosType: oos.oos_type,
      label: oos.label ?? move.name_ja ?? move.name_en,
      rangeNote: oos.range_note,
      id: oos.id,
    });
  }
  candidates.push(...buildShieldDropCandidates(moves));
  return candidates;
}

/** Move を punish.ts の ShieldedMove（ガードさせた側の技）へ変換する。 */
export function toShieldedMove(move: Move): ShieldedMove {
  return {
    onShield: move.on_shield ?? 0,
    startup: move.startup,
    label: move.name_ja ?? move.name_en,
    id: move.id,
  };
}
