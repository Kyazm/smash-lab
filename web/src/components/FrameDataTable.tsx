// フレームデータ表。列: 技名(ja/en)・発生・持続・全体・ガード硬直差・ダメージ。モバイルファースト、横スクロール可。
// Wave A-2でカテゴリセクション+スティッキーアンカーナビ+詳細ドロワーへ刷新予定（docs/06）。
import { AdvBadge } from "./shared/AdvBadge";
import { FrameValue } from "./shared/FrameValue";
import type { Move } from "../types";

interface Props {
  moves: Move[];
}

export function FrameDataTable({ moves }: Props) {
  if (moves.length === 0) {
    return <p className="text-sm text-ink-muted">フレームデータがありません。</p>;
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="min-w-full border-collapse whitespace-nowrap text-sm">
        <thead>
          <tr className="border-b border-border text-left text-ink-secondary">
            <th className="py-2 pr-4">技名</th>
            <th className="py-2 pr-4">発生</th>
            <th className="py-2 pr-4">持続</th>
            <th className="py-2 pr-4">全体</th>
            <th className="py-2 pr-4">ガード硬直差</th>
            <th className="py-2 pr-4">ダメージ</th>
          </tr>
        </thead>
        <tbody>
          {moves.map((move) => (
            <tr key={move.id} className="border-b border-border-subtle">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  {move.hitbox_img_url ? (
                    <img
                      src={move.hitbox_img_url}
                      alt={move.name_ja ?? move.name_en ?? move.slug}
                      className="h-8 w-8 shrink-0 object-contain"
                    />
                  ) : null}
                  <div>
                    <div className="font-medium text-ink-primary">
                      {move.name_ja ?? "（技名未設定）"}
                    </div>
                    <div className="text-xs text-ink-muted">{move.name_en ?? ""}</div>
                  </div>
                </div>
              </td>
              <td className="py-2 pr-4">
                <FrameValue value={move.startup} />
              </td>
              <td className="py-2 pr-4">
                <FrameValue value={move.active} />
              </td>
              <td className="py-2 pr-4">
                <FrameValue value={move.faf} />
              </td>
              <td className="py-2 pr-4">
                {move.on_shield == null ? (
                  <FrameValue value={null} />
                ) : (
                  <AdvBadge frames={move.on_shield} />
                )}
              </td>
              <td className="py-2 pr-4">
                <FrameValue value={move.damage} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
