// メモ本文中のURL・プレースホルダの種別判定（純粋関数）。ADR-0012。
// markdown.tsx から呼ばれ、対応するブロック要素（img/iframe/blockquote/link）の choice に使う。

export type EmbedKind = "youtube" | "image" | "tweet" | "link";

export interface ClassifiedUrl {
  kind: EmbedKind;
  /** 元URL（そのまま） */
  url: string;
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;
// discord CDN は署名付きURLが失効するため画像直リンクとして扱い、img側のonErrorでフォールバックする（ADR-0012）。
const KNOWN_IMAGE_HOSTS = ["cdn.discordapp.com", "media.discordapp.net"];

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isYouTubeUrl(url: URL): boolean {
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  return host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com";
}

function isTweetUrl(url: URL): boolean {
  const host = url.hostname.replace(/^www\./, "").replace(/^mobile\./, "");
  if (host !== "twitter.com" && host !== "x.com") return false;
  // /<user>/status/<id> 形式のみ埋め込み対象（プロフィールURL等は対象外）
  return /^\/[^/]+\/status\/\d+/.test(url.pathname);
}

function isImageUrl(url: URL): boolean {
  if (IMAGE_EXT_RE.test(url.pathname)) return true;
  const host = url.hostname.replace(/^www\./, "");
  return KNOWN_IMAGE_HOSTS.includes(host);
}

/**
 * URL文字列を埋め込み種別に分類する。パース不能な文字列は 'link' 扱い（呼び出し側でリンク化のみ行う）。
 * http(s) 以外のスキーム（mailto: 等）も 'link' 扱い。
 */
export function classifyUrl(url: string): ClassifiedUrl {
  const trimmed = url.trim();
  const parsed = parseUrl(trimmed);
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    return { kind: "link", url: trimmed };
  }
  if (isYouTubeUrl(parsed)) return { kind: "youtube", url: trimmed };
  if (isTweetUrl(parsed)) return { kind: "tweet", url: trimmed };
  if (isImageUrl(parsed)) return { kind: "image", url: trimmed };
  return { kind: "link", url: trimmed };
}

// 単独行として現れるURLの検出（行全体がURLのみ、前後空白許容）。
const BARE_URL_LINE_RE = /^\s*(https?:\/\/\S+)\s*$/i;

/** 行が「単独行のURL」かどうかを判定し、該当すればURLを返す。 */
export function matchBareUrlLine(line: string): string | null {
  const m = line.match(BARE_URL_LINE_RE);
  return m ? m[1] : null;
}

// 文中に現れるURLを検出するための汎用正規表現（インラインリンク化用）。global。
export const INLINE_URL_RE = /https?:\/\/[^\s)\]]+/g;

// Discord添付プレースホルダ: attachment://<id>/<name>
const ATTACHMENT_RE = /^attachment:\/\/([^/]+)\/(.+)$/;

export interface AttachmentPlaceholder {
  id: string;
  name: string;
}

/** `attachment://<id>/<name>` をパースする。一致しなければ null。 */
export function parseAttachmentPlaceholder(text: string): AttachmentPlaceholder | null {
  const m = text.trim().match(ATTACHMENT_RE);
  if (!m) return null;
  return { id: m[1], name: m[2] };
}

/**
 * attachment プレースホルダを Storage の storage_path（`discord/<id>_<name>`）へ変換する。
 * ADR-0012: Discord添付32枚は `discord/<id>_<name>` にアップロード済み。
 */
export function attachmentToStoragePath(placeholder: AttachmentPlaceholder): string {
  return `discord/${placeholder.id}_${placeholder.name}`;
}

// `![alt](attachment://id/name)` 形式のMarkdown画像記法。
const MD_IMAGE_ATTACHMENT_RE = /^!\[([^\]]*)\]\(attachment:\/\/([^/)]+)\/([^)]+)\)$/;

export interface MarkdownImageAttachment {
  alt: string;
  id: string;
  name: string;
}

/** `![alt](attachment://id/name)` 単独行を判定してパースする。一致しなければ null。 */
export function matchMarkdownImageAttachmentLine(line: string): MarkdownImageAttachment | null {
  const m = line.trim().match(MD_IMAGE_ATTACHMENT_RE);
  if (!m) return null;
  return { alt: m[1], id: m[2], name: m[3] };
}

// 素の `attachment://id/name`（Markdown画像記法を伴わない）単独行。
const BARE_ATTACHMENT_LINE_RE = /^(attachment:\/\/[^/]+\/.+)$/;

/** 単独行の素の attachment:// プレースホルダを判定する。一致しなければ null。 */
export function matchBareAttachmentLine(line: string): AttachmentPlaceholder | null {
  const m = line.trim().match(BARE_ATTACHMENT_LINE_RE);
  if (!m) return null;
  return parseAttachmentPlaceholder(m[1]);
}
