// transformer: エクスポート済みチャンネル一覧 → discord-mapping.csv を生成する。
// docs/02 移行手順 2: マッピング表を .context/ に生成し、人間が確認・修正してから load する。
//
// 入力: .context/discord-export/_channels.json（export が書く対象チャンネル一覧）
//        data/imported/characters.json, moves.json（突合辞書）
// 出力: .context/discord-mapping.csv
//
// このスクリプトは notes を組み立てない（それは load.ts の役割）。ここは「確認用の表」を出すだけ。
import {
  RAW_META_PATH,
  MAPPING_CSV,
  CHARACTERS_JSON,
  MOVES_JSON,
  ZSS_SLUG,
} from "./config.js";
import { readJson } from "./lib/io.js";
import { buildMappingRows, serializeMappingCsv, type ChannelInput } from "./lib/mapping-csv.js";
import type { CharacterLite, MoveLite } from "./lib/match-channel.js";
import { writeText } from "./lib/io.js";
import type { CategoryKind } from "./config.js";

interface CharacterFull extends CharacterLite {
  id: string;
}
interface MoveFull extends MoveLite {
  id: string;
  character_id: string;
}

async function main(): Promise<void> {
  const channelsMeta = await readJson<ChannelInput[]>(RAW_META_PATH).catch(() => {
    throw new Error(
      `${RAW_META_PATH} が見つかりません。先に \`npm run export\`（または --dry-run）を実行してください。`,
    );
  });

  const characters = await readJson<CharacterFull[]>(CHARACTERS_JSON);
  const moves = await readJson<MoveFull[]>(MOVES_JSON);
  const zss = characters.find((c) => c.slug === ZSS_SLUG);
  if (!zss) throw new Error(`characters.json に ${ZSS_SLUG} が見つかりません`);
  const zssMoves: MoveLite[] = moves
    .filter((m) => m.character_id === zss.id)
    .map((m) => ({ slug: m.slug, name_ja: m.name_ja, category: m.category }));

  const channelInputs: ChannelInput[] = channelsMeta.map((c) => ({
    channel: c.channel,
    channel_id: c.channel_id,
    category: c.category,
    kind: c.kind as CategoryKind,
  }));

  const rows = buildMappingRows(channelInputs, characters, zssMoves);
  const csv = serializeMappingCsv(rows);
  await writeText(MAPPING_CSV, csv);

  const unresolved = rows.filter((r) => r.note).length;
  console.log(`[transform] マッピング表を書き出しました: ${MAPPING_CSV}`);
  console.log(`  チャンネル ${rows.length} 件 / 未解決 ${unresolved} 件`);
  if (unresolved > 0) {
    console.log("  未解決行の character_slug / move_slug を手動で埋めてから load してください。");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
