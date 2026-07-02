// データ供給インターフェース。FixtureProvider / SupabaseProvider の共通契約。
import type { Character, CharacterBundle } from "../types";

export interface DataProvider {
  listCharacters(): Promise<Character[]>;
  getCharacterBySlug(slug: string): Promise<CharacterBundle | null>;
  /** is_main=true のキャラ（ZSS）一式を返す */
  getMainCharacter(): Promise<CharacterBundle | null>;
}
