// 立ち回りメモタブ（is_mainのみ）。ADR-0009: 縦一列で長すぎた不満①への対応はデフォルト折りたたみ（Wave A-3）。
// Wave A-1時点では既存 OwnNotesList をそのまま委譲する薄いラッパー。
import { OwnNotesList } from "./OwnNotesList";

export function OwnPlayTab() {
  return <OwnNotesList kind="own_play" emptyLabel="立ち回りメモはまだありません。" />;
}
