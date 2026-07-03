// discord-mapping.csv の生成/パース（純関数）。
// 列: channel, channel_id, category, kind, character_slug, move_slug, starred, note
import type { MappingRow } from "./types.js";
import {
  isStarred,
  matchCharacterSlug,
  matchMoveSlug,
  type CharacterLite,
  type MoveLite,
} from "./match-channel.js";
import type { CategoryKind } from "../config.js";

export const CSV_HEADER = [
  "channel",
  "channel_id",
  "category",
  "kind",
  "character_slug",
  "move_slug",
  "starred",
  "note",
] as const;

export interface ChannelInput {
  channel: string;
  channel_id: string;
  category: string;
  kind: CategoryKind;
}

/**
 * 対象チャンネル群 → マッピング行。突合失敗は空欄+note に理由を残し、人間が埋める。
 */
export function buildMappingRows(
  channels: ChannelInput[],
  characters: CharacterLite[],
  zssMoves: MoveLite[],
): MappingRow[] {
  return channels.map((c) => {
    const starred = isStarred(c.channel);
    let character_slug = "";
    let move_slug = "";
    let note = "";

    if (c.kind === "matchup") {
      const slug = matchCharacterSlug(c.channel, characters);
      if (slug) character_slug = slug;
      else note = "キャラ未解決（手動で character_slug を記入）";
    } else if (c.kind === "own_move") {
      const slug = matchMoveSlug(c.channel, zssMoves);
      if (slug) move_slug = slug;
      else note = "技未解決（手動で move_slug を記入。空なら own_play 扱い）";
    }

    return {
      channel: c.channel,
      channel_id: c.channel_id,
      category: c.category,
      kind: c.kind,
      character_slug,
      move_slug,
      starred: String(starred),
      note,
    };
  });
}

// ---- CSV シリアライズ / パース（RFC4180 準拠の最小実装） ----

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function serializeMappingCsv(rows: MappingRow[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      CSV_HEADER.map((h) => csvEscape(String((r as unknown as Record<string, unknown>)[h] ?? ""))).join(","),
    );
  }
  return lines.join("\n") + "\n";
}

/** CSV 文字列 → 行（ヘッダ検証込み）。人間が編集したファイルを読み戻す。 */
export function parseMappingCsv(text: string): MappingRow[] {
  const records = parseCsvRecords(text);
  if (records.length === 0) return [];
  const header = records[0];
  const idx = (name: string) => header.indexOf(name);
  const rows: MappingRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const rec = records[i];
    if (rec.length === 1 && rec[0] === "") continue; // 空行
    rows.push({
      channel: rec[idx("channel")] ?? "",
      channel_id: rec[idx("channel_id")] ?? "",
      category: rec[idx("category")] ?? "",
      kind: (rec[idx("kind")] ?? "") as MappingRow["kind"],
      character_slug: rec[idx("character_slug")] ?? "",
      move_slug: rec[idx("move_slug")] ?? "",
      starred: rec[idx("starred")] ?? "false",
      note: rec[idx("note")] ?? "",
    });
  }
  return rows;
}

/** RFC4180 の最小 CSV パーサ（クォート・エスケープ・改行対応）。 */
export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // 末尾フィールド/レコード
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}
