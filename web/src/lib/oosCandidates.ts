// DB形（Move/OosOption）を punish.ts の計算用型（OosCandidate/ShieldedMove）へ変換するヘルパー。
// oos_options は move_id で技を参照するのみで startup を持たないため、ここで各 oos_option を
// 自身の move（startup の出処）と結合してから OosCandidate を組み立てる。
import type { OosCandidate, ShieldedMove } from "./punish";
import type { Move, OosOption } from "../types";

/**
 * moves と oosOptions（同一キャラ分）から OosCandidate[] を構築する。
 * 対応する move が見つからない oos_option（startup が無い等）は候補から除外する。
 */
export function buildOosCandidates(moves: Move[], oosOptions: OosOption[]): OosCandidate[] {
  const moveById = new Map(moves.map((m) => [m.id, m]));

  const candidates: OosCandidate[] = [];
  for (const oos of oosOptions) {
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
