// キャラ対ページの外部リンク欄（docs/06 A-3 / ADR-0011）。データ転載はせず参照リンクのみ。
import { buildExternalLinks } from "../../data/externalLinks";
import type { Character } from "../../types";

interface Props {
  character: Pick<Character, "slug">;
}

export function ExternalLinksBar({ character }: Props) {
  const links = buildExternalLinks(character);
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {links.map((link) => (
        <a
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          title={link.fallback ? "個別ページ未登録のためサイトトップへリンクします" : undefined}
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border-subtle px-3 py-1 text-ink-secondary hover:border-action hover:text-action-strong"
        >
          {link.label}
          {link.fallback ? <span className="text-ink-muted">（トップ）</span> : null}
          <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  );
}
