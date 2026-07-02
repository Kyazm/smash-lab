// Supabase クライアント（シングルトン）。anon(publishable) キー + RLS が防御線（docs/02 セキュリティ）。
// URL/キーは VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（web/.env、gitignore対象）から読む。
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定です（web/.env を確認）",
    );
  }
  client = createClient(url, key);
  return client;
}

/** note_media の画像を置く Storage バケット名。実 DB では事前に作成が必要（Phase 2 残作業）。 */
export const NOTE_MEDIA_BUCKET = "note-media";
