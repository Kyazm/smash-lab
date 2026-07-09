// 対戦履歴タイムライン（ADR-0015）。いつ・どのモードで・どの相手と当たって勝/負したかを時系列（新しい順）で表示。
// 日付ごとに区切り、勝ちを赤(action)で強調する（キャラ一覧の記録ボタンと同じ配色に統一）。
// ポケトレ/ホムヒカは代表に正規化済みのため1キャラ名で出る。
// onChanged 指定時は各行に勝/負記録ボタン（WinLoseControl sm）を出し、その行と同キャラ・同モードで追記録できる。
import { useState } from "react";
import { Link } from "react-router-dom";
import type { MatchResult } from "../../data/match/types";
import { MATCH_MODE_LABELS } from "../../data/match/types";
import { CharacterIcon } from "../shared/CharacterIcon";
import { WinLoseControl } from "./WinLoseControl";
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
  onChanged,
}: {
  /** 表示対象（モードフィルタ後）。characterId はグループ代表に正規化済みでよい。 */
  results: MatchResult[];
  charById: Map<string, Character>;
  nameFor: (id: string) => string;
  onDelete?: (id: string) => void;
  /** 指定時、各行に勝/負記録ボタンを表示（その行と同キャラ・同モードで追記録し、完了後に呼ぶ）。 */
  onChanged?: () => void;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  // 削除の確認はインライン2段階（× → 削除/やめる）。window.confirm はモバイルPWAで抑制され効かないことがあるため使わない。
  const [confirmId, setConfirmId] = useState<string | null>(null);
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
                      lose ? "border border-border-subtle text-ink-secondary" : "bg-action text-white"
                    }`}
                  >
                    {lose ? "負" : "勝"}
                  </span>
                  {/* キャラ部分は対策ページ（/c/:slug）へのリンク。行内の勝/負・×ボタンとは分離。 */}
                  {c ? (
                    <Link to={`/c/${c.slug}`} className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-80">
                      <CharacterIcon character={c} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-primary">
                        {nameFor(r.characterId)}
                      </span>
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-primary">
                      {nameFor(r.characterId)}
                    </span>
                  )}
                  <span className="hidden shrink-0 font-frame text-[10px] uppercase tracking-[0.1em] text-ink-muted sm:inline">
                    {MATCH_MODE_LABELS[r.mode]}
                  </span>
                  {onChanged ? (
                    <WinLoseControl
                      characterId={r.characterId}
                      mode={r.mode}
                      wins={0}
                      losses={0}
                      current={0}
                      onChanged={onChanged}
                      showRecord={false}
                      noteHref={c ? `/c/${c.slug}?tab=notes` : undefined}
                      size="sm"
                    />
                  ) : null}
                  {onDelete ? (
                    confirmId === r.id ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(r.id);
                            setConfirmId(null);
                          }}
                          className="min-h-8 rounded bg-action px-2 text-xs font-bold text-white hover:bg-action-strong"
                        >
                          削除
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="min-h-8 rounded px-1.5 text-xs text-ink-muted hover:text-ink-primary"
                        >
                          やめる
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(r.id)}
                        aria-label="この記録を削除"
                        className="min-h-8 min-w-8 shrink-0 rounded px-2 text-base text-ink-muted hover:text-action-strong"
                      >
                        ×
                      </button>
                    )
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
