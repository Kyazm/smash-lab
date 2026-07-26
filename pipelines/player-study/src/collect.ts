// collect: smash-tube 検索を取得・パースして study_videos へ投入する（--dry は JSON 出力のみ）。
//   npm run collect -- --player Marss --char ゼロスーツサムス [--pages N] [--dry]
// LLM 呼び出しは含まない（ADR-0020）。HTML は .context/player-study/catalog-cache にキャッシュ。
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CATALOG_CACHE_DIR, MAIN_REPO_ENV_PATH, WORK_ROOT } from "./config.js";
import {
  fetchCatalogPage,
  parseCatalogHtml,
  parsePagination,
  type CatalogRaw,
} from "./lib/catalog.js";
import { normalizeChar } from "./lib/char-normalize.js";
import { loadEnvFileOptional } from "./lib/load-env.js";
import { parseMatchTitle, resolveMatchup } from "./lib/title-parse.js";
import { insertCatalog, type StudyVideoInsert, type SupabaseConfig } from "./lib/supabase-client.js";

interface CollectArgs {
  player: string;
  char: string;
  pages: number;
  dry: boolean;
}

function parseArgs(argv: string[]): CollectArgs {
  function valueOf(flag: string): string | null {
    const i = argv.indexOf(flag);
    if (i === -1) return null;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${flag} に値を指定してください`);
    return v;
  }
  const player = valueOf("--player");
  const char = valueOf("--char");
  if (!player) throw new Error("--player は必須です（例: --player Marss）");
  if (!char) throw new Error("--char は必須です（例: --char ゼロスーツサムス）");
  const pagesRaw = valueOf("--pages");
  const pages = pagesRaw ? Math.max(1, Number.parseInt(pagesRaw, 10)) : 1;
  if (!Number.isFinite(pages)) throw new Error("--pages は整数で指定してください");
  return { player, char, pages, dry: argv.includes("--dry") };
}

function sanitize(s: string): string {
  const alnum = s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (alnum) return alnum;
  // 日本語のみ等で英数字が残らない場合は、文字コード由来の短いハッシュで一意化（衝突回避）
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `jp${h.toString(16)}`;
}

function toRow(raw: CatalogRaw, player: string, studiedChar: string): StudyVideoInsert {
  const parsed = parseMatchTitle(raw.title);
  const resolved = resolveMatchup(parsed, player);
  // studied 側キャラがCLI指定と食い違う（例: Marss が ZSS 以外を使用）場合も needs_review
  const charMismatch =
    resolved.studiedCharRaw !== null &&
    normalizeChar(resolved.studiedCharRaw) !== studiedChar;
  const needs_review = resolved.needsReview || charMismatch || !parsed.ok;
  return {
    video_id: raw.video_id,
    source: "smash-tube",
    title: raw.title,
    tournament: parsed.tournament,
    round: parsed.round,
    studied_player: player,
    studied_char: studiedChar,
    opp_player: resolved.oppPlayer,
    opp_chars_hint: resolved.oppCharsHint,
    played_on: raw.played_on,
    needs_review,
    status: "cataloged",
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const studiedChar = normalizeChar(args.char);
  console.log(
    `[collect] player=${args.player} char="${args.char}"→"${studiedChar}" pages=${args.pages} dry=${args.dry}`,
  );

  await mkdir(CATALOG_CACHE_DIR, { recursive: true });

  // page 1 でページネーションを把握してから必要枚数だけ取得
  const rows: StudyVideoInsert[] = [];
  let totalPages = args.pages;
  for (let page = 1; page <= Math.min(args.pages, totalPages); page++) {
    let fetched;
    try {
      fetched = await fetchCatalogPage(args.player, args.char, page, { cacheDir: CATALOG_CACHE_DIR });
    } catch (e) {
      console.error(`[collect] page ${page} 取得失敗: ${(e as Error).message}`);
      if (page === 1) {
        console.error(
          "[collect] 1ページ目から取得できないため中断。手動でHTMLを保存して catalog-cache に置く運用へフォールバック可能。",
        );
        process.exit(1);
      }
      break;
    }
    if (page === 1) {
      const pag = parsePagination(fetched.html);
      if (pag) {
        totalPages = pag.totalPages;
        console.log(
          `[collect] 総 ${pag.total} 件 / ${pag.totalPages} ページ（${fetched.fromCache ? "cache" : "fetch"}）`,
        );
      }
    }
    const parsed = parseCatalogHtml(fetched.html);
    console.log(
      `[collect] page ${page}: ${parsed.length} 件（${fetched.fromCache ? "cache" : "fetch"} ${fetched.cachePath}）`,
    );
    for (const raw of parsed) rows.push(toRow(raw, args.player, studiedChar));
  }

  // 全ページ横断で video_id 重複を除去（初出優先）
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.video_id) ? false : (seen.add(r.video_id), true)));
  const needsReview = unique.filter((r) => r.needs_review).length;
  console.log(`[collect] ユニーク ${unique.length} 件（needs_review ${needsReview} 件）`);

  if (args.dry) {
    await mkdir(WORK_ROOT, { recursive: true });
    const outPath = join(WORK_ROOT, `catalog-dry-${sanitize(args.player)}-${sanitize(args.char)}.json`);
    await writeFile(outPath, JSON.stringify(unique, null, 2), "utf-8");
    console.log(`[collect --dry] DB書込なし。パース結果を出力: ${outPath}`);
    // サンプル表示（先頭5件）
    for (const r of unique.slice(0, 5)) {
      console.log(
        `  ${r.video_id} | ${r.opp_chars_hint.join("/") || "?"} | ${r.round ?? "-"} | ` +
          `${r.played_on ?? "-"} | needs_review=${r.needs_review}`,
      );
    }
    return;
  }

  // 通常: DB 投入（video_id 重複は on_conflict でスキップ）
  const env = await loadEnvFileOptional(MAIN_REPO_ENV_PATH);
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      `SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が ${MAIN_REPO_ENV_PATH} に見つかりません（--dry ならDB不要）`,
    );
  }
  const cfg: SupabaseConfig = { url: supabaseUrl, serviceRoleKey };
  const inserted = await insertCatalog(cfg, unique);
  console.log(`[collect] study_videos へ ${inserted.length} 件 INSERT（重複 ${unique.length - inserted.length} 件スキップ）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
