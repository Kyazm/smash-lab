// 世界戦闘力 → 段位（ランク）の正規化計算。
// 仕組み: 段位しきい値 = VIPボーダー × 段位指数（VIP到達=1.0基準）。世界戦闘力をボーダーで割った倍率が
// どの段位指数帯に入るかで段位が決まる。ボーダーの絶対値がインフレしても倍率で相対位置が安定する。
// 段位名・段位指数の定義は クマメイト(https://kumamate.net/vip/) 準拠。ボーダー実測値は手入力する（自動取得しない）。
export interface VipRank {
  name: string;
  /** VIP到達=1.0 を基準とした段位指数。 */
  index: number;
}

// 上位（指数大）→下位（指数小）順。rankFromGsp は上から最初にマッチした段位を返す。
export const VIP_RANKS: VipRank[] = [
  { name: "桜井", index: 1.105 },
  { name: "神(3)", index: 1.1036 },
  { name: "神(2)", index: 1.1023 },
  { name: "神(1)", index: 1.101 },
  { name: "宇宙最強", index: 1.099 },
  { name: "地元最強", index: 1.097 },
  { name: "魔境卒業", index: 1.095 },
  { name: "魔境Lv.5", index: 1.093 },
  { name: "魔境Lv.4", index: 1.09 },
  { name: "魔境Lv.3", index: 1.087 },
  { name: "魔境Lv.2", index: 1.084 },
  { name: "魔境Lv.1", index: 1.081 },
  { name: "魔境まであと2-3勝", index: 1.076 },
  { name: "VIP街道爆進", index: 1.054 },
  { name: "一人前VIP", index: 1.046 },
  { name: "VIP不安定層", index: 1.039 },
  { name: "VIP入りたて", index: 1.011 },
  { name: "VIP到達！", index: 1.0 },
  { name: "VIPまでラストスパート", index: 0.9 },
  { name: "VIPの階段登る", index: 0.8 },
  { name: "未VIP修行ゾーン（上）", index: 0.7 },
  { name: "未VIP修行ゾーン（中）", index: 0.6 },
  { name: "未VIP修行ゾーン（下）", index: 0.5 },
  { name: "VIPに向けた発射台", index: 0.4 },
  { name: "未VIPカオス（上）", index: 0.3 },
  { name: "未VIPカオス（中）", index: 0.2 },
  { name: "未VIPカオス（下）", index: 0.1 },
  { name: "未VIP発射台", index: 0 },
];

/** プリセットの推定VIPボーダー（手入力の初期値）。実際は日々変動するため、UIで上書き・保存できる。 */
export const DEFAULT_VIP_BORDER = 14763511;
export const VIP_BORDER_AS_OF = "2026-07-02";

export interface VipRankResult {
  rank: VipRank;
  /** 世界戦闘力 ÷ ボーダー の倍率。 */
  ratio: number;
  /** VIP到達(指数>=1.0)か。 */
  isVip: boolean;
}

/** 世界戦闘力とボーダーから段位を求める。入力が不正なら null。 */
export function rankFromGsp(gsp: number, border: number): VipRankResult | null {
  if (!Number.isFinite(gsp) || !Number.isFinite(border) || gsp <= 0 || border <= 0) return null;
  const ratio = gsp / border;
  // VIP_RANKS は降順。ratio 以上の指数のうち最上位（最初にマッチ）を採用。0以上なら必ず最下位にマッチする。
  const rank = VIP_RANKS.find((r) => ratio >= r.index) ?? VIP_RANKS[VIP_RANKS.length - 1];
  return { rank, ratio, isVip: rank.index >= 1.0 };
}
