// 英日技名の突合。UFD move（英語）に日本語名を割り当てる。
// 戦略:
//   1. canonical key 一致（jab1/ftilt/nair/nb/upb/grab/fthrow 等）= 高信頼
//   2. 未マッチは同カテゴリ内の出現順で JP 側の未使用技を割当 = 中信頼（needs_review）
//   3. それでも埋まらなければ canonical慣用名 / 生成名 = 低信頼（ai_generated）
import { ufdCanonical } from "./canonical-move.js";
import { jpMoveCanonical, jpNameForCanonical } from "./ai-fallback.js";
import type { UfdMove, JpCharacter, JpMove } from "./types.js";

// 回避（dodge）は全キャラ共通動作。検証窓シートの技名突合対象外だが、慣用日本語名は既知なので
// UFD英語名から機械生成する（source=derived相当の慣用名。needs_reviewは付けない=確立した訳語）。
function dodgeJpName(nameEn: string): string | null {
  const n = nameEn.toLowerCase();
  if (/spot dodge/.test(n)) return "その場回避";
  if (/forward roll/.test(n)) return "前転回避";
  if (/back(ward)? roll/.test(n)) return "後転回避";
  if (/neutral air ?dodge/.test(n)) return "空中回避（その場）";
  if (/air ?dodge.*down.*diagon|air ?dodge.*diagon.*down/.test(n)) return "空中回避（斜め下）";
  if (/air ?dodge.*up.*diagon|air ?dodge.*diagon.*up/.test(n)) return "空中回避（斜め上）";
  if (/air ?dodge.*down/.test(n)) return "空中回避（下）";
  if (/air ?dodge.*up/.test(n)) return "空中回避（上）";
  if (/air ?dodge.*(left|right)/.test(n)) return "空中回避（左右）";
  if (/air ?dodge/.test(n)) return "空中回避";
  return "回避";
}

// つかみ系（grabカテゴリ）も確立した慣用訳語。canonical key から機械生成する。
// 検証窓シートの つかみ・投げ には つかみ攻撃(pummel) しか無いことが多く、順序補完だと
// 素の Grab を pummel に誤対応させるため、grab系は canonical で確定させる。
const GRAB_JP: Record<string, string> = {
  grab: "つかみ",
  dashgrab: "ダッシュつかみ",
  pivotgrab: "振り向きつかみ",
  pummel: "つかみ攻撃",
};

export interface NameMatch {
  slug: string;
  moveSlug: string;
  nameEn: string;
  category: string;
  nameJa: string | null;
  /** high=canonical一致 / medium=順序補完 / low=慣用名生成 */
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  aiGenerated: boolean;
  method: "canonical" | "order" | "generated" | "derived_canonical";
}

// UFDカテゴリ → JPセクション（順序補完の対象セクションを絞る）
const CATEGORY_TO_SECTION: Record<string, string[]> = {
  jab: ["地上攻撃"],
  dash: ["地上攻撃"],
  tilt: ["地上攻撃"],
  smash: ["地上攻撃"],
  aerial: ["空中攻撃"],
  special: ["必殺ワザ"],
  grab: ["つかみ・投げ"],
  throw: ["投げ", "つかみ・投げ"],
  dodge: [], // 回避はシート突合対象外（UFD英語名のみ）
};

/**
 * 1キャラ分の突合。UFD moves（表示順）に日本語名を付与した NameMatch[] を返す。
 */
export function matchCharacter(
  slug: string,
  ufdMoves: UfdMove[],
  jp: JpCharacter,
): NameMatch[] {
  const results: NameMatch[] = [];

  // JP側を canonical index と section順キューに整理
  const jpByCanonical = new Map<string, JpMove>();
  const jpBySection = new Map<string, JpMove[]>();
  for (const jm of jp.moves) {
    const key = jpMoveCanonical(jm);
    if (key && !jpByCanonical.has(key)) jpByCanonical.set(key, jm);
    const list = jpBySection.get(jm.section) ?? [];
    list.push(jm);
    jpBySection.set(jm.section, list);
  }
  const usedJp = new Set<JpMove>();

  // 順序補完用のセクションカーソル
  const sectionCursor = new Map<string, number>();

  for (const um of ufdMoves) {
    const canon = ufdCanonical(um.nameEn);
    let nameJa: string | null = null;
    let confidence: NameMatch["confidence"] = "low";
    let method: NameMatch["method"] = "generated";

    // 0. 回避（共通動作）は慣用訳語を機械生成。確立した訳語なので high 扱い。
    if (um.category === "dodge") {
      const dj = dodgeJpName(um.nameEn);
      results.push({
        slug,
        moveSlug: um.slug,
        nameEn: um.nameEn,
        category: um.category,
        nameJa: dj,
        confidence: "high",
        needsReview: false,
        aiGenerated: false,
        method: "derived_canonical",
      });
      continue;
    }

    // 0.5 つかみ系の確立訳語（grab/dashgrab/pivotgrab/pummel）は canonical で確定。
    if (um.category === "grab" && canon && GRAB_JP[canon]) {
      results.push({
        slug,
        moveSlug: um.slug,
        nameEn: um.nameEn,
        category: um.category,
        nameJa: GRAB_JP[canon],
        confidence: "high",
        needsReview: false,
        aiGenerated: false,
        method: "derived_canonical",
      });
      continue;
    }

    // 1. canonical一致
    if (canon) {
      const jm = jpByCanonical.get(canon);
      if (jm && !usedJp.has(jm)) {
        nameJa = jm.nameJa;
        usedJp.add(jm);
        confidence = "high";
        method = jp.source === "sheet" ? "canonical" : "derived_canonical";
      }
    }

    // 2. 順序補完（同カテゴリのJPセクションから未使用を順に）
    if (!nameJa) {
      const sections = CATEGORY_TO_SECTION[um.category] ?? [];
      for (const sec of sections) {
        const list = jpBySection.get(sec) ?? [];
        let idx = sectionCursor.get(sec) ?? 0;
        while (idx < list.length && usedJp.has(list[idx])) idx++;
        if (idx < list.length) {
          nameJa = list[idx].nameJa;
          usedJp.add(list[idx]);
          sectionCursor.set(sec, idx + 1);
          confidence = "medium";
          method = "order";
          break;
        }
        sectionCursor.set(sec, idx);
      }
    }

    // 3. 慣用名生成（canonical key があれば慣用名、無ければ英語名から）
    if (!nameJa) {
      if (canon) {
        nameJa = jpNameForCanonical(canon);
        if (nameJa) {
          confidence = "low";
          method = "generated";
        }
      }
    }

    const aiGenerated = jp.source === "ai" || method === "generated";
    const needsReview = confidence !== "high" || jp.source !== "sheet";

    results.push({
      slug,
      moveSlug: um.slug,
      nameEn: um.nameEn,
      category: um.category,
      nameJa,
      confidence,
      needsReview,
      aiGenerated,
      method,
    });
  }

  return results;
}
