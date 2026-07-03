// フレーム表のカテゴリセクション定義（docs/06 A-2: UFD方式のカテゴリセクション+スティッキーアンカーナビ）。
// MoveCategory（9種）を表示グループ5種にまとめる。「基礎ステータス」は現行データモデルに該当フィールドが
// 無いため対象外（将来 characters テーブルに歩行速度等を追加した際に導入）。
import type { Move, MoveCategory } from "../types";

export type MoveSectionKey = "ground" | "aerial" | "special" | "grab" | "dodge";

export interface MoveSectionDef {
  key: MoveSectionKey;
  label: string;
  categories: MoveCategory[];
}

export const MOVE_SECTIONS: MoveSectionDef[] = [
  { key: "ground", label: "地上", categories: ["jab", "dash", "tilt", "smash"] },
  { key: "aerial", label: "空中", categories: ["aerial"] },
  { key: "special", label: "必殺", categories: ["special"] },
  { key: "grab", label: "つかみ・投げ", categories: ["grab", "throw"] },
  { key: "dodge", label: "回避", categories: ["dodge"] },
];

const SECTION_BY_CATEGORY: Record<MoveCategory, MoveSectionKey> = MOVE_SECTIONS.reduce(
  (acc, sec) => {
    for (const cat of sec.categories) acc[cat] = sec.key;
    return acc;
  },
  {} as Record<MoveCategory, MoveSectionKey>,
);

export function sectionForCategory(category: MoveCategory): MoveSectionKey {
  return SECTION_BY_CATEGORY[category];
}

/** moves を MOVE_SECTIONS の順で grouping する。該当技が0件のセクションは省く。 */
export function groupMovesBySection(moves: Move[]): { section: MoveSectionDef; moves: Move[] }[] {
  return MOVE_SECTIONS.map((section) => ({
    section,
    moves: moves.filter((m) => sectionForCategory(m.category) === section.key),
  })).filter((g) => g.moves.length > 0);
}
