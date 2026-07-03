// フレームデータ表（docs/06 A-2）。カテゴリセクション+スティッキーアンカーナビ（UFD方式）。
// 一覧はコンパクト5列（技名/発生/全体/硬直差/ダメージ）に固定。持続・備考・ヒットボックスは
// 行タップで開く詳細ドロワーに逃がす2段階開示（Dustloopの14列横スクロール問題を回避）。
import { useState } from "react";
import { AdvBadge } from "./shared/AdvBadge";
import { FrameValue } from "./shared/FrameValue";
import { MoveDetailDrawer } from "./MoveDetailDrawer";
import { groupMovesBySection, type MoveSectionKey } from "../lib/moveSections";
import type { Move } from "../types";

interface Props {
  moves: Move[];
}

export function FrameDataTable({ moves }: Props) {
  const [activeMove, setActiveMove] = useState<Move | null>(null);
  const grouped = groupMovesBySection(moves);

  if (moves.length === 0) {
    return <p className="text-sm text-ink-muted">フレームデータがありません。</p>;
  }

  const scrollTo = (key: MoveSectionKey) => {
    document.getElementById(`move-section-${key}`)?.scrollIntoView({ block: "start" });
  };

  return (
    <div>
      {/* スティッキーアンカーナビ */}
      <div className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-border-subtle bg-surface-0 px-4 py-2">
        {grouped.map((g) => (
          <button
            key={g.section.key}
            type="button"
            onClick={() => scrollTo(g.section.key)}
            className="min-h-9 shrink-0 whitespace-nowrap rounded-full border border-border-subtle px-3 py-1 text-xs font-medium text-ink-secondary hover:border-action hover:text-action-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
          >
            {g.section.label}
            <span className="ml-1 text-ink-muted">{g.moves.length}</span>
          </button>
        ))}
      </div>

      {grouped.map((g) => (
        <section key={g.section.key} id={`move-section-${g.section.key}`} className="mt-5 scroll-mt-14">
          <h3 className="mb-2 text-sm font-bold text-ink-secondary">{g.section.label}</h3>
          <div className="overflow-hidden rounded border border-border-subtle">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-1 text-left text-ink-secondary">
                  <th className="py-2 pl-3 pr-2">技名</th>
                  <th className="w-12 py-2 pr-2 text-right">発生</th>
                  <th className="w-12 py-2 pr-2 text-right">全体</th>
                  <th className="w-16 py-2 pr-2 text-right">硬直差</th>
                  <th className="w-14 py-2 pr-3 text-right">Dmg</th>
                </tr>
              </thead>
              <tbody>
                {g.moves.map((move) => (
                  <tr
                    key={move.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${move.name_ja ?? move.name_en ?? move.slug}の詳細を開く`}
                    onClick={() => setActiveMove(move)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveMove(move);
                      }
                    }}
                    className="min-h-11 cursor-pointer border-b border-border-subtle last:border-b-0 odd:bg-surface-1/30 hover:bg-surface-2/60 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-action"
                  >
                    <td className="py-2 pl-3 pr-2">
                      <div className="flex items-center gap-2">
                        {move.hitbox_img_url ? (
                          <img
                            src={move.hitbox_img_url}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded object-contain"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink-primary">
                            {move.name_ja ?? "（技名未設定）"}
                          </div>
                          <div className="truncate text-xs text-ink-muted">{move.name_en ?? ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <FrameValue value={move.startup} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <FrameValue value={move.faf} />
                    </td>
                    <td className="py-2 pr-2 text-right">
                      {move.on_shield == null ? (
                        <FrameValue value={null} />
                      ) : (
                        <AdvBadge frames={move.on_shield} />
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <FrameValue value={move.damage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <MoveDetailDrawer move={activeMove} onClose={() => setActiveMove(null)} />
    </div>
  );
}
