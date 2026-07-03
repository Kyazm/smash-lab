// data/imported/*.json（import-framedata パイプラインの実データ）から読み込む DataProvider 実装。
// data/imported/ が存在する場合はこちらが既定になる（data/index.ts で切替）。
// フィクスチャ（data/fixtures/）はテスト用に残す。
//
// import.meta.glob で data/imported/ の存在をビルド時に検出する。ファイルが無い環境では
// glob が空を返すため、その場合は data/index.ts が FixtureProvider にフォールバックする。
import type { DataProvider } from "./DataProvider";
import type { Character, CharacterBundle, Move, OosOption } from "../types";

// eager import。ビルド時に data/imported/ が無ければ空オブジェクトになる。
const importedModules = import.meta.glob("../../../data/imported/{characters,moves,oos_options}.json", {
  eager: true,
}) as Record<string, { default: unknown }>;

function pick(name: string): unknown[] | null {
  const key = Object.keys(importedModules).find((k) => k.endsWith(`/${name}.json`));
  if (!key) return null;
  const mod = importedModules[key];
  return (mod.default ?? mod) as unknown[];
}

/** data/imported/ に3ファイルが揃っているか（=実データ取込済みか） */
export function hasImportedData(): boolean {
  return pick("characters") !== null && pick("moves") !== null && pick("oos_options") !== null;
}

export class ImportedProvider implements DataProvider {
  private characters: Character[];
  private moves: Move[];
  private oosOptions: OosOption[];

  constructor() {
    this.characters = (pick("characters") ?? []) as Character[];
    this.moves = (pick("moves") ?? []) as Move[];
    this.oosOptions = (pick("oos_options") ?? []) as OosOption[];
  }

  /** ADR-0013: is_main のランタイム上書き。単一キャラのみtrueになるよう配列を作り直す。 */
  setMainCharacterOverride(characterId: string): void {
    this.characters = this.characters.map((c) => ({ ...c, is_main: c.id === characterId }));
  }

  private buildBundle(character: Character): CharacterBundle {
    const charMoves = this.moves.filter((m) => m.character_id === character.id);
    const moveIds = new Set(charMoves.map((m) => m.id));
    const charOosOptions = this.oosOptions.filter((o) => moveIds.has(o.move_id));
    return { character, moves: charMoves, oosOptions: charOosOptions };
  }

  async listCharacters(): Promise<Character[]> {
    // fighter_number 昇順で安定表示（null は末尾）
    return [...this.characters].sort(
      (a, b) => (a.fighter_number ?? 9999) - (b.fighter_number ?? 9999),
    );
  }

  async getCharacterBySlug(slug: string): Promise<CharacterBundle | null> {
    const character = this.characters.find((c) => c.slug === slug);
    if (!character) return null;
    return this.buildBundle(character);
  }

  async getMainCharacter(): Promise<CharacterBundle | null> {
    const character = this.characters.find((c) => c.is_main);
    if (!character) return null;
    return this.buildBundle(character);
  }
}
