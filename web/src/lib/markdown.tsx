// 最小 Markdown レンダラ（依存なし・XSS安全）。
// 対応: 見出し(#..###)、箇条書き(- / *)、番号付き(1.)、太字(**), インラインコード(`)、
//       水平線(---)、段落、改行。生HTMLは一切解釈しない（React要素として組み立てるためエスケープ不要）。
// リッチ埋め込み（ADR-0012）: 単独行のURL・attachment://プレースホルダをブロック要素（img/iframe/blockquote/link）に、
//   段落中のURLはインラインリンクに変換する。埋め込み種別判定は lib/embeds.ts（純関数・テスト対象）に委譲。
// リッチな記法は割り切って非対応（メモ用途に十分）。将来必要なら remark 等に差し替え可。
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  classifyUrl,
  extractLineMedia,
  attachmentToStoragePath,
  INLINE_URL_RE,
  type LineSegment,
} from "./embeds";
import { youtubeInputToEmbedUrl } from "./youtube";
import { loadTwitterWidgets } from "./twitterWidgets";
import { notesProvider } from "../data/notes";

// インライン: **bold** / `code` / 裸URL（リンク化）に対応。< 等はReactが自動エスケープする。
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // **bold** / `code` / 裸URL を分割トークン化。URL部分は embeds.ts の INLINE_URL_RE と同一パターンを共有する
  // （全角区切り文字でURLが連結されるケースへの対応、FU-1）。
  const re = new RegExp(`(\\*\\*[^*]+\\*\\*|\`[^\`]+\`|${INLINE_URL_RE.source})`, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      nodes.push(
        <code key={`${keyPrefix}-c${i}`} className="rounded bg-surface-2 px-1 py-0.5 text-xs font-frame">
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      // 裸URL（インライン）。単独行のブロック埋め込みはブロック処理側で先に処理されるためここには来ない。
      nodes.push(
        <a
          key={`${keyPrefix}-u${i}`}
          href={tok}
          target="_blank"
          rel="noreferrer"
          className="text-action-strong underline decoration-action/40 hover:decoration-action-strong"
        >
          {tok}
        </a>,
      );
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// re の global フラグ使い回しで lastIndex が残らないよう、renderInline 呼び出し前に明示リセットは不要
// （exec ループのたびに正規表現リテラルを再生成しているため状態は共有されない）。

/** 画像URL（attachment解決済み or 直リンク）を表示する。直リンクはロード失敗時にリンク表示へフォールバック。 */
function ImageBlock({ src, alt, fallbackHref }: { src: string; alt: string; fallbackHref?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <a
        href={fallbackHref ?? src}
        target="_blank"
        rel="noreferrer"
        className="text-action-strong underline"
      >
        {fallbackHref ?? src}
      </a>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="max-h-96 max-w-full rounded border border-border object-contain"
      onError={() => setFailed(true)}
    />
  );
}

/** YouTube埋込（16:9）。既存 youtube.ts の embed URL 変換を再利用。 */
function YouTubeBlock({ url }: { url: string }) {
  const embed = youtubeInputToEmbedUrl(url);
  if (!embed) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-action-strong underline">
        {url}
      </a>
    );
  }
  return (
    <div className="relative w-full overflow-hidden rounded" style={{ paddingBottom: "56.25%" }}>
      <iframe
        className="absolute inset-0 h-full w-full"
        src={embed}
        title="YouTube"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

/** Twitter/X埋込。widgets.js を遅延ロードして blockquote を展開。失敗/未ロード時はリンクにフォールバック。 */
function TweetBlock({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLQuoteElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTwitterWidgets()
      .then(() => {
        if (cancelled) return;
        window.twttr?.widgets?.load(ref.current ?? undefined);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-action-strong underline">
        {url}
      </a>
    );
  }

  return (
    <blockquote className="twitter-tweet" ref={ref}>
      <a href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
    </blockquote>
  );
}

/** その他URL: 新規タブリンク（rel=noreferrer）。 */
function LinkBlock({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="break-all text-action-strong underline decoration-action/40 hover:decoration-action-strong"
    >
      {url}
    </a>
  );
}

/** 単独行URLを種別に応じたブロック要素へ。 */
function UrlEmbedBlock({ url }: { url: string }) {
  const classified = classifyUrl(url);
  if (classified.kind === "youtube") return <YouTubeBlock url={url} />;
  if (classified.kind === "tweet") return <TweetBlock url={url} />;
  if (classified.kind === "image") {
    return <ImageBlock src={url} alt="" fallbackHref={url} />;
  }
  return <LinkBlock url={url} />;
}

/** attachment:// プレースホルダを storage_path 解決して画像表示。 */
function AttachmentImageBlock({ id, name, alt }: { id: string; name: string; alt: string }) {
  const storagePath = attachmentToStoragePath({ id, name });
  const src = notesProvider.resolveImageUrl(storagePath);
  return <ImageBlock src={src} alt={alt || name} />;
}

// FU-1: 行内（行頭・行末・テキスト中）に既知メディアがあってもブロック埋め込みにする。
// extractLineMedia が返すセグメント列（テキスト/メディアの混在）をそのまま描画する。
// 残りテキストはキャプションとして埋め込みブロックの直下に表示し、内容を失わない。
function LineMediaBlock({ segments, keyPrefix }: { segments: LineSegment[]; keyPrefix: string }) {
  return (
    <div className="my-2 space-y-1">
      {segments.map((seg, idx) => {
        if (seg.type === "text") {
          return (
            <p key={`${keyPrefix}-t${idx}`} className="whitespace-pre-wrap text-sm leading-relaxed">
              {renderInline(seg.text, `${keyPrefix}-t${idx}`)}
            </p>
          );
        }
        if (seg.type === "media-attachment") {
          return (
            <AttachmentImageBlock
              key={`${keyPrefix}-m${idx}`}
              id={seg.id}
              name={seg.name}
              alt={seg.alt}
            />
          );
        }
        // media-url
        return <UrlEmbedBlock key={`${keyPrefix}-m${idx}`} url={seg.url} />;
      })}
    </div>
  );
}

/** Markdown 文字列を React 要素へ。ブロック単位で解釈する。 */
export function renderMarkdown(md: string): ReactNode {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let listItems: { text: string; ordered: boolean }[] = [];
  let paragraph: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const ordered = listItems[0].ordered;
    const items = listItems.map((li, idx) => (
      <li key={`li-${key}-${idx}`}>{renderInline(li.text, `li-${key}-${idx}`)}</li>
    ));
    blocks.push(
      ordered ? (
        <ol key={`ol-${key}`} className="ml-5 list-decimal space-y-1">
          {items}
        </ol>
      ) : (
        <ul key={`ul-${key}`} className="ml-5 list-disc space-y-1">
          {items}
        </ul>
      ),
    );
    key++;
    listItems = [];
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join("\n");
    blocks.push(
      <p key={`p-${key}`} className="whitespace-pre-wrap leading-relaxed">
        {renderInline(text, `p-${key}`)}
      </p>,
    );
    key++;
    paragraph = [];
  };

  for (const raw of lines) {
    const line = raw;
    // 水平線
    if (/^---+\s*$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(<hr key={`hr-${key}`} className="my-3 border-border" />);
      key++;
      continue;
    }
    // リッチ埋め込み（ADR-0012, FU-1で行内対応に拡張）: 見出し/箇条書き/番号付き以外の行で
    // ![alt](attachment://...) / attachment://... / 既知メディアURL（YouTube・画像・Twitter）が
    // 行頭・行末・テキスト中のどこにあっても、その行全体をブロック要素として扱う。
    // 残りのテキスト（日付や注記など）はキャプションとして保持し、内容を失わない（FU-1）。
    // 見出し・箇条書き・番号付きリスト行は対象外（レイアウト崩れを避けるため従来どおりインライン扱い）。
    const isStructuralLine =
      /^(#{1,3})\s+/.test(line) || /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
    if (!isStructuralLine) {
      const media = extractLineMedia(line);
      if (media) {
        flushParagraph();
        flushList();
        blocks.push(<LineMediaBlock key={`embed-${key}`} segments={media} keyPrefix={`embed-${key}`} />);
        key++;
        continue;
      }
    }
    // 見出し
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushParagraph();
      flushList();
      const level = h[1].length;
      const cls =
        level === 1
          ? "mt-3 text-lg font-bold"
          : level === 2
            ? "mt-3 text-base font-bold"
            : "mt-2 text-sm font-semibold";
      const content = renderInline(h[2], `h-${key}`);
      blocks.push(
        level === 1 ? (
          <h3 key={`h-${key}`} className={cls}>
            {content}
          </h3>
        ) : level === 2 ? (
          <h4 key={`h-${key}`} className={cls}>
            {content}
          </h4>
        ) : (
          <h5 key={`h-${key}`} className={cls}>
            {content}
          </h5>
        ),
      );
      key++;
      continue;
    }
    // 箇条書き
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      flushParagraph();
      if (listItems.length && listItems[0].ordered) flushList();
      listItems.push({ text: ul[1], ordered: false });
      continue;
    }
    // 番号付き
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      flushParagraph();
      if (listItems.length && !listItems[0].ordered) flushList();
      listItems.push({ text: ol[1], ordered: true });
      continue;
    }
    // 空行 = 段落区切り
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    // 通常テキスト
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();

  return <div className="space-y-2 text-sm text-ink-secondary">{blocks}</div>;
}
