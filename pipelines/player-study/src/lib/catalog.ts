// smash-tube 検索結果 HTML の収集（IO）とパース（純関数）。
// 調査済みの実 DOM:
//   各動画は <div class="rsg"> ... </div> ブロック。ブロック内に
//     data-video="<11桁ID>"、data-fulltitle="…"（無ければ data-title）、
//     <div class="Pdate"><p>YYYY-MM-DD </p></div> の日付。
//   ※ 設計 v2 は日付を属性 sld_date と想定していたが、現行 HTML は .Pdate テキスト。
//     属性 sld_date も一応フォールバックで拾う（将来の表記変更に耐える）。
//   ページネーションは "N件の動画が見つかりました（P / T）"。
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  BROWSER_USER_AGENT,
  REQUEST_DELAY_MS,
  SMASH_TUBE_BASE,
  SMASH_TUBE_REFERER,
} from "../config.js";

export interface CatalogRaw {
  video_id: string;
  title: string;
  played_on: string | null; // YYYY-MM-DD or null
}

const VIDEO_ID_RE = /data-video="([A-Za-z0-9_-]{11})"/;
const FULLTITLE_RE = /data-fulltitle="([^"]*)"/;
const TITLE_RE = /data-title="([^"]*)"/;
const PDATE_RE = /class="Pdate">\s*<p>\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/;
const SLD_DATE_RE = /sld_date="?([0-9]{4}-[0-9]{2}-[0-9]{2})/;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'");
}

/** 検索結果 HTML から動画エントリ配列を抽出する（純関数）。video_id 重複は初出のみ。 */
export function parseCatalogHtml(html: string): CatalogRaw[] {
  const blocks = html.split('<div class="rsg">').slice(1);
  const seen = new Set<string>();
  const out: CatalogRaw[] = [];
  for (const block of blocks) {
    const vid = block.match(VIDEO_ID_RE);
    if (!vid) continue;
    const video_id = vid[1];
    if (seen.has(video_id)) continue;
    const titleMatch = block.match(FULLTITLE_RE) ?? block.match(TITLE_RE);
    const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";
    const dateMatch = block.match(PDATE_RE) ?? block.match(SLD_DATE_RE);
    const played_on = dateMatch ? dateMatch[1] : null;
    seen.add(video_id);
    out.push({ video_id, title, played_on });
  }
  return out;
}

export interface Pagination {
  total: number;
  page: number;
  totalPages: number;
}

/** "185件の動画が見つかりました（1 / 19）" からページネーション情報を得る（純関数）。 */
export function parsePagination(html: string): Pagination | null {
  const m = html.match(/([0-9,]+)\s*件の動画が見つかりました（\s*([0-9]+)\s*\/\s*([0-9]+)\s*）/);
  if (!m) return null;
  return {
    total: Number(m[1].replace(/,/g, "")),
    page: Number(m[2]),
    totalPages: Number(m[3]),
  };
}

/** 収集リクエストの URL を組み立てる（純関数）。 */
export function buildCatalogUrl(player: string, char: string, page: number): string {
  const params = new URLSearchParams({
    player1: player,
    character1: char,
    page_id: String(page),
  });
  return `${SMASH_TUBE_BASE}?${params.toString()}`;
}

function cacheKey(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface FetchResult {
  html: string;
  fromCache: boolean;
  url: string;
  cachePath: string;
}

/**
 * 検索結果ページを取得する。キャッシュ（<cacheDir>/<hash>.html）があれば再取得しない。
 * キャッシュミス時のみ delayMs スリープしてから、ブラウザ相当 UA + Referer で取得しキャッシュする。
 * 403/非200 は Error（呼び出し側で報告）。
 */
export async function fetchCatalogPage(
  player: string,
  char: string,
  page: number,
  opts: { cacheDir: string; delayMs?: number },
): Promise<FetchResult> {
  const url = buildCatalogUrl(player, char, page);
  const cachePath = join(opts.cacheDir, `${cacheKey(url)}.html`);

  try {
    const cached = await readFile(cachePath, "utf-8");
    return { html: cached, fromCache: true, url, cachePath };
  } catch {
    // キャッシュなし → 取得
  }

  await sleep(opts.delayMs ?? REQUEST_DELAY_MS);
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_USER_AGENT,
      Referer: SMASH_TUBE_REFERER,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(
      `smash-tube 取得失敗: HTTP ${res.status} ${res.statusText} (${url})` +
        (res.status === 403 ? " — UA/Referer では通らない。手動HTML貼付フォールバックへ" : ""),
    );
  }
  const html = await res.text();
  await mkdir(opts.cacheDir, { recursive: true });
  await writeFile(cachePath, html, "utf-8");
  return { html, fromCache: false, url, cachePath };
}
