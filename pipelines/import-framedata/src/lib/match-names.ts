// 英日技名の突合。UFD move（英語）に日本語名を割り当てる。
//
// 監査対応（2026-07-03）: 弱/強/スマッシュ/空中/ダッシュ/つかみ/投げ/回避は英語側の
// カテゴリとスロットで技種が確定するため、検証窓との順序マッチをやめ規則ベースで機械生成する。
// 検証窓の順序マッチは必殺技・派生技など固有名が必要なものに限定する。
// 戦略:
//   0. dodge / スロット確定技 → 規則ベース日本語名（rule）= 高信頼・review不要
//      （未訳の英語修飾が残る場合のみ needs_review）
//   1. 必殺技の canonical key 一致（nb/sideb/upb/downb）= 高信頼（シート固有名を採用）
//   2. 必殺派生技は 必殺ワザ セクション内の出現順で補完 = 中信頼（needs_review）
//   3. それでも埋まらなければ慣用名生成 = 低信頼（ai_generated）
import { ufdCanonical, ufdCanonicalWithRest } from "./canonical-move.js";
import { jpMoveCanonical, jpNameForCanonical } from "./ai-fallback.js";
import type { UfdMove, JpCharacter, JpMove } from "./types.js";

export interface NameMatch {
  slug: string;
  moveSlug: string;
  nameEn: string;
  category: string;
  nameJa: string | null;
  /** high=規則生成/canonical一致 / medium=順序補完 / low=慣用名生成・不明 */
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  aiGenerated: boolean;
  method: "rule" | "canonical" | "order" | "generated" | "derived_canonical" | "unmatched";
}

// ---- 規則ベース日本語名（スロット確定技） ----

// canonical key → 規則ベース日本語名。jabN は動的生成。
const RULE_JP: Record<string, string> = {
  jab: "弱攻撃",
  jab_rapid: "百裂攻撃",
  jab_rapid_finisher: "百裂フィニッシュ",
  dash: "ダッシュ攻撃",
  ftilt: "横強",
  utilt: "上強",
  dtilt: "下強",
  fsmash: "横スマ",
  usmash: "上スマ",
  dsmash: "下スマ",
  nair: "空N",
  fair: "空前",
  bair: "空後",
  uair: "空上",
  dair: "空下",
  zair: "ワイヤー空中攻撃",
  grab: "つかみ",
  dashgrab: "ダッシュつかみ",
  pivotgrab: "振り向きつかみ",
  pummel: "つかみ攻撃",
  fthrow: "前投げ",
  bthrow: "後投げ",
  uthrow: "上投げ",
  dthrow: "下投げ",
};

function ruleBaseName(key: string): string | null {
  const jabN = key.match(/^jab(\d+)$/);
  if (jabN) return `弱${jabN[1]}`;
  return RULE_JP[key] ?? null;
}

// 英語修飾語 → 日本語。既知の修飾のみ訳し、未知はそのまま英語で残して needs_review。
const QUALIFIER_JP: Record<string, string> = {
  luma: "チコ",
  grounded: "地上",
  aerial: "空中",
  air: "空中",
  "up angled": "上シフト",
  "angled up": "上シフト",
  "down angled": "下シフト",
  "angled down": "下シフト",
  light: "弱",
  heavy: "強",
  close: "近",
  far: "遠",
  cargo: "リフティング",
  dragon: "ドラゴン",
  "power dragon": "パワードラゴン",
  ramram: "ラムラム",
  megawatt: "メガワット",
  laser: "レーザー",
};

/** rest（英語修飾）を訳す。戻り値: { text, translated（全トークン訳せたか） } */
function translateQualifier(rest: string): { text: string; translated: boolean } {
  if (!rest) return { text: "", translated: true };
  // 純数字（多段技番号）はそのまま
  if (/^\d+$/.test(rest)) return { text: rest, translated: true };
  // 全体一致を優先（"Power Dragon" 等の複合語）
  const whole = QUALIFIER_JP[rest.toLowerCase()];
  if (whole) return { text: whole, translated: true };
  const tokens = rest
    .split(/\s*[,/]\s*/)
    .map((t) => t.trim())
    .filter(Boolean);
  let allTranslated = true;
  const out = tokens.map((t) => {
    const ja = QUALIFIER_JP[t.toLowerCase()];
    if (ja) return ja;
    if (/^\d+$/.test(t)) return t;
    allTranslated = false;
    return t;
  });
  return { text: out.join("・"), translated: allTranslated };
}

/** 規則ベース名を組み立てる（例: ftilt + "Up Angled" → 横強（上シフト））。 */
function buildRuleName(key: string, rest: string): { nameJa: string; reviewed: boolean } | null {
  const base = ruleBaseName(key);
  if (!base) return null;
  if (!rest) return { nameJa: base, reviewed: false };
  const q = translateQualifier(rest);
  // 純数字は直結（空前2 等）、それ以外は（）付き
  const nameJa = /^\d+$/.test(q.text) ? `${base}${q.text}` : `${base}（${q.text}）`;
  return { nameJa, reviewed: !q.translated };
}

// 回避（dodge）は全キャラ共通動作。慣用訳語をUFD英語名から機械生成。
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

// 規則ベース生成の対象カテゴリ（special と dodge 以外の全カテゴリ）
const RULE_CATEGORIES = new Set(["jab", "dash", "tilt", "smash", "aerial", "grab", "throw"]);

/**
 * 1キャラ分の突合。UFD moves（表示順）に日本語名を付与した NameMatch[] を返す。
 * jp（検証窓シート）は必殺技の固有名にのみ使う。
 */
export function matchCharacter(
  slug: string,
  ufdMoves: UfdMove[],
  jp: JpCharacter,
): NameMatch[] {
  const results: NameMatch[] = [];

  // JP側: 必殺技 canonical index と 必殺ワザ セクションの順序リスト
  const jpByCanonical = new Map<string, JpMove>();
  const jpSpecials: JpMove[] = [];
  for (const jm of jp.moves) {
    const key = jpMoveCanonical(jm);
    if (key && !jpByCanonical.has(key)) jpByCanonical.set(key, jm);
    if (jm.section === "必殺ワザ") jpSpecials.push(jm);
  }
  const usedJp = new Set<JpMove>();
  let specialCursor = 0;

  for (const um of ufdMoves) {
    // 0a. 回避: 慣用訳語を機械生成
    if (um.category === "dodge") {
      results.push({
        slug,
        moveSlug: um.slug,
        nameEn: um.nameEn,
        category: um.category,
        nameJa: dodgeJpName(um.nameEn),
        confidence: "high",
        needsReview: false,
        aiGenerated: false,
        method: "rule",
      });
      continue;
    }

    // 0b. スロット確定技: 規則ベース日本語名を機械生成（順序マッチしない）
    if (RULE_CATEGORIES.has(um.category)) {
      const cm = ufdCanonicalWithRest(um.nameEn);
      const built = cm ? buildRuleName(cm.key, cm.rest) : null;
      if (built) {
        results.push({
          slug,
          moveSlug: um.slug,
          nameEn: um.nameEn,
          category: um.category,
          nameJa: built.nameJa,
          confidence: "high",
          needsReview: built.reviewed,
          aiGenerated: false,
          method: "rule",
        });
      } else {
        // canonical 不明（カズヤ固有技/Olimarつかみ比較等）→ 名前なし・要レビュー
        // （オーバーライド data/overrides/name-overrides.csv で人力補完する）
        results.push({
          slug,
          moveSlug: um.slug,
          nameEn: um.nameEn,
          category: um.category,
          nameJa: null,
          confidence: "low",
          needsReview: true,
          aiGenerated: false,
          method: "unmatched",
        });
      }
      continue;
    }

    // ---- special: シート固有名を使う ----
    const canon = ufdCanonical(um.nameEn);
    let nameJa: string | null = null;
    let confidence: NameMatch["confidence"] = "low";
    let method: NameMatch["method"] = "generated";
    let needsReview = true;
    let aiGenerated = false;

    // 1. canonical一致（NB/横B/上B/下B の基幹行）
    if (canon) {
      const jm = jpByCanonical.get(canon);
      if (jm && !usedJp.has(jm)) {
        nameJa = jm.nameJa;
        usedJp.add(jm);
        confidence = "high";
        method = jp.source === "sheet" ? "canonical" : "derived_canonical";
        needsReview = jp.source !== "sheet";
      }
    }

    // 2. 順序補完（必殺ワザ セクションの未使用行を順に）
    if (!nameJa) {
      while (specialCursor < jpSpecials.length && usedJp.has(jpSpecials[specialCursor])) {
        specialCursor++;
      }
      if (specialCursor < jpSpecials.length) {
        const jm = jpSpecials[specialCursor];
        nameJa = jm.nameJa;
        usedJp.add(jm);
        specialCursor++;
        confidence = "medium";
        method = "order";
        needsReview = true;
      }
    }

    // 3. 慣用名生成
    if (!nameJa && canon) {
      nameJa = jpNameForCanonical(canon);
      if (nameJa) {
        confidence = "low";
        method = "generated";
        needsReview = true;
        aiGenerated = true;
      }
    }
    if (!nameJa) {
      method = "unmatched";
    }

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
