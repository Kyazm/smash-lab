// 英日技名突合を実行し、data/imported/name-mapping.csv を出力する。
// ufd.json（英語フレームデータ）と jp.json（日本語技名）を突合。
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { REPO_ROOT, readJsonIfExists, writeJson } from "./lib/http-cache.js";
import { matchCharacter, type NameMatch } from "./lib/match-names.js";
import { ROSTER } from "./roster.js";
import type { UfdCharacter, JpCharacter } from "./lib/types.js";

const WORK_DIR = join(REPO_ROOT, ".context", "import-framedata");
const OUT_DIR = join(REPO_ROOT, "data", "imported");

function csvCell(v: string | null | boolean): string {
  const s = v === null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main(): Promise<void> {
  const ufd = await readJsonIfExists<UfdCharacter[]>(join(WORK_DIR, "ufd.json"));
  const jp = await readJsonIfExists<JpCharacter[]>(join(WORK_DIR, "jp.json"));
  if (!ufd) throw new Error("ufd.json が無い。先に scrape:ufd を実行");
  if (!jp) throw new Error("jp.json が無い。先に fetch:jp を実行");

  const ufdBySlug = new Map(ufd.map((c) => [c.slug, c]));
  const jpBySlug = new Map(jp.map((c) => [c.slug, c]));

  const allMatches: NameMatch[] = [];
  for (const entry of ROSTER) {
    const u = ufdBySlug.get(entry.slug);
    if (!u) continue;
    const j = jpBySlug.get(entry.slug) ?? { slug: entry.slug, source: "ai" as const, moves: [] };
    allMatches.push(...matchCharacter(entry.slug, u.moves, j));
  }

  // CSV出力
  const header = [
    "slug",
    "move_slug",
    "name_en",
    "category",
    "name_ja",
    "confidence",
    "needs_review",
    "ai_generated",
    "method",
  ];
  const lines = [header.join(",")];
  for (const m of allMatches) {
    lines.push(
      [
        csvCell(m.slug),
        csvCell(m.moveSlug),
        csvCell(m.nameEn),
        csvCell(m.category),
        csvCell(m.nameJa),
        csvCell(m.confidence),
        csvCell(m.needsReview),
        csvCell(m.aiGenerated),
        csvCell(m.method),
      ].join(","),
    );
  }
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, "name-mapping.csv"), lines.join("\n") + "\n", "utf8");

  // build-output 用に JSON でも中間保存
  await writeJson(join(WORK_DIR, "name-matches.json"), allMatches);

  // 統計
  const total = allMatches.length;
  const high = allMatches.filter((m) => m.confidence === "high").length;
  const medium = allMatches.filter((m) => m.confidence === "medium").length;
  const low = allMatches.filter((m) => m.confidence === "low").length;
  const noJa = allMatches.filter((m) => !m.nameJa).length;
  const needsReview = allMatches.filter((m) => m.needsReview).length;
  const aiGen = allMatches.filter((m) => m.aiGenerated).length;

  console.log(`[match-names] ${total}技を突合:`);
  console.log(`  high(canonical)=${high} medium(order)=${medium} low(generated)=${low}`);
  console.log(`  日本語名なし=${noJa} needs_review=${needsReview} ai_generated=${aiGen}`);
  console.log(`  日本語カバレッジ=${(((total - noJa) / total) * 100).toFixed(1)}%`);
  console.log(`  → data/imported/name-mapping.csv`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
