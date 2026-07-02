// OutNote[] → Supabase 投入用 SQL（純関数）。
//
// 【ADR-0004 との関係 / コードレビュー項目】
//   ADR-0004 が禁じるのは「intel-collect パイプラインが notes へ自動書込すること」。
//   本パイプラインは docs/02「Discord移行（一度きり）」で明示的に許可された、
//   ユーザー自身の既存メモの一度きり移行であり、source='discord_import'（スキーマ定義済み enum）で入る。
//   したがって notes への INSERT はここでのみ許容される。intel 由来ではない。
//
// 冪等性: id は決定的 UUIDv5。再投入時の重複を避けるため ON CONFLICT (id) DO NOTHING。
import type { OutNote } from "./types.js";

function sqlStr(v: string | null): string {
  if (v === null) return "null";
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlBool(v: boolean): string {
  return v ? "true" : "false";
}

function sqlUuid(v: string | null): string {
  return v === null ? "null" : `'${v}'`;
}

function sqlTextArray(tags: string[]): string {
  if (tags.length === 0) return "'{}'";
  const inner = tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(",");
  return `'{${inner}}'`;
}

/**
 * notes / note_media の INSERT 文を生成する。
 * トランザクションで囲み、ON CONFLICT DO NOTHING で冪等にする。
 */
export function emitSql(notes: OutNote[]): string {
  const lines: string[] = [];
  lines.push("-- 自動生成: pipelines/import-discord/src/load.ts");
  lines.push("-- Discord 既存メモの一度きり移行（source='discord_import'）。docs/02 Discord移行。");
  lines.push("-- ADR-0004 の notes 自動書込禁止は intel-collect 向け。本移行は明示的に許可された経路。");
  lines.push("-- service role キー（.env）で実行すること。RLS をバイパスする。");
  lines.push("begin;");
  lines.push("");

  for (const n of notes) {
    lines.push(`-- #${n._channel} (${n._channel_id})`);
    lines.push(
      "insert into notes (id, kind, character_id, move_id, player_name, title, body_md, section, starred, pinned, tags, source) values (",
    );
    lines.push(
      `  ${sqlUuid(n.id)}, ${sqlStr(n.kind)}, ${sqlUuid(n.character_id)}, ${sqlUuid(n.move_id)}, ${sqlStr(
        n.player_name,
      )}, ${sqlStr(n.title)}, ${sqlStr(n.body_md)}, ${sqlStr(n.section)}, ${sqlBool(n.starred)}, ${sqlBool(
        n.pinned,
      )}, ${sqlTextArray(n.tags)}, ${sqlStr(n.source)}`,
    );
    lines.push(") on conflict (id) do nothing;");

    for (const m of n.media) {
      lines.push(
        "insert into note_media (id, note_id, type, storage_path, url, caption) values (",
      );
      lines.push(
        `  ${sqlUuid(m.id)}, ${sqlUuid(m.note_id)}, ${sqlStr(m.type)}, ${sqlStr(m.storage_path)}, ${sqlStr(
          m.url,
        )}, ${sqlStr(m.caption)}`,
      );
      lines.push(") on conflict (id) do nothing;");
    }
    lines.push("");
  }

  lines.push("commit;");
  lines.push("");
  return lines.join("\n");
}
