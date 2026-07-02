// UFDスクレイパー: 全89キャラページ + statsページを取得し、UfdCharacter[] を
// .context/import-framedata/ufd.json へ書き出す。
// 生HTMLは .context/raw-cache/ufd/ にキャッシュ（再実行時は再取得しない、ADR-0003）。
import { join } from "node:path";
import { fetchCached, writeJson, REPO_ROOT } from "./lib/http-cache.js";
import { parseUfdCharacter } from "./lib/parse-ufd.js";
import { ROSTER } from "./roster.js";
import type { UfdCharacter } from "./lib/types.js";

const UFD_BASE = "https://ultimateframedata.com/";
const WORK_DIR = join(REPO_ROOT, ".context", "import-framedata");

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const results: UfdCharacter[] = [];
  const problems: string[] = [];

  console.log(`[scrape-ufd] ${ROSTER.length} キャラを取得します（キャッシュ優先, --force で再取得）`);

  for (const entry of ROSTER) {
    const url = `${UFD_BASE}${entry.slug}`;
    let html: string;
    try {
      html = await fetchCached(url, `ufd/${entry.slug}.html`, { force });
    } catch (e) {
      problems.push(`FETCH FAIL ${entry.slug}: ${(e as Error).message}`);
      console.error(`  ✗ ${entry.slug}: ${(e as Error).message}`);
      continue;
    }
    const parsed = parseUfdCharacter(entry.slug, html);
    if (parsed.moves.length === 0) {
      problems.push(`NO MOVES ${entry.slug}: パース結果0技`);
    }
    results.push(parsed);
    const oosSummary = parsed.oos.map((o) => `${o.oosType}=${o.effectiveFrames}`).join(",");
    console.log(
      `  ✓ ${entry.slug.padEnd(22)} moves=${String(parsed.moves.length).padStart(2)} oos=[${oosSummary}]`,
    );
  }

  // statsページも取得（全キャラ横断OoS一覧、クロスチェック用）。パースは match/build 側で任意に使う。
  try {
    await fetchCached(`${UFD_BASE}stats`, "ufd/stats.html", { force });
    console.log("  ✓ stats ページ取得（クロスチェック用キャッシュ）");
  } catch (e) {
    problems.push(`FETCH FAIL stats: ${(e as Error).message}`);
  }

  await writeJson(join(WORK_DIR, "ufd.json"), results);
  if (problems.length) {
    await writeJson(join(WORK_DIR, "ufd-problems.json"), problems);
    console.log(`\n[scrape-ufd] 問題 ${problems.length}件 → ufd-problems.json`);
  }
  const totalMoves = results.reduce((s, c) => s + c.moves.length, 0);
  console.log(
    `\n[scrape-ufd] 完了: ${results.length}キャラ / ${totalMoves}技 → .context/import-framedata/ufd.json`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
