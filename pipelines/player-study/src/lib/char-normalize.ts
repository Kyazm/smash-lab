// キャラ別名正規化（純関数・依存なし）。smash-tube のタイトルは英語表記/略称が揺れる
// （Zero Suit Samus / ZSS、R.O.B / ROB、K. Rool / King K. Rool 等）ため、
// 正準の日本語名へ寄せる。未知の表記はトリム済み原文をそのまま返す（ドロップしない）。
// pilot 段階のため全ロスター網羅は必須ではないが、主要な揺れと Marss が当たる相手は吸収する。

/** 照合キー: 小文字化、& を and に、空白/ドット/ハイフン等の記号を除去（日本語は残す）。 */
export function normKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9぀-ヿ一-龯ー]/g, "");
}

// [正準日本語名, ...別名（英語/略称/表記揺れ）]
const ROSTER: Array<[string, ...string[]]> = [
  ["マリオ", "Mario"],
  ["ドンキーコング", "Donkey Kong", "DK"],
  ["リンク", "Link"],
  ["サムス", "Samus"],
  ["ダークサムス", "Dark Samus"],
  ["ヨッシー", "Yoshi"],
  ["カービィ", "Kirby"],
  ["フォックス", "Fox"],
  ["ピカチュウ", "Pikachu"],
  ["ルイージ", "Luigi"],
  ["ネス", "Ness"],
  ["キャプテンファルコン", "Captain Falcon", "Falcon", "CF"],
  ["プリン", "Jigglypuff", "Puff"],
  ["ピーチ", "Peach"],
  ["デイジー", "Daisy"],
  ["クッパ", "Bowser"],
  ["アイスクライマー", "Ice Climbers", "Ice Climber", "ICs", "IC"],
  ["シーク", "Sheik"],
  ["ゼルダ", "Zelda"],
  ["ドクターマリオ", "Dr. Mario", "Doc", "Dr Mario"],
  ["ピチュー", "Pichu"],
  ["ファルコ", "Falco"],
  ["マルス", "Marth"],
  ["ルキナ", "Lucina"],
  ["こどもリンク", "Young Link", "YLink", "YL"],
  ["ガノンドロフ", "Ganondorf", "Ganon"],
  ["ミュウツー", "Mewtwo", "M2"],
  ["ロイ", "Roy"],
  ["クロム", "Chrom"],
  ["Mr.ゲーム&ウォッチ", "Mr. Game and Watch", "Game and Watch", "Mr Game and Watch", "GnW", "GW", "GaW"],
  ["メタナイト", "Meta Knight", "MK"],
  ["ピット", "Pit"],
  ["ブラックピット", "Dark Pit", "Dpit"],
  ["ゼロスーツサムス", "Zero Suit Samus", "ZSS"],
  ["ワリオ", "Wario"],
  ["スネーク", "Snake"],
  ["アイク", "Ike"],
  ["ポケモントレーナー", "Pokemon Trainer", "PT"],
  ["ディディーコング", "Diddy Kong", "Diddy"],
  ["リュカ", "Lucas"],
  ["ソニック", "Sonic"],
  ["デデデ", "King Dedede", "Dedede", "DDD", "D3"],
  ["ピクミン&オリマー", "Olimar", "Pikmin and Olimar", "Alph"],
  ["ルカリオ", "Lucario"],
  ["ロボット", "R.O.B", "ROB"],
  ["トゥーンリンク", "Toon Link", "TLink", "Tink"],
  ["ウルフ", "Wolf"],
  ["むらびと", "Villager"],
  ["ロックマン", "Mega Man", "Megaman"],
  ["Wiiフィットトレーナー", "Wii Fit Trainer", "WFT"],
  ["ロゼッタ&チコ", "Rosalina and Luma", "Rosalina", "Rosa", "Rosaluma"],
  ["リトルマック", "Little Mac", "LMac"],
  ["ゲッコウガ", "Greninja"],
  ["パルテナ", "Palutena"],
  ["パックマン", "Pac-Man", "Pacman"],
  ["ルフレ", "Robin"],
  ["シュルク", "Shulk"],
  ["クッパJr.", "Bowser Jr", "Bowser Junior", "BJr"],
  ["ダックハント", "Duck Hunt", "DHD", "Duck Hunt Duo"],
  ["リュウ", "Ryu"],
  ["ケン", "Ken"],
  ["クラウド", "Cloud"],
  ["カムイ", "Corrin"],
  ["ベヨネッタ", "Bayonetta", "Bayo"],
  ["インクリング", "Inkling"],
  ["リドリー", "Ridley"],
  ["シモン", "Simon"],
  ["リヒター", "Richter"],
  ["キングクルール", "King K. Rool", "K. Rool", "K Rool", "Krool"],
  ["しずえ", "Isabelle"],
  ["ガオガエン", "Incineroar", "Incin"],
  ["パックンフラワー", "Piranha Plant", "Plant", "PP"],
  ["ジョーカー", "Joker"],
  ["勇者", "Hero"],
  ["バンジョー&カズーイ", "Banjo and Kazooie", "Banjo", "BnK"],
  ["テリー", "Terry"],
  ["ベレト/ベレス", "Byleth"],
  ["ミェンミェン", "Min Min", "Minmin", "MinMin"],
  ["スティーブ", "Steve", "Minecraft"],
  ["セフィロス", "Sephiroth", "Seph"],
  ["ホムラ/ヒカリ", "Pyra/Mythra", "Pyra", "Mythra", "Aegis", "Pyra Mythra"],
  ["カズヤ", "Kazuya"],
  ["ソラ", "Sora"],
  ["剣術Mii", "Mii Swordfighter", "Mii Sword", "Swordfighter"],
  ["格闘Mii", "Mii Brawler", "Brawler"],
  ["射撃Mii", "Mii Gunner", "Gunner"],
];

const ALIAS_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [canonical, ...aliases] of ROSTER) {
    map[normKey(canonical)] = canonical; // 正準名自身も引けるように
    for (const a of aliases) map[normKey(a)] = canonical;
  }
  return map;
})();

/** 単一キャラ表記を正準日本語名へ正規化。未知はトリム済み原文を返す（ドロップしない）。 */
export function normalizeChar(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const hit = ALIAS_MAP[normKey(trimmed)];
  return hit ?? trimmed;
}

/** 正準名として既知か（未知の相手キャラを needs_review 判定に使いたい場合用）。 */
export function isKnownChar(raw: string): boolean {
  return ALIAS_MAP[normKey(raw)] !== undefined;
}

/**
 * "(K. Rool, Kazuya)" や "Pyra / Mythra" のような複数キャラ表記を配列へ分割し各々正規化する。
 * 区切りは , と / と 、 と ・。ただし正準名として既知の単一表記（例 "Mr. Game and Watch" は
 * 区切りを含まない）はそのまま1件。返り値は正規化済みキャラ名の配列（空要素は除去）。
 */
export function splitAndNormalizeChars(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  // 既知の単一キャラ（内部に区切りを含む表記を守る）なら分割しない
  if (isKnownChar(trimmed)) return [normalizeChar(trimmed)];
  const parts = trimmed
    .split(/\s*[,/、・]\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length <= 1) return [normalizeChar(trimmed)];
  return parts.map((p) => normalizeChar(p));
}
