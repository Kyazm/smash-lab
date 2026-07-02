// AI生成フォールバック: 検証窓シートから日本語技名が取れないキャラ（パルテナ等）向けに、
// スマブラの一般的な日本語慣用名を canonical key ベースで供給する。
// これらは source=ai / needs_review 相当としてマークされ、後で人間確認する前提。
import { jpCanonical } from "./canonical-move.js";
import type { JpMove } from "./types.js";

// canonical key → 慣用日本語名。UFD側の canonical key と突合される。
const CANONICAL_JP: Record<string, { nameJa: string; section: string }> = {
  jab1: { nameJa: "弱攻撃（弱1）", section: "地上攻撃" },
  jab2: { nameJa: "弱攻撃（弱2）", section: "地上攻撃" },
  jab3: { nameJa: "弱攻撃（弱3）", section: "地上攻撃" },
  jab_rapid: { nameJa: "弱攻撃（百裂）", section: "地上攻撃" },
  dash: { nameJa: "ダッシュ攻撃", section: "地上攻撃" },
  ftilt: { nameJa: "横強攻撃", section: "地上攻撃" },
  utilt: { nameJa: "上強攻撃", section: "地上攻撃" },
  dtilt: { nameJa: "下強攻撃", section: "地上攻撃" },
  fsmash: { nameJa: "横スマッシュ攻撃", section: "地上攻撃" },
  usmash: { nameJa: "上スマッシュ攻撃", section: "地上攻撃" },
  dsmash: { nameJa: "下スマッシュ攻撃", section: "地上攻撃" },
  nair: { nameJa: "空中N攻撃", section: "空中攻撃" },
  fair: { nameJa: "空中前攻撃", section: "空中攻撃" },
  bair: { nameJa: "空中後ろ攻撃", section: "空中攻撃" },
  uair: { nameJa: "空中上攻撃", section: "空中攻撃" },
  dair: { nameJa: "空中下攻撃", section: "空中攻撃" },
  nb: { nameJa: "通常必殺技（NB）", section: "必殺ワザ" },
  sideb: { nameJa: "横必殺技（横B）", section: "必殺ワザ" },
  upb: { nameJa: "上必殺技（上B）", section: "必殺ワザ" },
  downb: { nameJa: "下必殺技（下B）", section: "必殺ワザ" },
  grab: { nameJa: "つかみ", section: "つかみ・投げ" },
  dashgrab: { nameJa: "ダッシュつかみ", section: "つかみ・投げ" },
  pivotgrab: { nameJa: "振り向きつかみ", section: "つかみ・投げ" },
  pummel: { nameJa: "つかみ攻撃", section: "つかみ・投げ" },
  fthrow: { nameJa: "前投げ", section: "投げ" },
  bthrow: { nameJa: "後ろ投げ", section: "投げ" },
  uthrow: { nameJa: "上投げ", section: "投げ" },
  dthrow: { nameJa: "下投げ", section: "投げ" },
};

/** canonical key に対する慣用日本語名を返す（無ければ null） */
export function jpNameForCanonical(key: string): string | null {
  return CANONICAL_JP[key]?.nameJa ?? null;
}

/**
 * AI生成フォールバック用の JpMove[] を全 canonical key 分そろえて返す。
 * matcher が canonical key で突合するので、順序補完には使わず canonical マッチ専用。
 */
export function aiFallbackMoves(): JpMove[] {
  let order = 0;
  return Object.entries(CANONICAL_JP).map(([, v]) => ({
    nameJa: v.nameJa,
    baseName: v.nameJa,
    variant: "",
    section: v.section,
    order: order++,
  }));
}

/** JpMove から canonical key を引く（jpCanonical のラッパ） */
export function jpMoveCanonical(m: JpMove): string | null {
  return jpCanonical(m.baseName, m.variant);
}
