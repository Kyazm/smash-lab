// UFD英語技名 / 検証窓シート日本語技名 を「正規化キー」へ落とす。
//
// 弱/強/スマッシュ/空中/つかみ/投げ/ダッシュ攻撃は英語側のカテゴリとスロットで技種が確定するため、
// 日本語名は規則ベースで機械生成する（検証窓との順序マッチは使わない）。
// 順序マッチは必殺技・派生技など固有名が必要なものに限定する（監査指摘 2026-07-03）。

export interface CanonicalMatch {
  /** 正規化キー（jab1/ftilt/nair/zair/nb/upb/fthrow 等） */
  key: string;
  /** 技名からベース部分を除いた残り（例 "Forward Tilt (Up Angled)" → "Up Angled"）。修飾なしは "" */
  rest: string;
}

interface Pattern {
  re: RegExp;
  /** キー。関数はマッチ結果からキーを導出（弱n段など）。 */
  key?: string | ((m: RegExpMatchArray) => string);
  /** true: このパターンにマッチしたら canonical なし確定（カズヤ固有技等）。 */
  reject?: boolean;
}

// パターン定義。順序が重要（jab系→ダッシュ→空中→強→スマッシュ→投げ→つかみ→必殺）。
// - jab系は ^ アンカー必須（"Crouch Jab" 等の誤ヒット防止）
// - "Down-Forward Tilt" / "Back Tilt" 等の複合方向はカズヤ固有技であり ftilt に吸わせない
const PATTERNS: Pattern[] = [
  // Jab
  { re: /^jab\s*(\d+)/i, key: (m) => `jab${m[1]}` },
  { re: /rapid jab finisher/i, key: "jab_rapid_finisher" },
  { re: /rapid jab/i, key: "jab_rapid" },
  { re: /^(?:neutral attack|jab)\b/i, key: "jab" },

  // ダッシュ攻撃（"Double Dash Attack" も dash に吸わせ、修飾で区別）
  { re: /dash attack/i, key: "dash" },

  // 空中攻撃（Z Air を先に）
  { re: /\bz[- ]?air\b/i, key: "zair" },
  { re: /neutral air(?! ?dodge)/i, key: "nair" },
  { re: /forward air/i, key: "fair" },
  { re: /back(?:ward)? air/i, key: "bair" },
  { re: /up air/i, key: "uair" },
  { re: /down air/i, key: "dair" },

  // 強攻撃。カズヤの複合方向強攻撃（Down-Forward Tilt / Up-Back Tilt / Back Tilt 等）は
  // 固有名技なので canonical 不一致とし、順序マッチ/オーバーライドに委ねる。
  { re: /(?:down|up)[- ](?:forward|back) tilt/i, reject: true },
  { re: /(?<![a-z])back tilt/i, reject: true },
  { re: /forward tilt/i, key: "ftilt" },
  { re: /up tilt/i, key: "utilt" },
  { re: /down tilt/i, key: "dtilt" },

  // スマッシュ
  { re: /forward smash/i, key: "fsmash" },
  { re: /up smash/i, key: "usmash" },
  { re: /down smash/i, key: "dsmash" },

  // 投げ（Cargo系は修飾で吸収）
  { re: /forward throw/i, key: "fthrow" },
  { re: /back(?:ward)? throw/i, key: "bthrow" },
  { re: /up throw/i, key: "uthrow" },
  { re: /down throw/i, key: "dthrow" },

  // つかみ
  { re: /pivot grab/i, key: "pivotgrab" },
  { re: /dash grab/i, key: "dashgrab" },
  { re: /^grab$/i, key: "grab" },
  { re: /pummel/i, key: "pummel" },

  // 必殺（シート canonical 突合用）
  { re: /^neutral b\b|^neutral special\b/i, key: "nb" },
  { re: /^side b\b|^side special\b|^forward b\b/i, key: "sideb" },
  { re: /^up b\b|^up special\b/i, key: "upb" },
  { re: /^down b\b|^down special\b/i, key: "downb" },
];

/**
 * UFD movename → { canonical key, 残り修飾テキスト }。不明は null。
 * rest はベース部分を除去し、括弧・カンマ・アスタリスク等を掃除したもの。
 */
export function ufdCanonicalWithRest(nameEn: string): CanonicalMatch | null {
  for (const p of PATTERNS) {
    const m = nameEn.match(p.re);
    if (!m) continue;
    if (p.reject) return null;
    const key = typeof p.key === "function" ? p.key(m) : p.key!;
    const rest = nameEn
      .replace(p.re, " ")
      .replace(/[()*,/]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { key, rest };
  }
  return null;
}

/** UFD movename → canonical key（不明は null）。従来API互換。 */
export function ufdCanonical(nameEn: string): string | null {
  return ufdCanonicalWithRest(nameEn)?.key ?? null;
}

/** 検証窓シート日本語技名（baseName）→ canonical key（不明は null）。必殺技の突合に使う。 */
export function jpCanonical(baseName: string, variant: string): string | null {
  const b = baseName.trim();
  const v = variant.trim();

  // 弱（弱1/弱2/弱3、百裂）
  if (/^弱/.test(b)) {
    if (/弱?1/.test(v) || v === "") return "jab1";
    if (/弱?2/.test(v)) return "jab2";
    if (/弱?3/.test(v)) return "jab3";
    if (/百裂|回転|フィニッシュ|連/.test(v)) return "jab_rapid";
    return "jab1";
  }
  if (/百裂|回転攻撃/.test(b)) return "jab_rapid";

  // ダッシュ攻撃
  if (/^ダッシュ攻撃|^DA$/.test(b)) return "dash";

  // 強
  if (/^横強/.test(b)) return "ftilt";
  if (/^上強/.test(b)) return "utilt";
  if (/^下強/.test(b)) return "dtilt";

  // スマッシュ
  if (/^横スマ/.test(b)) return "fsmash";
  if (/^上スマ/.test(b)) return "usmash";
  if (/^下スマ/.test(b)) return "dsmash";

  // 空中
  if (/^空N|^空中N|^ニュートラル空中/.test(b)) return "nair";
  if (/^空前/.test(b)) return "fair";
  if (/^空後/.test(b)) return "bair";
  if (/^空上/.test(b)) return "uair";
  if (/^空下/.test(b)) return "dair";

  // 必殺（NB/横B/上B/下B）。派生内部技（地上・空中/持続/〆）はここで拾わず順序補完へ。
  if (/^NB\b|^通常(必殺|B)/.test(b)) return "nb";
  if (/^横B/.test(b)) return "sideb";
  if (/^上B\b/.test(b)) return "upb";
  if (/^下B\b/.test(b)) return "downb";

  // つかみ・投げ
  if (/^つかみ攻撃/.test(b)) return "pummel";
  if (/^ダッシュつかみ/.test(b)) return "dashgrab";
  if (/^振り向きつかみ|^振向きつかみ/.test(b)) return "pivotgrab";
  if (/^つかみ/.test(b)) return "grab";
  if (/^前投げ/.test(b)) return "fthrow";
  if (/^後(ろ)?投げ/.test(b)) return "bthrow";
  if (/^上投げ/.test(b)) return "uthrow";
  if (/^下投げ/.test(b)) return "dthrow";

  return null;
}
