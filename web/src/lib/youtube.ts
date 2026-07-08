// YouTube URL のパースと埋込URL生成（純粋関数）。
// docs/02 メディア戦略: メモ埋込クリップは YouTube 限定公開の埋込プレイヤー。開始秒 t パラメータ対応。
// 対応入力:
//   https://www.youtube.com/watch?v=VIDEOID&t=90s
//   https://youtu.be/VIDEOID?t=90
//   https://www.youtube.com/embed/VIDEOID?start=90
//   VIDEOID 直指定（11文字）

export interface ParsedYouTube {
  videoId: string;
  /** 開始秒。指定がなければ null */
  startSeconds: number | null;
}

/** "90", "90s", "1m30s", "1h2m3s" 等の時間表記を秒に変換。数値のみは秒扱い。 */
export function parseTimeParam(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (s === "") return null;
  // 純粋な数値（秒）
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  // 1h2m3s 形式
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (m && (m[1] || m[2] || m[3])) {
    const h = parseInt(m[1] ?? "0", 10);
    const min = parseInt(m[2] ?? "0", 10);
    const sec = parseInt(m[3] ?? "0", 10);
    return h * 3600 + min * 60 + sec;
  }
  return null;
}

/**
 * mm:ss / h:mm:ss / 純数値秒 / XhYmZs 形式を秒に変換する（YouTube UIのコピー時刻表記を吸収）。
 * コロン区切り以外は parseTimeParam に委譲する。パース不能・範囲外（分/秒が60以上等）は null。
 * docs/13_match-review.md ②画面仕様: /review フォームのタイムスタンプ入力で使用する。
 */
export function parseFlexibleTime(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = input.trim();
  if (s === "") return null;
  if (s.includes(":")) {
    const parts = s.split(":");
    if (parts.length < 2 || parts.length > 3 || !parts.every((p) => /^\d+$/.test(p))) return null;
    const nums = parts.map((p) => parseInt(p, 10));
    if (parts.length === 3) {
      const [h, m, sec] = nums;
      if (m >= 60 || sec >= 60) return null;
      return h * 3600 + m * 60 + sec;
    }
    const [m, sec] = nums;
    if (sec >= 60) return null;
    return m * 60 + sec;
  }
  return parseTimeParam(s);
}

/**
 * 秒数を mm:ss（1時間未満）/ h:mm:ss（1時間以上）表示用文字列に整形する。
 * docs/13_match-review.md ②画面仕様: findingカードのt_sec表示・タイムスタンプチップ表示で使用する。
 */
export function formatTimeDisplay(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * YouTube URL / ID をパースして videoId と開始秒を取り出す。
 * パースできなければ null。
 */
export function parseYouTube(input: string): ParsedYouTube | null {
  const raw = input.trim();
  if (raw === "") return null;

  // 11文字のID直指定
  if (VIDEO_ID_RE.test(raw)) {
    return { videoId: raw, startSeconds: null };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let videoId: string | null = null;

  if (host === "youtu.be") {
    // https://youtu.be/VIDEOID
    videoId = url.pathname.slice(1).split("/")[0] || null;
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else if (url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.slice("/embed/".length).split("/")[0] || null;
    } else if (url.pathname.startsWith("/shorts/")) {
      videoId = url.pathname.slice("/shorts/".length).split("/")[0] || null;
    } else if (url.pathname.startsWith("/live/")) {
      videoId = url.pathname.slice("/live/".length).split("/")[0] || null;
    }
  }

  if (!videoId || !VIDEO_ID_RE.test(videoId)) return null;

  // 開始秒: t（youtu.be/watch）または start（embed）
  const startSeconds =
    parseTimeParam(url.searchParams.get("t")) ??
    parseTimeParam(url.searchParams.get("start"));

  return { videoId, startSeconds };
}

/**
 * 埋込プレイヤー用 URL を生成する（privacy-enhanced な youtube-nocookie）。
 * 開始秒があれば start= を付与。
 */
export function toEmbedUrl(parsed: ParsedYouTube): string {
  const base = `https://www.youtube-nocookie.com/embed/${parsed.videoId}`;
  if (parsed.startSeconds != null && parsed.startSeconds > 0) {
    return `${base}?start=${parsed.startSeconds}`;
  }
  return base;
}

/** 入力文字列（URL/ID）から直接埋込URLへ。パース不能なら null。 */
export function youtubeInputToEmbedUrl(input: string): string | null {
  const parsed = parseYouTube(input);
  return parsed ? toEmbedUrl(parsed) : null;
}
