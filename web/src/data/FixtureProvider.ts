// data/fixtures/*.json から読み込む DataProvider 実装（Phase 1 既定プロバイダ）。
// fixtures はプレースホルダ値（data/fixtures/README.md 参照）。
import type { DataProvider } from "./DataProvider";
import type { Character, CharacterBundle, Move, OosOption } from "../types";

import charactersJson from "../../../data/fixtures/characters.json";
import movesJson from "../../../data/fixtures/moves.json";
import oosOptionsJson from "../../../data/fixtures/oos_options.json";

const characters = charactersJson as Character[];
const moves = movesJson as Move[];
const oosOptions = oosOptionsJson as OosOption[];

function buildBundle(character: Character): CharacterBundle {
  const charMoves = moves.filter((m) => m.character_id === character.id);
  const moveIds = new Set(charMoves.map((m) => m.id));
  const charOosOptions = oosOptions.filter((o) => moveIds.has(o.move_id));
  return { character, moves: charMoves, oosOptions: charOosOptions };
}

export class FixtureProvider implements DataProvider {
  async listCharacters(): Promise<Character[]> {
    return characters;
  }

  async getCharacterBySlug(slug: string): Promise<CharacterBundle | null> {
    const character = characters.find((c) => c.slug === slug);
    if (!character) return null;
    return buildBundle(character);
  }

  async getMainCharacter(): Promise<CharacterBundle | null> {
    const character = characters.find((c) => c.is_main);
    if (!character) return null;
    return buildBundle(character);
  }
}
