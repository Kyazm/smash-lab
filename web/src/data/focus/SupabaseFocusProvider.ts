// Supabase 実装の FocusProvider（ADR-0018）。本人ログイン時の実体。
// RLS: focus_points は user_id = auth.uid() かつ 非ゲスト（0009_practice_loop.sql）。
// insert は user_id を送らず DB default auth.uid() に任せる。
import type { FocusProvider } from "./FocusProvider";
import type { FocusCategory, FocusPoint } from "./types";
import { getSupabaseClient } from "../supabaseClient";

interface FocusRow {
  id: string;
  body: string;
  category: FocusCategory;
  active: boolean;
  created_at: string;
}

function toPoint(r: FocusRow): FocusPoint {
  return { id: r.id, body: r.body, category: r.category, active: r.active, createdAt: r.created_at };
}

const COLS = "id,body,category,active,created_at";

export class SupabaseFocusProvider implements FocusProvider {
  async list(): Promise<FocusPoint[]> {
    const { data, error } = await getSupabaseClient()
      .from("focus_points")
      .select(COLS)
      .order("active", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => toPoint(r as FocusRow));
  }

  async add(body: string, category: FocusCategory): Promise<FocusPoint> {
    const { data, error } = await getSupabaseClient()
      .from("focus_points")
      .insert({ body, category, active: true })
      .select(COLS)
      .single();
    if (error) throw error;
    return toPoint(data as FocusRow);
  }

  async update(id: string, patch: Partial<Pick<FocusPoint, "body" | "category" | "active">>): Promise<void> {
    const { error } = await getSupabaseClient().from("focus_points").update(patch).eq("id", id);
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await getSupabaseClient().from("focus_points").delete().eq("id", id);
    if (error) throw error;
  }
}
