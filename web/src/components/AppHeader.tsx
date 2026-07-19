// 全ページ共通ヘッダー（ADR対象: ヘッダー統一）。左: BrandMark（"/"へ）、右: ナビ。
// 旧CharacterListPageのナビ（自キャラ/横断検索/承認待ち/AIレビュー/戦績/ライブラリ）をそのまま移植し、
// NavLinkで現在地をアクティブ表示（下線）する。ゲスト時はオーナー専用リンク（承認待ち・AIレビュー）を非表示。
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { notesProvider } from "../data/notes";
import { useIsGuest } from "../lib/guestContext";
import { BrandMark } from "./BrandMark";

// 自キャラ（CTA的な強調枠）。他項目より目立たせる既存デザインを維持。
const PRIMARY_NAV_CLASS =
  "flex min-h-11 items-center rounded bg-action px-3 py-1.5 font-medium text-white hover:bg-action-strong";
// 他ナビ項目（横断検索/承認待ち/AIレビュー/戦績/ライブラリ）共通。
const SECONDARY_NAV_CLASS =
  "flex min-h-11 items-center gap-1.5 rounded bg-surface-2 px-3 py-1.5 font-medium text-ink-secondary hover:text-ink-primary";
// アクティブ時は控えめに下線のみ追加（bg強調は既存トーンを崩すため避ける）。
const ACTIVE_NAV_CLASS = "underline decoration-2 underline-offset-4";
const SECONDARY_ACTIVE_NAV_CLASS = `text-ink-primary ${ACTIVE_NAV_CLASS}`;

export function AppHeader() {
  const isGuest = useIsGuest();
  // 承認待ち(pending+stale)件数バッジ（docs/07 F-A、旧CharacterListPageから移植）。
  // AppHeaderはセッション中マウントされ続けるため、ルート遷移のたびに再取得して承認/却下後の件数ズレを防ぐ。
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (isGuest) return; // リンク自体を出さないため取得も省略
    let cancelled = false;
    notesProvider
      .listPendingProposals()
      .then((list) => {
        if (!cancelled) setPendingCount(list.length);
      })
      .catch((e) => {
        // バッジは補助情報。取得失敗時は非表示(null)にとどめ、致命的エラーにはしない。
        if (!cancelled) {
          console.error("[AppHeader] listPendingProposals 失敗", e);
          setPendingCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest, pathname]);

  return (
    <header className="border-b border-border-subtle">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4">
        <Link to="/">
          <BrandMark size="sm" />
        </Link>
        <nav className="flex flex-wrap gap-2 text-sm">
          <NavLink
            to="/me"
            className={({ isActive }) => `${PRIMARY_NAV_CLASS} ${isActive ? ACTIVE_NAV_CLASS : ""}`}
          >
            自キャラ
          </NavLink>
          <NavLink
            to="/search"
            className={({ isActive }) =>
              `${SECONDARY_NAV_CLASS} ${isActive ? SECONDARY_ACTIVE_NAV_CLASS : ""}`
            }
          >
            横断検索
          </NavLink>
          {/* 承認待ち提案はオーナー個人のレビューキュー（migration 0006でRLSもオーナー限定）。ゲストには出さない。 */}
          {!isGuest ? (
            <NavLink
              to="/proposals"
              className={({ isActive }) =>
                `${SECONDARY_NAV_CLASS} ${isActive ? SECONDARY_ACTIVE_NAV_CLASS : ""}`
              }
            >
              承認待ち
              {pendingCount !== null && pendingCount > 0 ? (
                <span className="rounded-full bg-warning px-1.5 py-0.5 text-xs font-bold text-surface-0">
                  {pendingCount}
                </span>
              ) : null}
            </NavLink>
          ) : null}
          {/* AIレビューもオーナー個人のレビューキュー（Macパイプライン依存・ADR-0019）。ゲストには出さない。 */}
          {!isGuest ? (
            <NavLink
              to="/review"
              className={({ isActive }) =>
                `${SECONDARY_NAV_CLASS} ${isActive ? SECONDARY_ACTIVE_NAV_CLASS : ""}`
              }
            >
              AIレビュー
            </NavLink>
          ) : null}
          {/* 戦績ダッシュボードはゲストにも表示（自分のローカル戦績を試せる。個人情報漏洩はない）。 */}
          <NavLink
            to="/stats"
            className={({ isActive }) =>
              `${SECONDARY_NAV_CLASS} ${isActive ? SECONDARY_ACTIVE_NAV_CLASS : ""}`
            }
          >
            戦績
          </NavLink>
          <NavLink
            to="/library"
            className={({ isActive }) =>
              `${SECONDARY_NAV_CLASS} ${isActive ? SECONDARY_ACTIVE_NAV_CLASS : ""}`
            }
          >
            ライブラリ
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
