// フレームデータ表。列: 技名(ja/en)・発生・持続・全体・ガード硬直差・ダメージ。モバイルファースト、横スクロール可。
import type { Move } from "../types";

interface Props {
  moves: Move[];
}

export function FrameDataTable({ moves }: Props) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="min-w-full text-sm border-collapse whitespace-nowrap">
        <thead>
          <tr className="border-b border-slate-600 text-left text-slate-300">
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
            <tr key={move.id} className="border-b border-slate-800">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  {move.hitbox_img_url ? (
                    <img
                      src={move.hitbox_img_url}
                      alt={move.name_ja ?? move.name_en ?? move.slug}
                      className="h-8 w-8 object-contain shrink-0"
                    />
                  ) : null}
                  <div>
                    <div className="font-medium">{move.name_ja ?? "（技名未設定）"}</div>
                    <div className="text-xs text-slate-400">{move.name_en ?? ""}</div>
                  </div>
                </div>
              </td>
              <td className="py-2 pr-4">{move.startup ?? "-"}</td>
              <td className="py-2 pr-4">{move.active ?? "-"}</td>
              <td className="py-2 pr-4">{move.faf ?? "-"}</td>
              <td className="py-2 pr-4">{move.on_shield ?? "-"}</td>
              <td className="py-2 pr-4">{move.damage ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
