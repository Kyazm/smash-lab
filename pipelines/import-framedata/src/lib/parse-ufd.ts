// UFDキャラページHTML → UfdCharacter へのパーサ。
// 構造（.context/data-sources.md §2 で実機確認）:
//   <h2 class="movecategory" id="groundattacks|aerialattacks|specialattacks|grabs|dodges|misc">
//   各技 = <div class="movecontainer"> 直下に固定class名の子div:
//     movename / startup / activeframes / totalframes(=faf) / basedamage / advantage(=on_shield) / notes / hitbox
//   Misc Info の Stats ブロックに <div class="oos1|oos2|oos3"> と Shield Grab の <div>。
import * as cheerio from "cheerio";
import type { UfdCharacter, UfdMove, UfdOos, MoveCategory } from "./types.js";

const UFD_BASE = "https://ultimateframedata.com/";

function txt(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** "19", "19 (6)", "--", "" → number|null（先頭の整数のみ拾う） */
function parseInt1(raw: string): number | null {
  const t = txt(raw);
  if (!t || t === "--" || t === "-") return null;
  const m = t.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/** basedamage "2.2", "3.0/5.0", "14.7/17.8" → 最初の数値 */
function parseDamage(raw: string): number | null {
  const t = txt(raw);
  if (!t || t === "--" || t === "-") return null;
  const m = t.match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/** activeframes "2—3" / "2-3" / "5" → "2-3" 等（em-dash正規化） */
function parseActive(raw: string): string | null {
  const t = txt(raw).replace(/[—–]/g, "-");
  if (!t || t === "--" || t === "-") return null;
  return t;
}

/** キャラ内一意のmove slugを生成 */
function slugify(nameEn: string, seen: Set<string>): string {
  let base = nameEn
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) base = "move";
  let slug = base;
  let n = 2;
  while (seen.has(slug)) {
    slug = `${base}-${n++}`;
  }
  seen.add(slug);
  return slug;
}

/**
 * section + movename → schema category。
 * groundattacks は jab/dash/tilt/smash に細分。それ以外はセクション直マップ。
 */
function toCategory(section: string, nameEn: string): MoveCategory {
  const n = nameEn.toLowerCase();
  switch (section) {
    case "aerialattacks":
      return "aerial";
    case "specialattacks":
      return "special";
    case "grabs": {
      // grabs セクションには Grab/Dash Grab/Pivot Grab（grab）と Pummel/Throw（throw）が混在
      if (n.includes("throw") || n.includes("pummel")) return "throw";
      return "grab";
    }
    case "dodges":
      return "dodge";
    case "groundattacks":
    default: {
      if (n.startsWith("jab") || n.includes("neutral attack") || n.includes("rapid jab"))
        return "jab";
      if (n.includes("dash attack")) return "dash";
      if (n.includes("smash")) return "smash";
      // tilt / それ以外の地上技（Forward/Up/Down Tilt 等）
      return "tilt";
    }
  }
}

/** OoS技名 → oos_type。extra_frames は build 側でschema定義値を使う（ここでは型だけ判定）。 */
function oosTypeFor(moveNameEn: string): UfdOos["oosType"] | null {
  const n = moveNameEn.toLowerCase();
  if (n.includes("up b") || n.includes("up special")) return "up_b";
  if (n.includes("up smash") || n.includes("up-smash")) return "up_smash";
  if (n.includes("grab")) return "grab";
  if (n.includes("shield drop")) return "shield_drop";
  // Neutral Air / Up Air / 各種空中技 → aerial
  if (n.includes("air")) return "aerial";
  return null;
}

export function parseUfdCharacter(slug: string, html: string): UfdCharacter {
  const $ = cheerio.load(html);
  const moves: UfdMove[] = [];
  const seenSlugs = new Set<string>();
  let order = 0;

  // 現在のセクションを h2.movecategory を辿って追跡する。
  // movecontainer と h2 が同じDOM順に並ぶので、ドキュメント順に走査する。
  let currentSection = "groundattacks";

  $("h2.movecategory, div.movecontainer").each((_i, el) => {
    const $el = $(el);
    if ($el.is("h2.movecategory")) {
      currentSection = $el.attr("id") ?? currentSection;
      return;
    }
    // movecontainer
    // misc セクションの Stats / Ledge 系はフレームデータを持たないのでスキップ
    if (currentSection === "misc") return;

    const nameEn = txt($el.find(".movename").first().text());
    if (!nameEn) return;

    const startup = parseInt1($el.find(".startup").first().text());
    const active = parseActive($el.find(".activeframes").first().text());
    const faf = parseInt1($el.find(".totalframes").first().text());
    const onShield = parseInt1($el.find(".advantage").first().text());
    const damage = parseDamage($el.find(".basedamage").first().text());
    const notesRaw = txt($el.find(".notes").first().text());
    const notes = notesRaw && notesRaw !== "--" ? notesRaw : null;

    // hitbox画像URL（data-featherlight or img data-src）。ダウンロードはしない、URLのみ。
    let hitbox: string | null = null;
    const fl = $el.find(".hitboximg").first().attr("data-featherlight");
    const dataSrc = $el.find("img").first().attr("data-src");
    const rawImg = fl || dataSrc || null;
    if (rawImg) {
      hitbox = rawImg.startsWith("http") ? rawImg : UFD_BASE + rawImg.replace(/^\//, "");
    }

    moves.push({
      nameEn,
      section: currentSection,
      category: toCategory(currentSection, nameEn),
      slug: slugify(nameEn, seenSlugs),
      startup,
      active,
      faf,
      onShield,
      damage,
      notes,
      hitboxImgUrl: hitbox,
      order: order++,
    });
  });

  // OoS: Misc Info の oos1-3 + "Shield Grab" / "Shield Drop" 行
  const oos: UfdOos[] = [];
  const seenOos = new Set<string>();
  const pushOos = (label: string) => {
    // "Out of Shield, Up B — 3 frames" / "Shield Grab (Grab, post-Shieldstun) — 10 frames"
    const m = label.match(/(?:Out of Shield,\s*)?(.+?)\s*[—–-]\s*(\d+)\s*frames?/i);
    if (!m) return;
    const moveName = m[1].trim();
    const frames = parseInt(m[2], 10);
    const type = oosTypeFor(moveName);
    if (!type) return;
    const key = `${type}:${moveName}`;
    if (seenOos.has(key)) return;
    seenOos.add(key);
    oos.push({ moveNameEn: moveName, effectiveFrames: frames, oosType: type });
  };

  $(".oos1, .oos2, .oos3").each((_i, el) => pushOos(txt($(el).text())));
  // Shield Grab 行（class名なし）
  $(".movecontainer.plain.misc div, .movecontainer.misc div").each((_i, el) => {
    const t = txt($(el).text());
    if (/Shield Grab/i.test(t)) pushOos(t);
  });

  return { slug, moves, oos };
}
