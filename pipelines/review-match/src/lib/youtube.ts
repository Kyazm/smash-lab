// YouTube URL / タイムスタンプの純粋パーサ（dry-run CLI 用）。依存なし。
// web 側 youtube.ts（mm:ss パーサ）とは別実装（そちらは W2-B の凍結対象）。

/** YouTube URL から videoId を抽出する。取れない場合は URL をサニタイズした短い代替IDを返す。 */
export function parseVideoId(url: string): string {
  // youtu.be/<id>
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (short) return short[1];
  // youtube.com/watch?v=<id> / shorts/<id> / embed/<id> / live/<id>
  const v = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (v) return v[1];
  const path = url.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{6,})/);
  if (path) return path[1];
  // フォールバック: 英数字だけ残して短縮
  const fallback = url.replace(/[^A-Za-z0-9]/g, "").slice(-11);
  return fallback || "video";
}

/** "93,210" や "1:33,3:30" を秒配列に変換する。空・不正トークンは弾く。 */
export function parseTimestampList(raw: string): number[] {
  const out: number[] = [];
  for (const token of raw.split(",")) {
    const t = token.trim();
    if (!t) continue;
    const sec = parseTimeToken(t);
    if (sec === null) {
      throw new Error(`不正なタイムスタンプ: "${t}"（例: 93 または 1:33）`);
    }
    out.push(sec);
  }
  if (out.length === 0) {
    throw new Error("タイムスタンプが空です（--t 93,210 のように指定）");
  }
  return out;
}

/** 秒数(93 / 93.5) または mm:ss / h:mm:ss を秒に変換。不正は null。 */
export function parseTimeToken(token: string): number | null {
  if (token.includes(":")) {
    const parts = token.split(":");
    if (parts.length < 2 || parts.length > 3) return null;
    let total = 0;
    for (const p of parts) {
      if (!/^\d+(?:\.\d+)?$/.test(p.trim())) return null;
      total = total * 60 + Number(p.trim());
    }
    return total;
  }
  if (!/^\d+(?:\.\d+)?$/.test(token)) return null;
  return Number(token);
}
