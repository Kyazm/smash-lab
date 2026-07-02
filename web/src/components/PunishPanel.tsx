// 確定反撃タブ本体。守り/攻めトグル + 技選択 + 結果表示 + 前提注記。
import { useMemo, useState } from "react";
import { defensivePunish, offensiveSafety } from "../lib/punish";
import { buildOosCandidates, toShieldedMove } from "../lib/oosCandidates";
import { PunishHitList } from "./PunishHitList";
import { PunishAssumptionsNote } from "./PunishAssumptionsNote";
import type { CharacterBundle } from "../types";

interface Props {
  /** 表示中のキャラ（相手） */
  opponent: CharacterBundle;
  /** ZSS（使用キャラ）一式。取得できない場合は null（確定反撃タブは無効表示） */
  main: CharacterBundle | null;
}

type Mode = "defense" | "offense";

const FRAME_CERTAIN_LABEL = "フレーム上確定（リーチ・位置要確認）";

/** on_shield を持つ技のみ（つかみ等はシールド系データが無いのが仕様上正しい省略: docs/04 #2） */
function shieldableMoves(moves: Props["opponent"]["moves"]) {
  return moves.filter((m) => m.on_shield != null);
}

export function PunishPanel({ opponent, main }: Props) {
  const [mode, setMode] = useState<Mode>("defense");
  const opponentMoves = shieldableMoves(opponent.moves);
  const mainMoves = main ? shieldableMoves(main.moves) : [];
  const [opponentMoveId, setOpponentMoveId] = useState<string>(opponentMoves[0]?.id ?? "");
  const [mainMoveId, setMainMoveId] = useState<string>(mainMoves[0]?.id ?? "");

  const mainOosCandidates = useMemo(
    () => (main ? buildOosCandidates(main.moves, main.oosOptions) : []),
    [main],
  );
  const opponentOosCandidates = useMemo(
    () => buildOosCandidates(opponent.moves, opponent.oosOptions),
    [opponent],
  );

  if (!main) {
    return (
      <p className="text-sm text-slate-400">
        使用キャラ（is_main=true）のデータが見つからないため、確定反撃タブは利用できません。
      </p>
    );
  }

  const selectedOpponentMove = opponentMoves.find((m) => m.id === opponentMoveId) ?? null;
  const selectedMainMove = mainMoves.find((m) => m.id === mainMoveId) ?? null;

  const defenseResult = selectedOpponentMove
    ? defensivePunish(toShieldedMove(selectedOpponentMove), mainOosCandidates)
    : null;
  const offenseResult = selectedMainMove
    ? offensiveSafety(toShieldedMove(selectedMainMove), opponentOosCandidates)
    : null;

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("defense")}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            mode === "defense" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
          }`}
        >
          守り
        </button>
        <button
          type="button"
          onClick={() => setMode("offense")}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            mode === "offense" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
          }`}
        >
          攻め
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-400">表記: {FRAME_CERTAIN_LABEL}</p>

      {mode === "defense" ? (
        <div className="mt-3">
          <label className="block text-sm text-slate-300">
            相手（{opponent.character.name_ja}）の技を選択
            <select
              className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm"
              value={opponentMoveId}
              onChange={(e) => setOpponentMoveId(e.target.value)}
            >
              {opponentMoves.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name_ja ?? m.name_en ?? m.slug}（ガード硬直差 {m.on_shield}）
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4">
            {defenseResult == null ? null : defenseResult.canPunish === false ? (
              <p className="text-sm text-slate-300">反撃不可（相手有利〜五分）</p>
            ) : (
              <PunishHitList
                hits={defenseResult.hits}
                title={`${FRAME_CERTAIN_LABEL} なZSSの反撃（不利F ${defenseResult.disadvantageFrames}）`}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <label className="block text-sm text-slate-300">
            ZSS（{main.character.name_ja}）の技を選択
            <select
              className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm"
              value={mainMoveId}
              onChange={(e) => setMainMoveId(e.target.value)}
            >
              {mainMoves.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name_ja ?? m.name_en ?? m.slug}（ガード硬直差 {m.on_shield}）
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4">
            {offenseResult == null ? null : offenseResult.safe ? (
              <p className="text-sm text-emerald-400">
                フレーム上安全
                {offenseResult.reason === "no_punish"
                  ? `（不利F ${offenseResult.disadvantageFrames} だが相手の実用OoSでは確定しない）`
                  : "（ガード硬直差が非負）"}
              </p>
            ) : (
              <PunishHitList
                hits={offenseResult.punishedBy}
                title={`${FRAME_CERTAIN_LABEL} な相手の反撃（不利F ${offenseResult.disadvantageFrames}）`}
              />
            )}
          </div>
        </div>
      )}

      <PunishAssumptionsNote />
    </div>
  );
}
