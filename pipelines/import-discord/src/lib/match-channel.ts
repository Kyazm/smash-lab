// チャンネル名 → ノート属性の突合ロジック（純関数）。
// - matchup: 「7_フォックス対策⭐」→ character_slug=fox, starred=true
// - own_move: 「横b」「da」「弱」→ ZSS の move_slug
// - starred: 名前に⭐（U+2B50）等の星記号を含むか
//
// characters.json / moves.json（import-framedata の出力）を突合辞書として受け取る純関数にし、
// vitest から実データ or フィクスチャで検証できるようにする。

export interface CharacterLite {
  slug: string;
  name_ja: string;
  name_en: string;
}

export interface MoveLite {
  slug: string;
  name_ja: string | null;
  category: string;
}

// 星記号（重要度マーク）。⭐/★/☆ を許容。
const STAR_RE = /[⭐★☆]/u;

/** チャンネル名に星記号が含まれるか。 */
export function isStarred(channelName: string): boolean {
  return STAR_RE.test(channelName);
}

/**
 * チャンネル名の装飾を剥がして本体ラベルを得る。
 * - 先頭の「7_」「12-」「3 」等の番号プレフィックスを除去
 * - 星記号・前後空白を除去
 * - discord の絵文字ショートコード（:star:）や末尾装飾も除去
 */
export function stripDecorations(channelName: string): string {
  let s = channelName.normalize("NFKC");
  s = s.replace(STAR_RE, "");
  s = s.replace(/:[a-z0-9_+-]+:/gi, ""); // :emoji_shortcode:
  // 先頭の番号プレフィックス（全角/半角数字 + 区切り[_\-.\s]）
  s = s.replace(/^[\s]*[0-9０-９]+[\s_.\-–—]*/u, "");
  return s.trim();
}

/**
 * matchup チャンネル名 → character_slug。
 * 「フォックス対策」→ name_ja「フォックス」で突合。
 * 装飾除去後、末尾の「対策」「対策メモ」等を落として name_ja 完全一致 → 部分一致の順で探す。
 * 見つからなければ null。
 */
export function matchCharacterSlug(
  channelName: string,
  characters: CharacterLite[],
): string | null {
  let label = stripDecorations(channelName);
  // 「〜対策」「〜対策メモ」「〜戦」などの接尾辞を除去
  label = label.replace(/(対策(メモ)?|戦|マッチアップ)$/u, "").trim();
  if (!label) return null;

  // 1) name_ja 完全一致
  const exact = characters.find((c) => c.name_ja === label);
  if (exact) return exact.slug;

  // 2) name_en 完全一致（大小無視）
  const enExact = characters.find(
    (c) => c.name_en.toLowerCase() === label.toLowerCase(),
  );
  if (enExact) return enExact.slug;

  // 3) name_ja 部分一致（ラベルがキャラ名を含む / キャラ名がラベルを含む）。
  //    最長一致を優先し、誤爆（「サムス」→「ダークサムス」等）を避けるため
  //    「ラベルがキャラ名で始まる or 等しい」候補のうち name_ja 最長を採る。
  const candidates = characters
    .filter((c) => label === c.name_ja || label.startsWith(c.name_ja))
    .sort((a, b) => b.name_ja.length - a.name_ja.length);
  if (candidates.length > 0) return candidates[0].slug;

  return null;
}

// own_move: チャンネル名の略称 → ZSS move slug のエイリアス表。
// キーは stripDecorations + toLowerCase 後の正規化ラベル。
// 値は data/imported/moves.json の ZSS の move.slug。
const MOVE_ALIASES: Record<string, string> = {
  // 地上
  弱: "jab-1",
  jab: "jab-1",
  横強: "forward-tilt",
  上強: "up-tilt",
  下強: "down-tilt",
  da: "dash-attack",
  ダッシュ攻撃: "dash-attack",
  横スマ: "forward-smash",
  上スマ: "up-smash",
  下スマ: "down-smash",
  // 空中
  空n: "neutral-air",
  空前: "forward-air",
  空後: "back-air",
  空上: "up-air",
  空下: "down-air",
  zair: "z-air",
  空ワイヤー: "z-air",
  // 必殺技
  nb: "neutral-b-paralyzer",
  パラライザー: "neutral-b-paralyzer",
  横b: "side-b-plasma-whip",
  プラズマウィップ: "side-b-plasma-whip",
  上b: "up-b-boost-kick",
  ブーストキック: "up-b-boost-kick",
  下b: "down-b-flip-jump",
  フリップジャンプ: "down-b-flip-jump",
  // つかみ/投げ
  つかみ: "grab",
  前投げ: "forward-throw",
  後投げ: "backward-throw",
  上投げ: "up-throw",
  下投げ: "down-throw",
};

/**
 * own_move チャンネル名 → ZSS move_slug。
 * 1) エイリアス表（横b/da/弱…）で解決
 * 2) moves の name_ja / slug と正規化一致
 * 見つからなければ null。moves は ZSS の技のみを渡す想定。
 */
export function matchMoveSlug(
  channelName: string,
  zssMoves: MoveLite[],
): string | null {
  const label = stripDecorations(channelName);
  const key = label.toLowerCase().replace(/\s+/g, "");

  if (MOVE_ALIASES[key]) return MOVE_ALIASES[key];

  // moves.name_ja 完全一致（例: name_ja「横強」）
  const byJa = zssMoves.find((m) => (m.name_ja ?? "").normalize("NFKC") === label);
  if (byJa) return byJa.slug;

  // slug 直指定（例: チャンネル名が "forward-tilt"）
  const bySlug = zssMoves.find((m) => m.slug.toLowerCase() === key);
  if (bySlug) return bySlug.slug;

  return null;
}
