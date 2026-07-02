// キャラロスター定義。UFDスラッグ + 検証窓シートのタブ番号/日本語名 + gid の対応表。
//
// slug: UFDのURLスラッグ（/smash ページのリンクから機械抽出、2026-07-03確認）
// fighterNumber: 検証窓シートのタブ番号（1〜82、派生は元番号）。ファイター番号として保持。
// nameJa: キャラ日本語名（検証窓シートのタブラベル由来）
// sheetTab: 検証窓シートのタブラベル（"29. ゼロスーツサムス" 等。CSV先頭付近の実在検証に使う）
// gid: gviz CSV取得用の確認済みgid。null=未確認（sheet=名前パラメータでフォールバック取得を試みる）
// derivedFrom: 派生キャラの場合、技名コピー元のslug（gid未発見時のフォールバック元）
//
// 補遺（.context/data-sources-addendum-kenshomado.md）の罠に対応:
//   - 54番パルテナはgid未発見 → AI生成フォールバック
//   - 派生7種はgid未確認 → 元キャラからコピー
//   - gidはHTTP 200でもフォールバックするのでCSV内キャラ名で実在検証必須

export interface RosterEntry {
  slug: string;
  fighterNumber: number;
  nameJa: string;
  nameEn: string;
  sheetTab: string;
  gid: string | null;
  derivedFrom?: string;
}

// 確認済みgid（補遺 #3）
const CONFIRMED_GIDS: Record<string, string> = {
  zero_suit_samus: "1381351225",
  mario: "1377404903",
};

// UFDスラッグ順（/smash ページ）ではなく、ファイター番号順で定義。
// nameEn はUFDページの <title> / スラッグから導出。sheetTab は検証窓のタブ命名規則 "<番号>. <日本語名>"。
export const ROSTER: RosterEntry[] = [
  { slug: "mario", fighterNumber: 1, nameJa: "マリオ", nameEn: "Mario", sheetTab: "1. マリオ", gid: null },
  { slug: "donkey_kong", fighterNumber: 2, nameJa: "ドンキーコング", nameEn: "Donkey Kong", sheetTab: "2. ドンキーコング", gid: null },
  { slug: "link", fighterNumber: 3, nameJa: "リンク", nameEn: "Link", sheetTab: "3. リンク", gid: null },
  { slug: "samus", fighterNumber: 4, nameJa: "サムス", nameEn: "Samus", sheetTab: "4. サムス", gid: null },
  { slug: "dark_samus", fighterNumber: 4, nameJa: "ダークサムス", nameEn: "Dark Samus", sheetTab: "4'. ダークサムス", gid: null, derivedFrom: "samus" },
  { slug: "yoshi", fighterNumber: 5, nameJa: "ヨッシー", nameEn: "Yoshi", sheetTab: "5. ヨッシー", gid: null },
  { slug: "kirby", fighterNumber: 6, nameJa: "カービィ", nameEn: "Kirby", sheetTab: "6. カービィ", gid: null },
  { slug: "fox", fighterNumber: 7, nameJa: "フォックス", nameEn: "Fox", sheetTab: "7. フォックス", gid: null },
  { slug: "pikachu", fighterNumber: 8, nameJa: "ピカチュウ", nameEn: "Pikachu", sheetTab: "8. ピカチュウ", gid: null },
  { slug: "luigi", fighterNumber: 9, nameJa: "ルイージ", nameEn: "Luigi", sheetTab: "9. ルイージ", gid: null },
  { slug: "ness", fighterNumber: 10, nameJa: "ネス", nameEn: "Ness", sheetTab: "10. ネス", gid: null },
  { slug: "captain_falcon", fighterNumber: 11, nameJa: "キャプテン・ファルコン", nameEn: "Captain Falcon", sheetTab: "11. キャプテン・ファルコン", gid: null },
  { slug: "jigglypuff", fighterNumber: 12, nameJa: "プリン", nameEn: "Jigglypuff", sheetTab: "12. プリン", gid: null },
  { slug: "peach", fighterNumber: 13, nameJa: "ピーチ", nameEn: "Peach", sheetTab: "13. ピーチ", gid: null },
  { slug: "daisy", fighterNumber: 13, nameJa: "デイジー", nameEn: "Daisy", sheetTab: "13'. デイジー", gid: null, derivedFrom: "peach" },
  { slug: "bowser", fighterNumber: 14, nameJa: "クッパ", nameEn: "Bowser", sheetTab: "14. クッパ", gid: null },
  { slug: "ice_climbers", fighterNumber: 15, nameJa: "アイスクライマー", nameEn: "Ice Climbers", sheetTab: "15. アイスクライマー", gid: null },
  { slug: "sheik", fighterNumber: 16, nameJa: "シーク", nameEn: "Sheik", sheetTab: "16. シーク", gid: null },
  { slug: "zelda", fighterNumber: 17, nameJa: "ゼルダ", nameEn: "Zelda", sheetTab: "17. ゼルダ", gid: null },
  { slug: "dr_mario", fighterNumber: 18, nameJa: "ドクターマリオ", nameEn: "Dr. Mario", sheetTab: "18. ドクターマリオ", gid: null },
  { slug: "pichu", fighterNumber: 19, nameJa: "ピチュー", nameEn: "Pichu", sheetTab: "19. ピチュー", gid: null },
  { slug: "falco", fighterNumber: 20, nameJa: "ファルコ", nameEn: "Falco", sheetTab: "20. ファルコ", gid: null },
  { slug: "marth", fighterNumber: 21, nameJa: "マルス", nameEn: "Marth", sheetTab: "21. マルス", gid: null },
  { slug: "lucina", fighterNumber: 21, nameJa: "ルキナ", nameEn: "Lucina", sheetTab: "21'. ルキナ", gid: null, derivedFrom: "marth" },
  { slug: "young_link", fighterNumber: 22, nameJa: "こどもリンク", nameEn: "Young Link", sheetTab: "22. こどもリンク", gid: null },
  { slug: "ganondorf", fighterNumber: 23, nameJa: "ガノンドロフ", nameEn: "Ganondorf", sheetTab: "23. ガノンドロフ", gid: null },
  { slug: "mewtwo", fighterNumber: 24, nameJa: "ミュウツー", nameEn: "Mewtwo", sheetTab: "24. ミュウツー", gid: null },
  { slug: "roy", fighterNumber: 25, nameJa: "ロイ", nameEn: "Roy", sheetTab: "25. ロイ", gid: null },
  { slug: "chrom", fighterNumber: 25, nameJa: "クロム", nameEn: "Chrom", sheetTab: "25'. クロム", gid: null, derivedFrom: "roy" },
  { slug: "mr_game_and_watch", fighterNumber: 26, nameJa: "Mr.ゲーム&ウォッチ", nameEn: "Mr. Game & Watch", sheetTab: "26. Mr.ゲーム&ウォッチ", gid: null },
  { slug: "meta_knight", fighterNumber: 27, nameJa: "メタナイト", nameEn: "Meta Knight", sheetTab: "27. メタナイト", gid: null },
  { slug: "pit", fighterNumber: 28, nameJa: "ピット", nameEn: "Pit", sheetTab: "28. ピット", gid: null },
  { slug: "dark_pit", fighterNumber: 28, nameJa: "ブラックピット", nameEn: "Dark Pit", sheetTab: "28'. ブラックピット", gid: null, derivedFrom: "pit" },
  { slug: "zero_suit_samus", fighterNumber: 29, nameJa: "ゼロスーツサムス", nameEn: "Zero Suit Samus", sheetTab: "29. ゼロスーツサムス", gid: null },
  { slug: "wario", fighterNumber: 30, nameJa: "ワリオ", nameEn: "Wario", sheetTab: "30. ワリオ", gid: null },
  { slug: "snake", fighterNumber: 31, nameJa: "スネーク", nameEn: "Snake", sheetTab: "31. スネーク", gid: null },
  { slug: "ike", fighterNumber: 32, nameJa: "アイク", nameEn: "Ike", sheetTab: "32. アイク", gid: null },
  { slug: "pt_squirtle", fighterNumber: 33, nameJa: "ゼニガメ", nameEn: "Squirtle", sheetTab: "33. ゼニガメ", gid: null },
  { slug: "pt_ivysaur", fighterNumber: 34, nameJa: "フシギソウ", nameEn: "Ivysaur", sheetTab: "34. フシギソウ", gid: null },
  { slug: "pt_charizard", fighterNumber: 35, nameJa: "リザードン", nameEn: "Charizard", sheetTab: "35. リザードン", gid: null },
  { slug: "diddy_kong", fighterNumber: 36, nameJa: "ディディーコング", nameEn: "Diddy Kong", sheetTab: "36. ディディーコング", gid: null },
  { slug: "lucas", fighterNumber: 37, nameJa: "リュカ", nameEn: "Lucas", sheetTab: "37. リュカ", gid: null },
  { slug: "sonic", fighterNumber: 38, nameJa: "ソニック", nameEn: "Sonic", sheetTab: "38. ソニック", gid: null },
  { slug: "king_dedede", fighterNumber: 39, nameJa: "デデデ", nameEn: "King Dedede", sheetTab: "39. デデデ", gid: null },
  { slug: "olimar", fighterNumber: 40, nameJa: "ピクミン&オリマー", nameEn: "Olimar", sheetTab: "40. ピクミン&オリマー", gid: null },
  { slug: "lucario", fighterNumber: 41, nameJa: "ルカリオ", nameEn: "Lucario", sheetTab: "41. ルカリオ", gid: null },
  { slug: "rob", fighterNumber: 42, nameJa: "ロボット", nameEn: "R.O.B.", sheetTab: "42. ロボット", gid: null },
  { slug: "toon_link", fighterNumber: 43, nameJa: "トゥーンリンク", nameEn: "Toon Link", sheetTab: "43. トゥーンリンク", gid: null },
  { slug: "wolf", fighterNumber: 44, nameJa: "ウルフ", nameEn: "Wolf", sheetTab: "44. ウルフ", gid: null },
  { slug: "villager", fighterNumber: 45, nameJa: "むらびと", nameEn: "Villager", sheetTab: "45. むらびと", gid: null },
  { slug: "mega_man", fighterNumber: 46, nameJa: "ロックマン", nameEn: "Mega Man", sheetTab: "46. ロックマン", gid: null },
  { slug: "wii_fit_trainer", fighterNumber: 47, nameJa: "Wii Fit トレーナー", nameEn: "Wii Fit Trainer", sheetTab: "47. Wii Fit トレーナー", gid: null },
  { slug: "rosalina_and_luma", fighterNumber: 48, nameJa: "ロゼッタ&チコ", nameEn: "Rosalina & Luma", sheetTab: "48. ロゼッタ&チコ", gid: null },
  { slug: "little_mac", fighterNumber: 49, nameJa: "リトル・マック", nameEn: "Little Mac", sheetTab: "49. リトル・マック", gid: null },
  { slug: "greninja", fighterNumber: 50, nameJa: "ゲッコウガ", nameEn: "Greninja", sheetTab: "50. ゲッコウガ", gid: null },
  { slug: "mii_brawler", fighterNumber: 51, nameJa: "Mii 格闘タイプ", nameEn: "Mii Brawler", sheetTab: "51. 格闘Mii", gid: null },
  { slug: "mii_swordfighter", fighterNumber: 52, nameJa: "Mii 剣術タイプ", nameEn: "Mii Swordfighter", sheetTab: "52. 剣術Mii", gid: null },
  { slug: "mii_gunner", fighterNumber: 53, nameJa: "Mii 射撃タイプ", nameEn: "Mii Gunner", sheetTab: "53. 射撃Mii", gid: null },
  // 54番パルテナ: 補遺 #4 でgid未発見・タブ欠落の可能性大 → AI生成フォールバック必須
  { slug: "palutena", fighterNumber: 54, nameJa: "パルテナ", nameEn: "Palutena", sheetTab: "54. パルテナ", gid: null },
  { slug: "pac_man", fighterNumber: 55, nameJa: "パックマン", nameEn: "Pac-Man", sheetTab: "55. パックマン", gid: null },
  { slug: "robin", fighterNumber: 56, nameJa: "ルフレ", nameEn: "Robin", sheetTab: "56. ルフレ", gid: null },
  { slug: "shulk", fighterNumber: 57, nameJa: "シュルク", nameEn: "Shulk", sheetTab: "57. シュルク", gid: null },
  { slug: "bowser_jr", fighterNumber: 58, nameJa: "クッパJr.", nameEn: "Bowser Jr.", sheetTab: "58. クッパ Jr.", gid: null },
  { slug: "duck_hunt", fighterNumber: 59, nameJa: "ダックハント", nameEn: "Duck Hunt", sheetTab: "59. ダックハント", gid: null },
  { slug: "ryu", fighterNumber: 60, nameJa: "リュウ", nameEn: "Ryu", sheetTab: "60. リュウ", gid: null },
  { slug: "ken", fighterNumber: 60, nameJa: "ケン", nameEn: "Ken", sheetTab: "60'. ケン", gid: null, derivedFrom: "ryu" },
  { slug: "cloud", fighterNumber: 61, nameJa: "クラウド", nameEn: "Cloud", sheetTab: "61. クラウド", gid: null },
  { slug: "corrin", fighterNumber: 62, nameJa: "カムイ", nameEn: "Corrin", sheetTab: "62. カムイ", gid: null },
  { slug: "bayonetta", fighterNumber: 63, nameJa: "ベヨネッタ", nameEn: "Bayonetta", sheetTab: "63. ベヨネッタ", gid: null },
  { slug: "inkling", fighterNumber: 64, nameJa: "インクリング", nameEn: "Inkling", sheetTab: "64. インクリング", gid: null },
  { slug: "ridley", fighterNumber: 65, nameJa: "リドリー", nameEn: "Ridley", sheetTab: "65. リドリー", gid: null },
  { slug: "simon", fighterNumber: 66, nameJa: "シモン", nameEn: "Simon", sheetTab: "66. シモン", gid: null },
  { slug: "richter", fighterNumber: 66, nameJa: "リヒター", nameEn: "Richter", sheetTab: "66'. リヒター", gid: null, derivedFrom: "simon" },
  { slug: "king_k_rool", fighterNumber: 67, nameJa: "キングクルール", nameEn: "King K. Rool", sheetTab: "67. キングクルール", gid: null },
  { slug: "isabelle", fighterNumber: 68, nameJa: "しずえ", nameEn: "Isabelle", sheetTab: "68. しずえ", gid: null },
  { slug: "incineroar", fighterNumber: 69, nameJa: "ガオガエン", nameEn: "Incineroar", sheetTab: "69. ガオガエン", gid: null },
  { slug: "piranha_plant", fighterNumber: 70, nameJa: "パックンフラワー", nameEn: "Piranha Plant", sheetTab: "70. パックンフラワー", gid: null },
  { slug: "joker", fighterNumber: 71, nameJa: "ジョーカー", nameEn: "Joker", sheetTab: "71. ジョーカー", gid: null },
  { slug: "hero", fighterNumber: 72, nameJa: "勇者", nameEn: "Hero", sheetTab: "72. 勇者", gid: null },
  { slug: "banjo_and_kazooie", fighterNumber: 73, nameJa: "バンジョー&カズーイ", nameEn: "Banjo & Kazooie", sheetTab: "73. バンジョー&カズーイ", gid: null },
  { slug: "terry", fighterNumber: 74, nameJa: "テリー", nameEn: "Terry", sheetTab: "74. テリー", gid: null },
  { slug: "byleth", fighterNumber: 75, nameJa: "ベレト/ベレス", nameEn: "Byleth", sheetTab: "75. ベレト／ベレス", gid: null },
  { slug: "minmin", fighterNumber: 76, nameJa: "ミェンミェン", nameEn: "Min Min", sheetTab: "76. ミェンミェン", gid: null },
  { slug: "steve", fighterNumber: 77, nameJa: "スティーブ", nameEn: "Steve", sheetTab: "77. スティーブ／アレックス", gid: null },
  { slug: "sephiroth", fighterNumber: 78, nameJa: "セフィロス", nameEn: "Sephiroth", sheetTab: "78. セフィロス", gid: null },
  // 検証窓シートは 79=ホムラ(Pyra) / 80=ヒカリ(Mythra) を独立タブで持つ（両方 source=sheet で取得可）
  { slug: "pyra", fighterNumber: 79, nameJa: "ホムラ", nameEn: "Pyra", sheetTab: "79. ホムラ", gid: null },
  { slug: "mythra", fighterNumber: 79, nameJa: "ヒカリ", nameEn: "Mythra", sheetTab: "80. ヒカリ", gid: null, derivedFrom: "pyra" },
  { slug: "kazuya", fighterNumber: 80, nameJa: "カズヤ", nameEn: "Kazuya", sheetTab: "81. カズヤ", gid: null },
  { slug: "sora", fighterNumber: 82, nameJa: "ソラ", nameEn: "Sora", sheetTab: "82. ソラ", gid: null },
];

// 確認済みgidを反映
for (const entry of ROSTER) {
  const g = CONFIRMED_GIDS[entry.slug];
  if (g) entry.gid = g;
}

export const MAIN_SLUG = "zero_suit_samus";
