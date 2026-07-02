// 検証窓シートから日本語技名を取得し JpCharacter[] を .context/import-framedata/jp.json へ書き出す。
//
// 取得戦略（.context/data-sources.md §3 / 補遺 全体）:
//   1. 確認済みgidがあれば gid で取得（ZSS/マリオ）
//   2. gid未確認は sheet=<URLエンコード日本語シート名> で取得（§3で実機成功の方式）
//   3. どちらもフォールバックの罠（HTTP200でもトップページが返る）があるため、
//      CSV先頭のキャラ名ラベルで実在検証。ラベル不一致/技名0なら失敗扱い。
//   4. 失敗した派生キャラ(derivedFrom)は元キャラの技名をコピー（source=derived）
//   5. それでも埋まらない（パルテナ等）は AI生成フォールバック（source=ai）
import { join } from "node:path";
import { fetchCached, writeJson, REPO_ROOT } from "./lib/http-cache.js";
import { parseJpCsv } from "./lib/parse-jp-csv.js";
import { ROSTER, type RosterEntry } from "./roster.js";
import { aiFallbackMoves } from "./lib/ai-fallback.js";
import type { JpCharacter, JpMove } from "./lib/types.js";

const SHEET_ID = "15SClMwvDIqovtO3DJnf1GGIteH35UX3IM7-mnbdG6eE";
const GVIZ = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;
const WORK_DIR = join(REPO_ROOT, ".context", "import-framedata");

/** キャラ名ラベルが期待キャラと一致するか（"1. マリオ" が "マリオ" を含む等） */
function labelMatches(label: string | null, entry: RosterEntry): boolean {
  if (!label) return false;
  // "トップページ" が返るフォールバックを弾く
  if (/トップページ/.test(label)) return false;
  // 期待タブ番号は sheetTab 先頭から取る（fighterNumber とズレるキャラがあるため）
  const tabNum = entry.sheetTab.match(/^(\d+)'?\./)?.[1];
  const numMatch = tabNum ? new RegExp(`^${tabNum}'?\\.`).test(label) : false;
  // 名前一致（ラベル側の番号プレフィックスを外して比較）
  const labelName = label.replace(/^\d+'?\.\s*/, "").trim();
  const nameMatch = label.includes(entry.nameJa) || entry.nameJa.includes(labelName) || labelName === entry.nameJa;
  return numMatch || nameMatch;
}

async function tryFetch(
  url: string,
  cacheName: string,
  entry: RosterEntry,
): Promise<JpMove[] | null> {
  let csv: string;
  try {
    csv = await fetchCached(url, cacheName);
  } catch {
    return null;
  }
  const { charLabel, moves } = parseJpCsv(csv);
  // フォールバックの罠検証: キャラ名ラベル一致 & 技名が取れたか
  if (!labelMatches(charLabel, entry)) return null;
  if (moves.length === 0) return null;
  return moves;
}

async function fetchOne(entry: RosterEntry): Promise<JpCharacter> {
  // 1. 確認済みgid
  if (entry.gid) {
    const moves = await tryFetch(`${GVIZ}&gid=${entry.gid}`, `jp/${entry.slug}.csv`, entry);
    if (moves) return { slug: entry.slug, source: "sheet", moves };
  }
  // 2. sheet=名前 方式
  const sheetParam = encodeURIComponent(entry.sheetTab);
  const moves = await tryFetch(`${GVIZ}&sheet=${sheetParam}`, `jp/${entry.slug}.csv`, entry);
  if (moves) return { slug: entry.slug, source: "sheet", moves };

  // 取得失敗 → derived / ai は呼び出し側で解決するためマーカーを返す
  return { slug: entry.slug, source: "ai", moves: [] };
}

async function main(): Promise<void> {
  console.log(`[fetch-jp] ${ROSTER.length} キャラの日本語技名を取得します`);
  const bySlug = new Map<string, JpCharacter>();

  // 第1パス: シート取得
  for (const entry of ROSTER) {
    const result = await fetchOne(entry);
    bySlug.set(entry.slug, result);
    const status = result.source === "sheet" ? `✓ moves=${result.moves.length}` : "✗ (要フォールバック)";
    console.log(`  ${entry.slug.padEnd(22)} ${status}`);
  }

  // 第2パス: 失敗キャラのフォールバック（derived → ai）
  for (const entry of ROSTER) {
    const cur = bySlug.get(entry.slug)!;
    if (cur.source === "sheet" && cur.moves.length > 0) continue;

    // derived: 元キャラがシート取得成功していれば技名コピー
    if (entry.derivedFrom) {
      const base = bySlug.get(entry.derivedFrom);
      if (base && base.source === "sheet" && base.moves.length > 0) {
        bySlug.set(entry.slug, { slug: entry.slug, source: "derived", moves: base.moves });
        console.log(`  ${entry.slug.padEnd(22)} → derived from ${entry.derivedFrom} (${base.moves.length}技)`);
        continue;
      }
    }
    // ai fallback
    const aiMoves = aiFallbackMoves();
    bySlug.set(entry.slug, { slug: entry.slug, source: "ai", moves: aiMoves });
    console.log(`  ${entry.slug.padEnd(22)} → AI生成フォールバック (${aiMoves.length}技)`);
  }

  const out = ROSTER.map((e) => bySlug.get(e.slug)!);
  await writeJson(join(WORK_DIR, "jp.json"), out);

  const bySource = { sheet: 0, derived: 0, ai: 0 };
  for (const c of out) bySource[c.source]++;
  console.log(
    `\n[fetch-jp] 完了: sheet=${bySource.sheet} derived=${bySource.derived} ai=${bySource.ai} → jp.json`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
