// 対戦履歴タイムライン（ADR-0015）。いつ・どのモードで・どの相手と当たって勝/負したかを時系列（新しい順）で表示。
// 日付ごとに区切り、負けを赤で強調する。ポケトレ/ホムヒカは代表に正規化済みのため1キャラ名で出る。
import { useState } from "react";
import type { MatchResult } from "../../data/match/types";
import { MATCH_MODE_LABELS } from "../../data/match/types";
import { CharacterIcon } from "../shared/CharacterIcon";
import type { Character } from "../../types";

const PAGE_SIZE = 10;

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function MatchTimeline({
  results,
  charById,
  nameFor,
  onDelete,
}: {
  /** 表示対象（モードフィルタ後）。characterId はグループ代表に正規化済みでよい。 */
  results: MatchResult[];
  charById: Map<string, Character>;
  nameFor: (id: string) => string;
  onDelete?: (id: string) => void;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  if (results.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">まだ対戦記録がありません。</p>;
  }
  // 新しい順に並べ、先頭 limit 件だけ日付グループ化して表示（「もっと見る」で PAGE_SIZE ずつ増やす）。
  const desc = [...results].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  const shown = desc.slice(0, limit);
  const remaining = desc.length - shown.length;
  const groups: { key: string; label: string; items: MatchResult[] }[] = [];
  for (const r of shown) {
    const key = dateKey(r.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(r);
    else groups.push({ key, label: dateLabel(r.createdAt), items: [r] });
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="mb-1 border-b border-border-subtle pb-1 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
            {g.label}
          </p>
          <ul className="divide-y divide-border-subtle">
            {g.items.map((r) => {
              const c = charById.get(r.characterId);
              const lose = r.result === "lose";
              return (
                <li key={r.id} className="flex items-center gap-2 py-1.5">
                  <span className="w-10 shrink-0 font-frame text-[10px] tabular-nums text-ink-muted">
                    {timeLabel(r.createdAt)}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      lose ? "bg-action text-white" : "border border-border-subtle text-ink-secondary"
                    }`}
                  >
                    {lose ? "負" : "勝"}
                  </span>
                  {c ? <CharacterIcon character={c} size="sm" /> : null}
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-primary">
                    {nameFor(r.characterId)}
                  </span>
                  <span className="shrink-0 font-frame text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                    {MATCH_MODE_LABELS[r.mode]}
                  </span>
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      aria-label="この記録を削除"
                      className="shrink-0 rounded px-1.5 text-ink-muted hover:text-action-strong"
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE_SIZE)}
          className="min-h-11 w-full rounded-md border border-border-subtle text-sm font-medium text-ink-secondary hover:border-action hover:text-ink-primary"
        >
          もっと見る（残り {remaining} 件）
        </button>
      ) : null}
      <p className="text-center font-frame text-[10px] tabular-nums text-ink-muted">
        {shown.length} / {desc.length} 件
      </p>
    </div>
  );
}
