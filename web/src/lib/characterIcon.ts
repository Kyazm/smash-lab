// キャラアイコンの外部参照URLを算出する純関数（B: 外部参照・再配布しない）。
// 自リポジトリ/バケットには画像を置かず、表示時に外部CDN(jsDelivr)を img src で参照(hotlink)する。
// 実在は curl で 200 + image/* を検証済み（.context/character-icons.md）。
// characters.json / DB は変更せず、slug から実行時に算出する。
// 404/障害時は呼び出し側(img onError)でカタカナ頭文字チップにフォールバックする前提。
import type { Character } from "../types";

// 主ソース: marcrd/smash-ultimate-assets @0.1.1 の stock-icons/png（小さな頭アイコン、~32KB）。
const MARCRD_BASE =
  "https://cdn.jsdelivr.net/gh/marcrd/smash-ultimate-assets@0.1.1/stock-icons/png";
// 副ソース: rubendal/ssbu の characters（DLC・ポケモントレーナー分離など主ソースに無いキャラ用）。
const RUBENDAL_BASE = "https://cdn.jsdelivr.net/gh/rubendal/ssbu@master/src/assets/img/characters";

// 主ソース(marcrd)に直接キーが存在する slug（v0.1.1 stock-icons/png、73体）。
const MARCRD_KEYS = new Set<string>([
  "bayonetta", "bowser", "bowser_jr", "captain_falcon", "chrom", "cloud", "corrin", "daisy",
  "dark_pit", "dark_samus", "diddy_kong", "donkey_kong", "dr_mario", "duck_hunt", "falco", "fox",
  "ganondorf", "greninja", "ice_climbers", "ike", "incineroar", "inkling", "isabelle", "jigglypuff",
  "ken", "king_dedede", "king_k_rool", "kirby", "link", "little_mac", "lucario", "lucas", "lucina",
  "luigi", "mario", "marth", "mega_man", "meta_knight", "mewtwo", "mii_fighter", "mr_game_and_watch",
  "ness", "olimar", "pac_man", "palutena", "peach", "pichu", "pikachu", "piranha_plant", "pit",
  "pokemon_trainer", "richter", "ridley", "rob", "robin", "rosalina_and_luma", "roy", "ryu", "samus",
  "sheik", "shulk", "simon", "snake", "sonic", "toon_link", "villager", "wario", "wii_fit_trainer",
  "wolf", "yoshi", "young_link", "zelda", "zero_suit_samus",
]);

// 主ソースで別名になる slug → marcrd キー（Mii 3種は共通アイコン mii_fighter）。
const MARCRD_ALIAS: Record<string, string> = {
  mii_brawler: "mii_fighter",
  mii_swordfighter: "mii_fighter",
  mii_gunner: "mii_fighter",
};

// 主ソースに無い slug → rubendal キー（スペース区切り小文字。URLエンコードして参照）。
const RUBENDAL_ALIAS: Record<string, string> = {
  pt_squirtle: "squirtle",
  pt_ivysaur: "ivysaur",
  pt_charizard: "charizard",
  joker: "joker",
  hero: "hero",
  banjo_and_kazooie: "banjo kazooie",
  terry: "terry",
  byleth: "byleth",
  minmin: "min min",
  steve: "steve",
  sephiroth: "sephiroth",
  pyra: "pyra",
  mythra: "mythra",
  kazuya: "kazuya",
  sora: "sora",
};

/**
 * キャラの外部アイコンURLを返す純関数。対応が無い slug は null（呼び出し側で頭文字チップ）。
 * @param character slug を持つキャラ（Character でも { slug } でも可）
 */
export function iconUrl(character: Pick<Character, "slug">): string | null {
  const slug = character.slug;
  if (!slug) return null;

  if (MARCRD_KEYS.has(slug)) return `${MARCRD_BASE}/${slug}.png`;

  const marcrdAlias = MARCRD_ALIAS[slug];
  if (marcrdAlias) return `${MARCRD_BASE}/${marcrdAlias}.png`;

  const rubendalKey = RUBENDAL_ALIAS[slug];
  if (rubendalKey) return `${RUBENDAL_BASE}/${encodeURIComponent(rubendalKey)}.png`;

  return null;
}
