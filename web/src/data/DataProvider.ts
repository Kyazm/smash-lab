// データ供給インターフェース。FixtureProvider / SupabaseProvider の共通契約。
import type { Character, CharacterBundle } from "../types";

export interface DataProvider {
  listCharacters(): Promise<Character[]>;
  getCharacterBySlug(slug: string): Promise<CharacterBundle | null>;
  /** is_main=true のキャラ（ZSS）一式を返す */
  getMainCharacter(): Promise<CharacterBundle | null>;
  /**
   * 自キャラ（is_main）のランタイム上書き（ADR-0013 / G-2）。
   * フレームデータ（characters/moves/oos_options）は data/imported/ の静的JSON由来でビルド時固定のため、
   * Supabase 側の set_main_character RPC で実DBを更新した後、フロント表示にも即時反映するために呼ぶ。
   * 同期的にローカル状態を差し替えるのみ（DB書込はUI層がRPC/呼び出し元で行う）。
   */
  setMainCharacterOverride(characterId: string): void;
}
