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

/**
 * 単独行の「一般リンク（YouTube/画像/ツイート以外）」を検出し、カード表示用の情報を返す（FU-4）。
 * - 対象は matchBareUrlLine が成立し、かつ classifyUrl が 'link' 判定のURLのみ。
 * - YouTube/画像/ツイートは従来の埋め込みで扱うため null を返す。
 * - ネットワーク取得（OGP等）はしない。ドメインラベルはURLから機械的に導出する。
 */
export interface LinkCard {
  url: string;
  /** 表示用ドメイン（例: note.com）。先頭 www. は除去。パース不能時はURL全体。 */
  domain: string;
}

export function matchLinkCardLine(line: string): LinkCard | null {
  const url = matchBareUrlLine(line);
  if (!url) return null;
  if (classifyUrl(url).kind !== "link") return null;
  const parsed = parseUrl(url);
  const domain = parsed ? parsed.hostname.replace(/^www\./, "") : url;
  return { url, domain };
}

// 文中に現れるURLを検出するための汎用正規表現（インラインリンク化用）。global。
// 全角の区切り記号（／、。「」等）もURLの一部に飲み込まれないよう除外する。
// 実データで `.../watch?v=xxx／https://twitter.com/...` のように全角スラッシュで
// 2つのURLが空白なしに連結されるケースがあるため（FU-1で発覚）。
export const INLINE_URL_RE = /https?:\/\/[^\s)\]、。「」『』／]+/g;

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

// --- 行内メディア抽出（FU-1） ---
// AI整頓提案が日付・注記をURL/attachmentと同じ行に付けるケースに対応するため、
// 単独行に限らず行内（行頭・行末・テキスト中）の既知メディアもブロック埋め込み対象として抽出する。
// 非対応（未知）URLは従来どおりインラインリンク化に委ねるため、ここでは拾わない。

export type LineSegment =
  | { type: "text"; text: string }
  | { type: "media-url"; kind: "youtube" | "image" | "tweet"; url: string }
  | { type: "media-attachment"; alt: string; id: string; name: string };

// `![alt](attachment://id/name)` 形式（行内のどこにあってもよい）。
const INLINE_MD_IMAGE_ATTACHMENT_RE = /!\[([^\]]*)\]\(attachment:\/\/([^/)]+)\/([^)]+)\)/g;
// 素の `attachment://id/name`（Markdown画像記法を伴わない）。
const INLINE_BARE_ATTACHMENT_RE = /attachment:\/\/([^/\s]+)\/(\S+)/g;
// 行内URL走査は INLINE_URL_RE と同一パターンを使う（global フラグの状態共有を避けるため呼び出し側で lastIndex をリセットする）。

interface RawMatch {
  start: number;
  end: number;
  segment: LineSegment;
}

/**
 * 1行からメディア（既知URL種別 or attachmentプレースホルダ）を抽出し、
 * テキストとメディアが交互に並ぶセグメント列を返す。
 * - メディアでないテキスト部分は type: "text" として保持する（前後の注記・日付等を失わない）
 * - 未知URL（link判定）はテキストの一部としてそのまま残す（呼び出し側のインラインリンク化に委ねる）
 * - メディアが1つも無ければ null を返す（呼び出し側で「通常の段落行」として扱わせるため）
 */
export function extractLineMedia(line: string): LineSegment[] | null {
  const matches: RawMatch[] = [];

  // 1) `![alt](attachment://id/name)` を先に拾う（後段の素attachment走査と重複しないよう除外域を管理）
  INLINE_MD_IMAGE_ATTACHMENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_MD_IMAGE_ATTACHMENT_RE.exec(line)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: { type: "media-attachment", alt: m[1], id: m[2], name: m[3] },
    });
  }

  const isInsideExistingMatch = (idx: number) =>
    matches.some((r) => idx >= r.start && idx < r.end);

  // 2) 素の attachment://id/name（Markdown画像記法に含まれていないもの）
  INLINE_BARE_ATTACHMENT_RE.lastIndex = 0;
  while ((m = INLINE_BARE_ATTACHMENT_RE.exec(line)) !== null) {
    if (isInsideExistingMatch(m.index)) continue;
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: { type: "media-attachment", alt: "", id: m[1], name: m[2] },
    });
  }

  // 3) URL（youtube/image/tweetのみメディア化。それ以外はテキストとして残す＝未抽出）
  INLINE_URL_RE.lastIndex = 0;
  while ((m = INLINE_URL_RE.exec(line)) !== null) {
    if (isInsideExistingMatch(m.index)) continue;
    const classified = classifyUrl(m[0]);
    if (classified.kind === "link") continue; // 未知URLはテキスト側に残す（従来どおりインラインリンク化）
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: { type: "media-url", kind: classified.kind, url: classified.url },
    });
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => a.start - b.start);

  const segments: LineSegment[] = [];
  let cursor = 0;
  for (const r of matches) {
    if (r.start > cursor) {
      const text = line.slice(cursor, r.start);
      if (text.trim() !== "") segments.push({ type: "text", text });
    }
    segments.push(r.segment);
    cursor = r.end;
  }
  if (cursor < line.length) {
    const text = line.slice(cursor);
    if (text.trim() !== "") segments.push({ type: "text", text });
  }
  return segments;
}
