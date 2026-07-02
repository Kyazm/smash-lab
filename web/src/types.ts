// DB行の型定義（supabase/migrations/0001_schema.sql の characters/moves/oos_options に対応）。
// punish.ts の計算用型（OosCandidate/ShieldedMove）とは別に、DB形（snake_case列）で定義する。
// UI結合時にこれらを punish.ts の型へ変換する。

export type MoveCategory =
  | "jab"
  | "dash"
  | "tilt"
  | "smash"
  | "aerial"
  | "special"
  | "grab"
  | "throw"
  | "dodge";

export type OosType = "aerial" | "up_b" | "up_smash" | "grab" | "shield_drop";

export interface Character {
  id: string;
  slug: string;
  name_ja: string;
  name_en: string;
  fighter_number: number | null;
  icon_url: string | null;
  is_main: boolean;
}

export interface Move {
  id: string;
  character_id: string;
  slug: string;
  name_en: string | null;
  name_ja: string | null;
  category: MoveCategory;
  startup: number | null;
  active: string | null;
  faf: number | null;
  on_shield: number | null;
  damage: number | null;
  notes: string | null;
  hitbox_img_url: string | null;
}

export interface OosOption {
  id: string;
  move_id: string;
  oos_type: OosType;
  extra_frames: number;
  label: string | null;
  range_note: string | null;
}

/** 1キャラ分のフレームデータ一式（キャラページ表示に使う最小単位） */
export interface CharacterBundle {
  character: Character;
  moves: Move[];
  oosOptions: OosOption[];
}
