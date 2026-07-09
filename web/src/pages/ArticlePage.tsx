// 公開記事本文（"/library/:slug"）。認証不要。renderMarkdown で本文描画。
// 読み物なので本文は読みやすい幅(max-w-3xl)・行間広め。冒頭に「制作メモ/リサーチノート」注記。
import { Link, useParams } from "react-router-dom";
import { BrandMark } from "../components/BrandMark";
import { getArticle } from "../lib/articles";
import { renderMarkdown } from "../lib/markdown";

export function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = getArticle(slug);

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="mt-8 text-sm text-ink-secondary">記事が見つかりませんでした。</p>
        <Link to="/library" className="mt-3 inline-block text-sm text-action-strong hover:underline">
          ← ライブラリ一覧へ
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/library" className="text-xs text-ink-muted hover:text-ink-primary">
          ← ライブラリ一覧
        </Link>
        <BrandMark size="sm" />
      </div>

      <header className="mt-3 border-b border-border-subtle pb-4">
        <h1 className="font-display text-3xl leading-tight tracking-wide text-ink-primary">
          {article.title}
        </h1>
      </header>

      {/* 実践ガイド(guide)には注記不要。設計根拠を兼ねるノートのみ内部向け記述の断りを出す。 */}
      {article.kind === "note" ? (
        <p className="mt-4 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-xs text-ink-muted">
          これは制作メモ / リサーチノートです。個人ツール smash-lab の設計根拠として書かれたもので、
          一部に内部向けの相互リンク（docs/06 参照 等）を含みます。
        </p>
      ) : null}

      {/* renderMarkdown 既定の text-sm を、読み物向けに base サイズ・広めの行間で上書き。 */}
      <article className="mt-5 text-base leading-7 [&_*]:text-[15px] md:[&_*]:text-base">
        {renderMarkdown(article.body)}
      </article>

      <nav className="mt-8 border-t border-border-subtle pt-4 text-sm">
        <Link to="/library" className="text-ink-muted hover:text-ink-primary">
          ← ライブラリ一覧へ
        </Link>
      </nav>
    </div>
  );
}
