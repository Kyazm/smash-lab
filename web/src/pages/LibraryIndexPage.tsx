// 公開ライブラリ記事インデックス（"/library"）。ゲスト/オーナーで閲覧。
// 新デザイン（黒地・赤アクセント・font-display見出し）。練習科学リサーチ等を読める。
// ヘッダーは他ページ（キャラ詳細・戦績）と統一: 左上に「← キャラ一覧」、右に BrandMark。
import { Link } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { articles } from "../lib/articles";

export function LibraryIndexPage() {
  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/" className="text-xs text-ink-muted hover:text-ink-primary">
          ← キャラ一覧
        </Link>
        <BrandMark size="sm" />
      </div>

      <header className="border-b border-border-subtle pb-4">
        <p className="font-frame text-[10px] uppercase tracking-[0.3em] text-ink-muted">
          smash lab / library
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-wide text-ink-primary">
          ライブラリ<span className="text-action"> / </span>記事
        </h1>
        <p className="mt-2 text-sm text-ink-secondary">
          スマブラSPの上達に関する練習科学・調査のリサーチノート。
        </p>
      </header>

      <ul className="mt-4 space-y-3">
        {articles.map((a) => (
          <li key={a.slug}>
            <Link
              to={`/library/${a.slug}`}
              className="block rounded-xl border border-border-subtle bg-surface-1 p-4 transition-colors hover:border-action"
            >
              <h2 className="font-display text-xl tracking-wide text-ink-primary">{a.title}</h2>
              {a.description ? (
                <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-ink-secondary">
                  {a.description}
                </p>
              ) : null}
              <span className="mt-2 inline-block text-xs font-medium text-action-strong">
                読む →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <nav className="mt-6 border-t border-border-subtle pt-4 text-sm">
        <Link to="/" className="text-ink-muted hover:text-ink-primary">
          ← キャラ一覧へ
        </Link>
      </nav>
    </div>
  );
}
