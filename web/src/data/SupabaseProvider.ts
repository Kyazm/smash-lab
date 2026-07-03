// Supabase 接続実装のスタブ（Phase 1 未実装）。VITE_DATA_PROVIDER=supabase 選択時のみ使われる。
import type { DataProvider } from "./DataProvider";
import type { Character, CharacterBundle } from "../types";

export class SupabaseProvider implements DataProvider {
  async listCharacters(): Promise<Character[]> {
    throw new Error("SupabaseProvider not implemented (Phase 1)");
  }

  async getCharacterBySlug(_slug: string): Promise<CharacterBundle | null> {
    throw new Error("SupabaseProvider not implemented (Phase 1)");
  }

  async getMainCharacter(): Promise<CharacterBundle | null> {
    throw new Error("SupabaseProvider not implemented (Phase 1)");
  }

  setMainCharacterOverride(_characterId: string): void {
    throw new Error("SupabaseProvider not implemented (Phase 1)");
  }
}
