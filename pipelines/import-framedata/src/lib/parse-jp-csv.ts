// 検証窓シート gviz CSV → JpMove[] のパーサ。
// CSV構造（.context/data-sources-addendum-kenshomado.md #6 で確認）:
//   3行目付近に "<番号>. <キャラ名>" セル（実在検証用）
//   セクションマーカー行: "地上攻撃" / "空中攻撃" / "必殺ワザ"(or"必殺技") / "つかみ・投げ" / "投げ"
//   技行: 1列目=技名（例 "弱攻撃"）, 2列目=派生名（例 "弱1"）。1列目が空なら直前の技の派生。

import type { JpMove } from "./types.js";

/** 簡易CSVパーサ（ダブルクオート・改行・カンマ対応）。gviz出力はRFC4180準拠。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\r") {
        // skip
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// セクション見出しの判定。技名セクションのみ拾う（能力値/回避/共通動作は技名突合対象外）。
const SECTION_MARKERS: { match: RegExp; label: string }[] = [
  { match: /^地上攻撃$/, label: "地上攻撃" },
  { match: /^空中攻撃$/, label: "空中攻撃" },
  { match: /^必殺(ワザ|技)$/, label: "必殺ワザ" },
  { match: /^つかみ(・投げ)?$/, label: "つかみ・投げ" },
  { match: /^投げ$/, label: "投げ" },
];

// 技名突合の対象外セクション。ここに到達したら収集を打ち切る（currentSection=null）。
// UFD側にも対応技が無いため（回避=dodge はUFDに別途あるがシートの回避/崖/受け身/アイテム/転倒は突合しない）。
const TERMINATOR_MARKERS: RegExp[] = [
  /^回避$/,
  /^共通動作/,
  /^ガケ行動/,
  /^崖/,
  /^受け身/,
  /^起きあがり/,
  /^あお向け/,
  /^うつ伏せ/,
  /^転倒/,
  /^アイテム/,
];

// 技行ではないノイズ行（セクション内のヘッダ行など）を弾く
const NOISE_CELLS = new Set([
  "",
  "判定持続",
  "全体フレーム",
  "基礎ダメージ",
  "ガード硬直",
  "備考",
  "ベクトル",
]);

/**
 * gviz CSV から日本語技名を抽出する。
 * @returns 実在検証に使うシート先頭のキャラ名ラベル と 技名リスト
 */
export function parseJpCsv(text: string): { charLabel: string | null; moves: JpMove[] } {
  const rows = parseCsv(text);

  // キャラ名ラベル検出: "<数字>. <名前>" or "<数字>'. <名前>" の形のセルを先頭付近から探す
  let charLabel: string | null = null;
  for (const r of rows.slice(0, 8)) {
    for (const cell of r) {
      const t = cell.trim();
      if (/^\d+'?\.\s*.+/.test(t)) {
        charLabel = t;
        break;
      }
    }
    if (charLabel) break;
  }

  const moves: JpMove[] = [];
  let currentSection: string | null = null;
  let lastBaseName = "";
  let order = 0;

  for (const r of rows) {
    const c0 = (r[0] ?? "").trim();
    const c1 = (r[1] ?? "").trim();

    // 収集打ち切りセクション（回避/共通動作/アイテム等）に到達したら以降は無視
    if (TERMINATOR_MARKERS.some((re) => re.test(c0))) {
      currentSection = null;
      lastBaseName = "";
      continue;
    }
    // セクション見出し行か？（1列目だけが埋まり他がほぼ空）
    const marker = SECTION_MARKERS.find((m) => m.match.test(c0));
    if (marker) {
      currentSection = marker.label;
      lastBaseName = "";
      continue;
    }
    // 技名セクション外はスキップ
    if (!currentSection) continue;

    // 技行判定: c0（技名）か c1（派生名）のどちらかが実データ
    const hasBase = c0 && !NOISE_CELLS.has(c0);
    const hasVariant = c1 && !NOISE_CELLS.has(c1);
    if (!hasBase && !hasVariant) continue;

    // ヘッダ行（"判定持続"等が並ぶ）を弾く: c1が既知ヘッダなら skip
    if (NOISE_CELLS.has(c1) && !hasBase) continue;

    // 必殺ワザの "地上・空中"/"地上"/"空中" は新規技名ではなく直前技の適用範囲サブラベル。
    // baseName を引き継いで variant として扱う（順序補完時に「地上・空中」単独名になるのを防ぐ）。
    const isScopeLabel = /^(地上・空中|地上|空中)(のみ)?$/.test(c0);
    if (isScopeLabel && lastBaseName) {
      const scopeVariant = hasVariant ? c1 : c0;
      moves.push({
        nameJa: `${lastBaseName}（${scopeVariant}）`,
        baseName: lastBaseName,
        variant: scopeVariant,
        section: currentSection,
        order: order++,
      });
      continue;
    }

    const baseName = hasBase ? c0 : lastBaseName;
    if (hasBase) lastBaseName = c0;
    const variant = hasVariant ? c1 : "";

    // ベース名が無い（派生だけで直前ベースも無い）行は捨てる
    if (!baseName) continue;

    const nameJa = variant ? `${baseName}（${variant}）` : baseName;
    moves.push({ nameJa, baseName, variant, section: currentSection, order: order++ });
  }

  return { charLabel, moves };
}
