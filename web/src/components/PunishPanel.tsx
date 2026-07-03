// 確定反撃タブ本体。守り/攻めトグル + 技選択 + 結果表示 + 前提注記。
// 守り/攻めは `&mode=defend|attack` にURL状態化する（docs/06）。
// フレーム表ドロワーからの「この技への確反を見る」クロスリンクは `&move=<moveId>`
// （守りモード=相手の技を選択済み）で技を事前選択する。
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { defensivePunish, offensiveSafety } from "../lib/punish";
import { buildOosCandidates, buildAerialCandidates, toShieldedMove } from "../lib/oosCandidates";
import { PunishHitList } from "./PunishHitList";
import { PunishAssumptionsNote } from "./PunishAssumptionsNote";
import { MoveSelectSheet } from "./MoveSelectSheet";
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

function modeFromParam(v: string | null): Mode {
  return v === "attack" ? "offense" : "defense";
}

export function PunishPanel({ opponent, main }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = modeFromParam(searchParams.get("mode"));
  const setMode = (next: Mode) => {
    const params = new URLSearchParams(searchParams);
    params.set("mode", next === "offense" ? "attack" : "defend");
    setSearchParams(params, { replace: false });
  };

  const opponentMoves = shieldableMoves(opponent.moves);
  const mainMoves = main ? shieldableMoves(main.moves) : [];
  const preselectMoveId = searchParams.get("move");
  const [opponentMoveId, setOpponentMoveId] = useState<string>(
    (preselectMoveId && opponentMoves.some((m) => m.id === preselectMoveId)
      ? preselectMoveId
      : opponentMoves[0]?.id) ?? "",
  );
  const [mainMoveId, setMainMoveId] = useState<string>(mainMoves[0]?.id ?? "");

  // move= がURLにあり、かつフレーム表ドロワーからの遷移直後は守りモードへ強制し選択を反映する。
  useEffect(() => {
    if (!preselectMoveId) return;
    if (!opponentMoves.some((m) => m.id === preselectMoveId)) return;
    setOpponentMoveId(preselectMoveId);
    const params = new URLSearchParams(searchParams);
    let changed = false;
    if (params.get("mode") !== "defend") {
      params.set("mode", "defend");
      changed = true;
    }
    if (changed) setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectMoveId]);

  // ガーキャン空中攻撃は技ごとに buildAerialCandidates で生成して合流する（FU-5）。
  // isMain=true（守り=ZSS）のときだけ ZSS 向けの間合い注記を付与する。相手側は注記なし。
  const mainOosCandidates = useMemo(
    () =>
      main
        ? [
            ...buildOosCandidates(main.moves, main.oosOptions),
            ...buildAerialCandidates(main.moves, main.character.is_main),
          ]
        : [],
    [main],
  );
  const opponentOosCandidates = useMemo(
    () => [
      ...buildOosCandidates(opponent.moves, opponent.oosOptions),
      ...buildAerialCandidates(opponent.moves, opponent.character.is_main),
    ],
    [opponent],
  );

  if (!main) {
    return (
      <p className="text-sm text-ink-muted">
        使用キャラ（is_main=true）のデータが見つからないため、確定反撃タブは利用できません。
      </p>
    );
  }

  const selectedOpponentMove = opponentMoves.find((m) => m.id === opponentMoveId) ?? null;
  const selectedMainMove = mainMoves.find((m) => m.id === mainMoveId) ?? null;

  const defenseResult = selectedOpponentMove
    ? defensivePunish(toShieldedMove(selectedOpponentMove), mainOosCandidates)
    : null;
  const defenseResultPerfect = selectedOpponentMove
    ? defensivePunish(toShieldedMove(selectedOpponentMove), mainOosCandidates, true)
    : null;
  const offenseResult = selectedMainMove
    ? offensiveSafety(toShieldedMove(selectedMainMove), opponentOosCandidates)
    : null;
  const offenseResultPerfect = selectedMainMove
    ? offensiveSafety(toShieldedMove(selectedMainMove), opponentOosCandidates, true)
    : null;

  return (
    <div>
      <div className="flex gap-2" role="tablist" aria-label="守り/攻め">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "defense"}
          onClick={() => setMode("defense")}
          className={`min-h-11 rounded px-3 py-1.5 text-sm font-medium ${
            mode === "defense" ? "bg-action text-white" : "bg-surface-2 text-ink-secondary"
          }`}
        >
          守り
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "offense"}
          onClick={() => setMode("offense")}
          className={`min-h-11 rounded px-3 py-1.5 text-sm font-medium ${
            mode === "offense" ? "bg-action text-white" : "bg-surface-2 text-ink-secondary"
          }`}
        >
          攻め
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">表記: {FRAME_CERTAIN_LABEL}</p>

      {mode === "defense" ? (
        <div className="mt-3">
          <span className="mb-1 block text-sm text-ink-secondary">
            相手（{opponent.character.name_ja}）の技を選択
          </span>
          <MoveSelectSheet
            title={`${opponent.character.name_ja}の技を選択`}
            moves={opponentMoves}
            selectedMoveId={opponentMoveId}
            onSelect={setOpponentMoveId}
          />

          <div className="mt-4">
            {defenseResult == null ? null : defenseResult.canPunish === false ? (
              <p className="text-sm text-ink-secondary">反撃不可（相手有利〜五分）</p>
            ) : (
              <PunishHitList
                hits={defenseResult.hits}
                perfectShieldHits={
                  defenseResultPerfect?.canPunish === true ? defenseResultPerfect.hits : []
                }
                title={`${FRAME_CERTAIN_LABEL} なZSSの反撃（不利F ${defenseResult.disadvantageFrames}）`}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <span className="mb-1 block text-sm text-ink-secondary">
            ZSS（{main.character.name_ja}）の技を選択
          </span>
          <MoveSelectSheet
            title={`${main.character.name_ja}の技を選択`}
            moves={mainMoves}
            selectedMoveId={mainMoveId}
            onSelect={setMainMoveId}
          />

          <div className="mt-4">
            {offenseResult == null ? null : offenseResult.safe ? (
              <p className="text-sm text-action-strong">
                フレーム上安全
                {offenseResult.reason === "no_punish"
                  ? `（不利F ${offenseResult.disadvantageFrames} だが相手の実用OoSでは確定しない）`
                  : "（ガード硬直差が非負）"}
              </p>
            ) : (
              <PunishHitList
                hits={offenseResult.punishedBy}
                perfectShieldHits={
                  offenseResultPerfect?.safe === false ? offenseResultPerfect.punishedBy : []
                }
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
