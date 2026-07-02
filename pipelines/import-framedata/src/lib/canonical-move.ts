// UFD英語技名 / 検証窓シート日本語技名 を「正規化キー」へ落とす。
// 突合は基本このキーの一致で行い、外れたものは category内の出現順で補完する。
//
// 正規化キーは代表的なスマブラ技: jab1-3, ftilt/utilt/dtilt, dash, fsmash/usmash/dsmash,
// nair/fair/bair/uair/dair, nb/sideb/upb/downb, grab, pummel, fthrow/bthrow/uthrow/dthrow。
// 一意に定まらない技（多段/派生/固有必殺の内部技）は null を返し、順序補完に委ねる。

/** UFD movename → canonical key（不明は null） */
export function ufdCanonical(nameEn: string): string | null {
  const n = nameEn.toLowerCase().trim();

  // Jab
  const jab = n.match(/^jab\s*([123])/);
  if (jab) return `jab${jab[1]}`;
  if (/^(neutral attack|jab)$/.test(n)) return "jab1";
  if (/rapid jab/.test(n)) return "jab_rapid";

  // Dash
  if (/dash attack/.test(n)) return "dash";

  // Tilts
  if (/forward tilt|f[- ]?tilt/.test(n)) return "ftilt";
  if (/up tilt|u[- ]?tilt/.test(n)) return "utilt";
  if (/down tilt|d[- ]?tilt/.test(n)) return "dtilt";

  // Smashes
  if (/forward smash|f[- ]?smash/.test(n)) return "fsmash";
  if (/up smash|u[- ]?smash/.test(n)) return "usmash";
  if (/down smash|d[- ]?smash/.test(n)) return "dsmash";

  // Aerials
  if (/neutral air|nair|n[- ]?air/.test(n)) return "nair";
  if (/forward air|fair|f[- ]?air/.test(n)) return "fair";
  if (/back air|bair|b[- ]?air/.test(n)) return "bair";
  if (/up air|uair|u[- ]?air/.test(n)) return "uair";
  if (/down air|dair|d[- ]?air/.test(n)) return "dair";

  // Specials（内部の複数hitは分けず代表keyへ。始/連/〆などは順序補完に回す）
  if (/^neutral b|^nb\b|neutral special/.test(n)) return "nb";
  if (/^side b|^side special|^forward b/.test(n)) return "sideb";
  if (/^up b|^up special/.test(n)) return "upb";
  if (/^down b|^down special/.test(n)) return "downb";

  // Grabs / throws
  if (/pivot grab/.test(n)) return "pivotgrab";
  if (/dash grab/.test(n)) return "dashgrab";
  if (/^grab$/.test(n)) return "grab";
  if (/pummel/.test(n)) return "pummel";
  if (/forward throw|f[- ]?throw/.test(n)) return "fthrow";
  if (/back(ward)? throw|b[- ]?throw/.test(n)) return "bthrow";
  if (/up throw|u[- ]?throw/.test(n)) return "uthrow";
  if (/down throw|d[- ]?throw/.test(n)) return "dthrow";

  return null;
}

/** 検証窓シート日本語技名（baseName）→ canonical key（不明は null） */
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
  if (/^横B\b|^横(必殺|スマ)?B?/.test(b) && /^横B/.test(b)) return "sideb";
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
