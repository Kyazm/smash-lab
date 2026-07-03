// Supabase 実装の MatchProvider（ADR-0015）。本人ログイン時の実体。
// RLS: match_results は user_id = auth.uid() かつ 非ゲスト（0008_match_results.sql）。
// insert は user_id を送らず DB default auth.uid() に任せる（with check で保証）。
import type { MatchProvider } from "./MatchProvider";
import type { MatchQuery, MatchResult, MatchMode, MatchOutcome } from "./types";
import { getSupabaseClient } from "../supabaseClient";

interface MatchRow {
  id: string;
  character_id: string;
  mode: MatchMode;
  result: MatchOutcome;
  created_at: string;
}

function toResult(row: MatchRow): MatchResult {
  return {
    id: row.id,
    characterId: row.character_id,
    mode: row.mode,
    result: row.result,
    createdAt: row.created_at,
  };
}

export class SupabaseMatchProvider implements MatchProvider {
  async listResults(query?: MatchQuery): Promise<MatchResult[]> {
    let q = getSupabaseClient()
      .from("match_results")
      .select("id,character_id,mode,result,created_at");
    if (query?.characterId !== undefined) q = q.eq("character_id", query.characterId);
    if (query?.mode !== undefined) q = q.eq("mode", query.mode);
    // 昇順。同時刻は id で安定化（LocalMatchProvider と同じ順序規約）。
    const { data, error } = await q
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => toResult(r as MatchRow));
  }

  async addResult(input: { characterId: string; mode: MatchMode; result: MatchOutcome }): Promise<MatchResult> {
    const { data, error } = await getSupabaseClient()
      .from("match_results")
      .insert({ character_id: input.characterId, mode: input.mode, result: input.result })
      .select("id,character_id,mode,result,created_at")
      .single();
    if (error) throw error;
    return toResult(data as MatchRow);
  }

  async deleteResult(id: string): Promise<void> {
    const { error } = await getSupabaseClient().from("match_results").delete().eq("id", id);
    if (error) throw error;
  }
}
