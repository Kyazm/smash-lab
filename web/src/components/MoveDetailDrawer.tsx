// フレーム表の行タップで開く詳細ドロワー（docs/06 A-2）。
// ヒットボックス画像(UFDリンク) / 持続 / 備考 / フレームバー可視化 / 確反タブへのクロスリンク。
import { Link, useParams } from "react-router-dom";
import { BottomSheet } from "./shared/BottomSheet";
import { FrameBarViz } from "./shared/FrameBarViz";
import { FrameValue } from "./shared/FrameValue";
import { AdvBadge } from "./shared/AdvBadge";
import { buildFrameBar } from "../lib/frameBar";
import type { Move } from "../types";

interface Props {
  move: Move | null;
  onClose: () => void;
}

export function MoveDetailDrawer({ move, onClose }: Props) {
  const { slug } = useParams<{ slug: string }>();
  const bar = move ? buildFrameBar(move) : null;

  return (
    <BottomSheet open={move != null} onClose={onClose} title={move?.name_ja ?? "技の詳細"}>
      {move ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {move.hitbox_img_url ? (
              <img
                src={move.hitbox_img_url}
                alt={move.name_ja ?? move.name_en ?? move.slug}
                className="h-20 w-20 shrink-0 rounded border border-border-subtle bg-surface-2 object-contain"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-border-subtle bg-surface-2 text-xs text-ink-muted">
                画像なし
              </div>
            )}
            <div>
              <div className="text-base font-semibold text-ink-primary">{move.name_ja ?? "（技名未設定）"}</div>
              <div className="text-xs text-ink-muted">{move.name_en ?? ""}</div>
              {move.hitbox_img_url ? (
                <a
                  href={move.hitbox_img_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-action-strong underline"
                >
                  UFDのヒットボックス画像を開く
                </a>
              ) : null}
            </div>
          </div>

          <dl className="grid grid-cols-4 gap-2 text-sm">
            <div>
              <dt className="text-xs text-ink-muted">発生</dt>
              <dd>
                <FrameValue value={move.startup} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">持続</dt>
              <dd>
                <FrameValue value={move.active} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">全体</dt>
              <dd>
                <FrameValue value={move.faf} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">ダメージ</dt>
              <dd>
                <FrameValue value={move.damage} />
              </dd>
            </div>
          </dl>

          <div>
            <div className="mb-1 text-xs text-ink-muted">ガード硬直差</div>
            {move.on_shield == null ? (
              <FrameValue value={null} />
            ) : (
              <AdvBadge frames={move.on_shield} />
            )}
          </div>

          <div>
            <div className="mb-1 text-xs text-ink-muted">フレームバー</div>
            {bar ? (
              <FrameBarViz bar={bar} />
            ) : (
              <p className="text-xs text-ink-muted">
                持続表記が複雑なため自動可視化できません（生データ: {move.active ?? "-"}）。
              </p>
            )}
          </div>

          {move.notes ? (
            <div>
              <div className="mb-1 text-xs text-ink-muted">備考</div>
              <p className="text-sm text-ink-secondary">{move.notes}</p>
            </div>
          ) : null}

          {move.on_shield != null && slug ? (
            <Link
              to={`/c/${slug}?tab=punish&mode=defend&move=${move.id}`}
              onClick={onClose}
              className="flex min-h-11 w-full items-center justify-center rounded bg-action px-3 py-2 text-sm font-medium text-white hover:bg-action-strong"
            >
              この技への確反を見る →
            </Link>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}
