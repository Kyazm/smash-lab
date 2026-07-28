// 行動別スクショギャラリー（docs/14_player-study.md ⑪「各択タップでスクショギャラリー(t_sec昇順) + YouTube seekTo()」）。
// カードタップ → 上部プレイヤーが該当秒へシーク。外部リンク(watch?v=…&t=…s)も併設する
// （ReviewDetailPage / FindingCard と同じ二本立て）。
import { useState } from "react";
import { formatTimeDisplay } from "../../lib/youtube";
import { resolveFrameUrl } from "../../data/study/studyApi";
import {
  STUDY_LINE_LABELS,
  STUDY_OUTCOME_LABELS,
  studyActionLabel,
  type StudyInteractionWithVideo,
} from "../../data/study/types";
import { CharacterIcon } from "../shared/CharacterIcon";
import type { Character } from "../../types";

/** 勝ち=赤（既存カラー規約）、負け=中立グレー、五分=薄いグレー。 */
const OUTCOME_CLASS: Record<string, string> = {
  won: "bg-action text-white",
  lost: "bg-surface-2 text-ink-secondary",
  even: "bg-surface-2 text-ink-muted",
};

function FrameImage({ path, alt }: { path: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  // Storage の public URL 解決は getSupabaseClient() 経由。未設定環境では例外になるので握り潰す。
  let url: string | null = null;
  try {
    url = resolveFrameUrl(path);
  } catch {
    url = null;
  }
  if (!url || failed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded bg-surface-2 text-[10px] text-ink-muted">
        フレーム画像なし
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-video w-full rounded object-cover"
    />
  );
}

export function StudyGallery({
  rows,
  onSeek,
  charByName,
}: {
  /** 表示順は呼び出し側で整えた順（sortForGallery）をそのまま使う。 */
  rows: StudyInteractionWithVideo[];
  onSeek: (videoId: string, tSec: number) => void;
  charByName: Map<string, Character>;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">該当する場面がありません。</p>;
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => {
        const c = r.opp_char ? charByName.get(r.opp_char) : undefined;
        const time = formatTimeDisplay(r.t_sec);
        return (
          <li key={r.id} className="overflow-hidden rounded border border-border-subtle bg-surface-1">
            <button
              type="button"
              onClick={() => onSeek(r.video.video_id, r.t_sec)}
              className="w-full p-2 text-left transition-colors hover:bg-surface-2/40"
            >
              <FrameImage
                path={r.frame_path}
                alt={`${studyActionLabel(r.action)} ${time}`}
              />

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${OUTCOME_CLASS[r.outcome]}`}
                >
                  {STUDY_OUTCOME_LABELS[r.outcome]}
                </span>
                {r.kill ? (
                  <span className="rounded bg-accent-yellow/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-yellow">
                    撃墜
                  </span>
                ) : null}
                {r.line ? (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-secondary">
                    {STUDY_LINE_LABELS[r.line]}
                  </span>
                ) : null}
                <span className="ml-auto font-frame text-[10px] tabular-nums text-ink-muted">
                  G{r.game_index} · ▶ {time}
                </span>
              </div>

              <div className="mt-1.5 flex items-center gap-1.5">
                {c ? <CharacterIcon character={c} size="sm" className="h-5 w-5" /> : null}
                <span className="min-w-0 truncate text-xs text-ink-secondary">
                  {r.opp_char ?? "相手不明"}
                </span>
                <span className="min-w-0 flex-1 truncate text-right text-[10px] text-ink-muted">
                  {r.video.tournament ?? r.video.title ?? r.video.video_id}
                  {r.video.round ? ` / ${r.video.round}` : ""}
                </span>
              </div>

              {r.sub_situation || r.action_detail ? (
                <p className="mt-1 text-[10px] text-ink-muted">
                  {[r.action_detail, r.sub_situation].filter(Boolean).join(" / ")}
                </p>
              ) : null}
              {r.note ? <p className="mt-1 text-xs text-ink-secondary">{r.note}</p> : null}
            </button>

            <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-2 py-1.5">
              <span className="font-frame text-[10px] tabular-nums text-ink-muted">
                確度 {r.confidence == null ? "—" : r.confidence.toFixed(2)}
              </span>
              <a
                href={`https://www.youtube.com/watch?v=${r.video.video_id}&t=${Math.floor(r.t_sec)}s`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-action-strong underline decoration-action/40 hover:decoration-action-strong"
              >
                YouTubeで開く
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
