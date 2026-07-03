// 確反タブの技選択ボトムシート（docs/06 A-3: FATのion-select interface="modal"パターン）。
// 長リストのタップ精度問題を回避するため、通常の<select>ではなくボトムシート+検索+カテゴリチップで選ぶ。
import { useMemo, useState } from "react";
import { BottomSheet } from "./shared/BottomSheet";
import { AdvBadge } from "./shared/AdvBadge";
import { groupMovesBySection } from "../lib/moveSections";
import type { Move } from "../types";

interface Props {
  title: string;
  moves: Move[];
  selectedMoveId: string;
  onSelect: (moveId: string) => void;
}

export function MoveSelectSheet({ title, moves, selectedMoveId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedMove = moves.find((m) => m.id === selectedMoveId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return moves;
    return moves.filter((m) => {
      const ja = (m.name_ja ?? "").toLowerCase();
      const en = (m.name_en ?? "").toLowerCase();
      return ja.includes(q) || en.includes(q);
    });
  }, [moves, query]);

  const grouped = useMemo(() => groupMovesBySection(filtered), [filtered]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center justify-between rounded border border-border bg-surface-1 px-3 py-2 text-left text-sm text-ink-primary hover:border-action"
      >
        <span>
          {selectedMove ? (
            <>
              <span className="font-medium">{selectedMove.name_ja ?? selectedMove.name_en}</span>
              {selectedMove.on_shield != null ? (
                <span className="ml-2 text-xs text-ink-muted">硬直差 {selectedMove.on_shield}</span>
              ) : null}
            </>
          ) : (
            <span className="text-ink-muted">技を選択</span>
          )}
        </span>
        <span className="text-ink-muted" aria-hidden="true">
          ▾
        </span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="技名で検索"
          className="mb-3 w-full min-h-11 rounded border border-border bg-surface-0 p-2 text-sm text-ink-primary"
        />
        <div className="max-h-[55vh] space-y-4 overflow-y-auto">
          {grouped.length === 0 ? (
            <p className="text-sm text-ink-muted">該当する技がありません。</p>
          ) : (
            grouped.map((g) => (
              <div key={g.section.key}>
                <div className="mb-1 text-xs font-semibold text-ink-muted">{g.section.label}</div>
                <ul className="space-y-1">
                  {g.moves.map((m) => {
                    const selected = m.id === selectedMoveId;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(m.id);
                            setOpen(false);
                            setQuery("");
                          }}
                          className={`flex min-h-11 w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm ${
                            selected ? "bg-action/15 text-action-strong" : "text-ink-primary hover:bg-surface-2"
                          }`}
                        >
                          <span>
                            <span className="font-medium">{m.name_ja ?? m.name_en ?? m.slug}</span>
                            <span className="ml-2 text-xs text-ink-muted">{m.name_en ?? ""}</span>
                          </span>
                          {m.on_shield != null ? <AdvBadge frames={m.on_shield} /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
