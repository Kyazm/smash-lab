// 最終出力ビルダー: ufd.json + name-matches.json → data/imported/{characters,moves,oos_options}.json
// フィールド名は supabase/migrations/0001_schema.sql の列と完全一致させる。
// REPORT.md に取込サマリー・スポットチェック・欠損統計・既知の問題を出力する。
//
// 手動オーバーライド: data/overrides/name-overrides.csv（character_slug, move_slug, name_ja）を
// 最後に適用する。再実行しても消えない人力修正層（監査対応 2026-07-03）。
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { REPO_ROOT, readJsonIfExists, writeJson } from "./lib/http-cache.js";
import { uuidv5 } from "./lib/uuid.js";
import { parseCsv } from "./lib/parse-jp-csv.js";
import { ROSTER, MAIN_SLUG } from "./roster.js";
import type { UfdCharacter, UfdMove, UfdOos } from "./lib/types.js";
import type { NameMatch } from "./lib/match-names.js";

const WORK_DIR = join(REPO_ROOT, ".context", "import-framedata");
const OUT_DIR = join(REPO_ROOT, "data", "imported");
const OVERRIDES_CSV = join(REPO_ROOT, "data", "overrides", "name-overrides.csv");

// 規則ベース導入前（順序マッチ主体）の needs_review 実績値。REPORT のビフォーアフター表示用。
const NEEDS_REVIEW_BASELINE = 687;

// docs/02 定義の extra_frames（oos_type別固定値）。実効発生 = moves.startup + extra_frames。
const EXTRA_FRAMES: Record<UfdOos["oosType"], number> = {
  aerial: 3,
  up_b: 0,
  up_smash: 0,
  grab: 4,
  shield_drop: 11,
};

// oos_type別の表示ラベル/間合い注記（fixtureの慣例に合わせる）
const OOS_LABEL: Record<UfdOos["oosType"], string> = {
  up_b: "上B",
  up_smash: "上スマ",
  aerial: "空中攻撃",
  grab: "つかみ",
  shield_drop: "ガード解除",
};
const OOS_RANGE: Record<UfdOos["oosType"], string | null> = {
  up_b: "密着限定",
  up_smash: "密着限定",
  aerial: "中距離可",
  grab: "密着限定",
  shield_drop: null,
};

interface OutCharacter {
  id: string;
  slug: string;
  name_ja: string;
  name_en: string;
  fighter_number: number | null;
  icon_url: string | null;
  is_main: boolean;
}
interface OutMove {
  id: string;
  character_id: string;
  slug: string;
  name_en: string | null;
  name_ja: string | null;
  category: string;
  startup: number | null;
  active: string | null;
  faf: number | null;
  on_shield: number | null;
  damage: number | null;
  notes: string | null;
  hitbox_img_url: string | null;
}
interface OutOos {
  id: string;
  move_id: string;
  oos_type: string;
  extra_frames: number;
  label: string | null;
  range_note: string | null;
}

/**
 * OoSのmoveNameEn を UfdMove に解決（aerial/grab/up_b/up_smash を具体技へ紐づけ）。
 * 複数候補（地上/空中版の上B等）がある場合は、startup+規定extra が UFDのOoS実効値に
 * 最も近い候補を選ぶ（監査対応: DK上B等の誤紐付け防止）。
 */
function resolveOosMove(oos: UfdOos, moves: UfdMove[]): UfdMove | null {
  const target = oos.moveNameEn.toLowerCase();
  const candidates = moves.filter((m) => {
    const n = m.nameEn.toLowerCase();
    if (oos.oosType === "up_b") return /up b|up special/.test(n);
    if (oos.oosType === "up_smash") return /up smash/.test(n);
    if (oos.oosType === "grab") return /^grab$/.test(n);
    if (oos.oosType === "aerial") {
      const key = target.replace(/\s+/g, " ");
      return n === key || n.includes(key) || key.includes(n);
    }
    return false;
  });
  if (candidates.length === 0) return null;

  const extra = EXTRA_FRAMES[oos.oosType];
  let best: UfdMove | null = null;
  let bestDiff = Infinity;
  for (const c of candidates) {
    if (c.startup == null) continue;
    const d = Math.abs(c.startup + extra - oos.effectiveFrames);
    if (d < bestDiff) {
      bestDiff = d;
      best = c;
    }
  }
  return best ?? candidates[0];
}

/** 手動オーバーライド読込（無ければ空）。key = "characterSlug::moveSlug" */
async function loadOverrides(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let text: string;
  try {
    text = await readFile(OVERRIDES_CSV, "utf8");
  } catch {
    return map;
  }
  const rows = parseCsv(text);
  for (const r of rows.slice(1)) {
    const [charSlug, moveSlug, nameJa] = r.map((c) => (c ?? "").trim());
    if (!charSlug || !moveSlug || !nameJa) continue;
    map.set(`${charSlug}::${moveSlug}`, nameJa);
  }
  return map;
}

async function main(): Promise<void> {
  const ufd = await readJsonIfExists<UfdCharacter[]>(join(WORK_DIR, "ufd.json"));
  const matches = await readJsonIfExists<NameMatch[]>(join(WORK_DIR, "name-matches.json"));
  if (!ufd) throw new Error("ufd.json が無い。先に scrape:ufd");
  if (!matches) throw new Error("name-matches.json が無い。先に match:names");

  const ufdBySlug = new Map(ufd.map((c) => [c.slug, c]));
  // name match を (slug, moveSlug) で引ける index に
  const jaBy = new Map<string, NameMatch>();
  for (const m of matches) jaBy.set(`${m.slug}::${m.moveSlug}`, m);

  const outChars: OutCharacter[] = [];
  const outMoves: OutMove[] = [];
  const outOos: OutOos[] = [];

  // 統計
  const missing = { startup: 0, active: 0, faf: 0, on_shield: 0, damage: 0, hitbox: 0, name_ja: 0 };
  const problems: string[] = [];
  const oosAdjustments: string[] = [];
  let oosLinkFail = 0;

  // 手動オーバーライド（最後に適用される人力修正層）
  const overrides = await loadOverrides();
  const usedOverrides = new Set<string>();

  for (const entry of ROSTER) {
    const u = ufdBySlug.get(entry.slug);
    if (!u) {
      problems.push(`UFDデータ欠落: ${entry.slug}`);
      continue;
    }
    const charId = uuidv5(`character:${entry.slug}`);
    outChars.push({
      id: charId,
      slug: entry.slug,
      name_ja: entry.nameJa,
      name_en: entry.nameEn,
      fighter_number: entry.fighterNumber,
      icon_url: null,
      is_main: entry.slug === MAIN_SLUG,
    });

    const moveIdByUfd = new Map<UfdMove, string>();
    for (const um of u.moves) {
      const moveId = uuidv5(`move:${entry.slug}:${um.slug}`);
      moveIdByUfd.set(um, moveId);
      const nm = jaBy.get(`${entry.slug}::${um.slug}`);
      let nameJa = nm?.nameJa ?? null;

      // 手動オーバーライド適用（最優先）
      const ovKey = `${entry.slug}::${um.slug}`;
      const ov = overrides.get(ovKey);
      if (ov !== undefined) {
        nameJa = ov;
        usedOverrides.add(ovKey);
      }

      if (um.startup == null) missing.startup++;
      if (um.active == null) missing.active++;
      if (um.faf == null) missing.faf++;
      if (um.onShield == null) missing.on_shield++;
      if (um.damage == null) missing.damage++;
      if (um.hitboxImgUrl == null) missing.hitbox++;
      if (nameJa == null) missing.name_ja++;

      outMoves.push({
        id: moveId,
        character_id: charId,
        slug: um.slug,
        name_en: um.nameEn,
        name_ja: nameJa,
        category: um.category,
        startup: um.startup,
        active: um.active,
        faf: um.faf,
        on_shield: um.onShield,
        damage: um.damage,
        notes: um.notes,
        hitbox_img_url: um.hitboxImgUrl,
      });
    }

    // OoS: UFDのoos一覧を具体技へ紐づけ、extra_frames は docs定義値。
    // shield_drop はUFDのoos一覧には基本無い（universal）ため、ダッシュ攻撃に紐づけて1件付与。
    const seenTypes = new Set<string>();
    for (const oos of u.oos) {
      const move = resolveOosMove(oos, u.moves);
      if (!move) {
        oosLinkFail++;
        continue;
      }
      const moveId = moveIdByUfd.get(move)!;
      let extra = EXTRA_FRAMES[oos.oosType];
      // クロスチェック: startup+extra が UFD実効値と±2F超乖離する場合はUFDのOoS値を正とし、
      // extra_frames = (UFD OoS値 − startup) に調整する（監査対応 2026-07-03。
      // 多段上B・特殊ジャンプ踏切キャラ等で docs 固定値が合わないケース）。
      if (move.startup != null) {
        const computed = move.startup + extra;
        if (Math.abs(computed - oos.effectiveFrames) > 2) {
          const adjusted = oos.effectiveFrames - move.startup;
          oosAdjustments.push(
            `${entry.slug} ${oos.oosType}(${move.nameEn}): extra_frames ${extra}→${adjusted}（UFD実効${oos.effectiveFrames}fを正として調整）`,
          );
          extra = adjusted;
        }
      }
      const oosId = uuidv5(`oos:${entry.slug}:${oos.oosType}:${move.slug}`);
      const typeKey = `${oos.oosType}:${move.slug}`;
      if (seenTypes.has(typeKey)) continue;
      seenTypes.add(typeKey);
      outOos.push({
        id: oosId,
        move_id: moveId,
        oos_type: oos.oosType,
        extra_frames: extra,
        label: OOS_LABEL[oos.oosType],
        range_note: OOS_RANGE[oos.oosType],
      });
    }
    // shield_drop を1件付与（ダッシュ攻撃があれば紐づけ、universal 11F）
    // 素の "Dash Attack" を優先（カズヤの Double Dash Attack 等の派生を代表にしない）
    const dash =
      u.moves.find((m) => m.category === "dash" && /^dash attack$/i.test(m.nameEn)) ??
      u.moves.find((m) => m.category === "dash");
    if (dash) {
      outOos.push({
        id: uuidv5(`oos:${entry.slug}:shield_drop:${dash.slug}`),
        move_id: moveIdByUfd.get(dash)!,
        oos_type: "shield_drop",
        extra_frames: EXTRA_FRAMES.shield_drop,
        label: OOS_LABEL.shield_drop,
        range_note: OOS_RANGE.shield_drop,
      });
    }
  }

  await writeJson(join(OUT_DIR, "characters.json"), outChars);
  await writeJson(join(OUT_DIR, "moves.json"), outMoves);
  await writeJson(join(OUT_DIR, "oos_options.json"), outOos);

  // ---- REPORT.md ----
  const total = outMoves.length;
  const withJa = outMoves.filter((m) => m.name_ja).length;
  const needsReview = matches.filter((m) => m.needsReview).length;
  const aiGen = matches.filter((m) => m.aiGenerated).length;
  const jpSourceCounts = { sheet: 0, derived: 0, ai: 0 };
  const jp = await readJsonIfExists<{ slug: string; source: keyof typeof jpSourceCounts }[]>(
    join(WORK_DIR, "jp.json"),
  );
  if (jp) for (const c of jp) jpSourceCounts[c.source]++;

  // 未適用オーバーライド（slug のタイポ等）を検出
  for (const key of overrides.keys()) {
    if (!usedOverrides.has(key)) {
      problems.push(`オーバーライド未適用（該当技なし）: ${key.replace("::", " / ")}`);
    }
  }

  // スポットチェック
  const spot = spotChecks(outChars, outMoves, outOos);

  const report = buildReport({
    charCount: outChars.length,
    moveCount: total,
    oosCount: outOos.length,
    withJa,
    jaCoverage: ((withJa / total) * 100).toFixed(1),
    needsReview,
    aiGen,
    jpSourceCounts,
    missing,
    oosLinkFail,
    oosAdjustments,
    overrideApplied: usedOverrides.size,
    overrideTotal: overrides.size,
    problems,
    spot,
  });
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(OUT_DIR, "REPORT.md"), report, "utf8");

  console.log(`[build-output] characters=${outChars.length} moves=${total} oos=${outOos.length}`);
  console.log(`  日本語カバレッジ=${((withJa / total) * 100).toFixed(1)}% needs_review=${needsReview} ai_generated=${aiGen}`);
  console.log(`  オーバーライド適用=${usedOverrides.size}/${overrides.size} OoS調整=${oosAdjustments.length}件`);
  console.log(`  → data/imported/{characters,moves,oos_options}.json + REPORT.md`);
  if (problems.length) console.log(`  ⚠ 問題 ${problems.length}件（REPORT.md参照）`);
}

// ---- スポットチェック ----
interface SpotResult {
  label: string;
  ok: boolean;
  detail: string;
}
function spotChecks(chars: OutCharacter[], moves: OutMove[], oos: OutOos[]): SpotResult[] {
  const out: SpotResult[] = [];

  // キャラ数 ~87前後
  out.push({
    label: "キャラ数が87前後",
    ok: chars.length >= 85 && chars.length <= 90,
    detail: `${chars.length}体`,
  });

  // マリオ弱1: 発生2 / ガード時-14
  const marioId = chars.find((c) => c.slug === "mario")?.id;
  const marioJab = moves.find((m) => m.character_id === marioId && m.slug === "jab-1");
  out.push({
    label: "マリオ弱1: 発生2/ガード時-14",
    ok: marioJab?.startup === 2 && marioJab?.on_shield === -14,
    detail: marioJab ? `発生${marioJab.startup}/on_shield${marioJab.on_shield}` : "技が見つからない",
  });

  // ZSS OoS: 上B実効6 / 掴み実効19（UFD原典）
  const zssId = chars.find((c) => c.slug === "zero_suit_samus")?.id;
  const zssMoves = moves.filter((m) => m.character_id === zssId);
  const zssMoveIds = new Set(zssMoves.map((m) => m.id));
  const zssOos = oos.filter((o) => zssMoveIds.has(o.move_id));
  const zssUpB = zssOos.find((o) => o.oos_type === "up_b");
  const zssUpBMove = zssMoves.find((m) => m.id === zssUpB?.move_id);
  const zssUpBEff = zssUpBMove?.startup != null && zssUpB ? zssUpBMove.startup + zssUpB.extra_frames : null;
  out.push({
    label: "ZSS 上B OoS実効=6（UFD原典）",
    ok: zssUpBEff === 6,
    detail: zssUpBEff != null ? `実効${zssUpBEff}f (startup${zssUpBMove?.startup}+extra${zssUpB?.extra_frames})` : "OoS未紐付け",
  });
  const zssGrab = zssOos.find((o) => o.oos_type === "grab");
  const zssGrabMove = zssMoves.find((m) => m.id === zssGrab?.move_id);
  const zssGrabEff = zssGrabMove?.startup != null && zssGrab ? zssGrabMove.startup + zssGrab.extra_frames : null;
  out.push({
    label: "ZSS 掴み OoS実効=19（UFD原典: 15+4）",
    ok: zssGrabEff === 19,
    detail: zssGrabEff != null ? `実効${zssGrabEff}f (startup${zssGrabMove?.startup}+extra${zssGrab?.extra_frames})` : "OoS未紐付け",
  });

  return out;
}

function buildReport(d: {
  charCount: number;
  moveCount: number;
  oosCount: number;
  withJa: number;
  jaCoverage: string;
  needsReview: number;
  aiGen: number;
  jpSourceCounts: { sheet: number; derived: number; ai: number };
  missing: Record<string, number>;
  oosLinkFail: number;
  oosAdjustments: string[];
  overrideApplied: number;
  overrideTotal: number;
  problems: string[];
  spot: SpotResult[];
}): string {
  const l: string[] = [];
  l.push("# import-framedata 取込サマリー");
  l.push("");
  l.push(`生成日時: ${new Date().toISOString()}`);
  l.push("");
  l.push("取込元: ultimateframedata.com (Ver.13.0.1) + 検証窓スプレッドシート（日本語技名）");
  l.push("方針: ADR-0003 / ADR-0006 / docs/03 Phase 1");
  l.push("");
  l.push("## 統計");
  l.push("");
  l.push(`- キャラ数: **${d.charCount}**`);
  l.push(`- 技数: **${d.moveCount}**`);
  l.push(`- OoS候補数: **${d.oosCount}**`);
  l.push(`- 日本語名カバレッジ: **${d.jaCoverage}%** (${d.withJa}/${d.moveCount})`);
  l.push(
    `- needs_review: **${d.needsReview}** 件（順序マッチ主体の旧方式: ${NEEDS_REVIEW_BASELINE}件 → 規則ベース生成導入で削減）`,
  );
  l.push(`- ai_generated: **${d.aiGen}** 件`);
  l.push(`- 手動オーバーライド適用: **${d.overrideApplied}** 件（定義 ${d.overrideTotal} 件）`);
  l.push("");
  l.push("### 日本語技名ソース内訳");
  l.push("");
  l.push(`- 検証窓シート実データ: ${d.jpSourceCounts.sheet} キャラ`);
  l.push(`- 派生キャラ（元キャラからコピー）: ${d.jpSourceCounts.derived} キャラ`);
  l.push(`- AI生成フォールバック: ${d.jpSourceCounts.ai} キャラ`);
  l.push("");
  l.push("### 欠損フィールド統計（全技中でnullの数）");
  l.push("");
  l.push("| フィールド | 欠損数 |");
  l.push("|---|---|");
  for (const [k, v] of Object.entries(d.missing)) l.push(`| ${k} | ${v} |`);
  l.push("");
  l.push("## スポットチェック（既知値との照合）");
  l.push("");
  l.push("| チェック | 結果 | 詳細 |");
  l.push("|---|---|---|");
  for (const s of d.spot) l.push(`| ${s.label} | ${s.ok ? "✅ OK" : "❌ NG"} | ${s.detail} |`);
  l.push("");
  l.push("## OoS extra_frames の個別調整");
  l.push("");
  if (d.oosAdjustments.length === 0) {
    l.push("- なし（全OoSが docs/02 固定値と±2F以内で一致）");
  } else {
    l.push(
      `UFDのOoS実効値と docs/02 固定 extra_frames の計算が±2F超乖離した ${d.oosAdjustments.length} 件は、`,
    );
    l.push("**UFD値を正として extra_frames = (UFD OoS実効値 − startup) に調整**した:");
    l.push("");
    for (const a of d.oosAdjustments) l.push(`- ${a}`);
  }
  l.push("");
  l.push("## 既知の問題・要確認");
  l.push("");
  if (d.oosLinkFail > 0) l.push(`- OoS紐付け失敗（対応技が見つからず除外）: ${d.oosLinkFail} 件`);
  if (d.problems.length === 0) {
    l.push("- 自動検出された異常なし");
  } else {
    l.push(`- 自動検出 ${d.problems.length} 件:`);
    for (const p of d.problems.slice(0, 60)) l.push(`  - ${p}`);
    if (d.problems.length > 60) l.push(`  - ...他 ${d.problems.length - 60} 件`);
  }
  l.push("");
  l.push("## 注記");
  l.push("");
  l.push("- ヒットボックス画像はURLのみ保存（ダウンロードせず）。Storageミラーは後工程。");
  l.push("- needs_review / ai_generated 行は data/imported/name-mapping.csv で確認可能。");
  l.push("- 日本語名の人力修正は data/overrides/name-overrides.csv に追記（再実行でも消えない）。");
  l.push("- OoS extra_frames は docs/02 定義の固定値（aerial=3/up_b=0/up_smash=0/grab=4/shield_drop=11）を");
  l.push("  基本とし、UFD実効値と±2F超乖離する場合のみ個別調整（上記「OoS extra_frames の個別調整」参照）。");
  l.push("");
  return l.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
