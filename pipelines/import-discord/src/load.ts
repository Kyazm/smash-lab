// loader: 人間が確認・修正した discord-mapping.csv + エクスポート済みメッセージ →
//   (a) 中間JSON  .context/discord-import/notes.json
//   (b) 投入SQL   .context/discord-import/load.sql（service role キーで後日実行）
//
// docs/02 移行手順: マッピング確認後に実行する。notes/note_media へ入る（source=discord_import）。
// ADR-0004 の禁止（intel の notes 自動書込）とは別枠の、明示的に許可された一度きり移行。
//
// DB は未準備なので既定では SQL/JSON を書き出すのみ（実行しない）。
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  MAPPING_CSV,
  EXPORT_DIR,
  NOTES_JSON,
  LOAD_SQL,
  CHARACTERS_JSON,
  MOVES_JSON,
  ZSS_SLUG,
} from "./config.js";
import { readJson, readText, writeJson, writeText, fileExists } from "./lib/io.js";
import { parseMappingCsv } from "./lib/mapping-csv.js";
import { buildNotes, type CharacterRef, type MoveRef } from "./lib/build-notes.js";
import { emitSql } from "./lib/emit-sql.js";
import type { DiscordMessage } from "./lib/types.js";

interface CharacterFull extends CharacterRef {
  name_en: string;
}
interface MoveFull extends MoveRef {
  name_ja: string | null;
  category: string;
}

async function main(): Promise<void> {
  if (!(await fileExists(MAPPING_CSV))) {
    throw new Error(
      `${MAPPING_CSV} が見つかりません。先に \`npm run transform\` を実行し、内容を確認・修正してください。`,
    );
  }

  const mapping = parseMappingCsv(await readText(MAPPING_CSV));
  const characters = await readJson<CharacterFull[]>(CHARACTERS_JSON);
  const moves = await readJson<MoveFull[]>(MOVES_JSON);
  const zss = characters.find((c) => c.slug === ZSS_SLUG);
  if (!zss) throw new Error(`characters.json に ${ZSS_SLUG} が見つかりません`);
  const zssMoves: MoveRef[] = moves.filter((m) => m.character_id === zss.id);

  // チャンネルごとの生メッセージを読み込む
  const messagesByChannel = new Map<string, DiscordMessage[]>();
  for (const row of mapping) {
    const path = join(EXPORT_DIR, `${row.channel_id}.json`);
    if (await fileExists(path)) {
      messagesByChannel.set(row.channel_id, await readJson<DiscordMessage[]>(path));
    } else {
      messagesByChannel.set(row.channel_id, []);
    }
  }

  const { notes, warnings } = buildNotes({
    mapping,
    messagesByChannel,
    characters,
    zssMoves,
  });

  await writeJson(NOTES_JSON, notes);
  await writeText(LOAD_SQL, emitSql(notes));

  const mediaCount = notes.reduce((n, x) => n + x.media.length, 0);
  console.log(`[load] ノート ${notes.length} 件 / メディア ${mediaCount} 件`);
  console.log(`  中間JSON: ${NOTES_JSON}`);
  console.log(`  投入SQL : ${LOAD_SQL}（service role キーで後日実行）`);
  if (warnings.length) {
    console.log(`[load] 警告 ${warnings.length} 件:`);
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log(
    "[load] 添付の実体アップロード（Storage / ローカル動画ディレクトリ）は DB 準備後に別途実施。",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
