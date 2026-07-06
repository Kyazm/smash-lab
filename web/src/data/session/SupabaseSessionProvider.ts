// Supabase 実装の SessionProvider（ADR-0018）。本人ログイン時の実体。
// RLS: sessions は user_id = auth.uid() かつ 非ゲスト（0009_practice_loop.sql）。
// 重要: started_at は送らず DB default now() を正とする（match_results.created_at と同じサーバ時計に
// 統一。端末時計がズレていると開始直後の記録が時間窓から漏れるため）。dateはローカル日付で送る。
// activeの一意性は部分ユニークインデックスがDBレベルで保証。insertが23505で失敗したら
// 既存activeを取得して返す（多重タブ競合の収束）。
import type { SessionProvider } from "./SessionProvider";
import type { PracticeSession } from "./types";
import { getSupabaseClient } from "../supabaseClient";

interface SessionRow {
  id: string;
  goal: string | null;
  started_at: string;
  ended_at: string | null;
  retro_md: string | null;
}

function toSession(r: SessionRow): PracticeSession {
  return {
    id: r.id,
    goal: r.goal ?? "",
    startedAt: r.started_at,
    endedAt: r.ended_at,
    retroMd: r.retro_md,
  };
}

/** ローカルタイムゾーンの日付（YYYY-MM-DD）。UTC ISOの先頭10文字はJST深夜に前日となるため使わない。 */
function localDateString(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const COLS = "id,goal,started_at,ended_at,retro_md";

export class SupabaseSessionProvider implements SessionProvider {
  async getActive(): Promise<PracticeSession | null> {
    const { data, error } = await getSupabaseClient()
      .from("sessions")
      .select(COLS)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? toSession(data as SessionRow) : null;
  }

  async start(goal: string): Promise<PracticeSession> {
    const sb = getSupabaseClient();
    // 既存activeを自動クローズ（振り返りnullのまま＝後から書ける）
    const { error: closeErr } = await sb
      .from("sessions")
      .update({ ended_at: new Date().toISOString() })
      .is("ended_at", null);
    if (closeErr) throw closeErr;

    const { data, error } = await sb
      .from("sessions")
      .insert({ goal, date: localDateString() })
      .select(COLS)
      .single();
    if (error) {
      // 23505 = 部分ユニーク違反（多重タブで同時startした側）。既存activeに収束させる。
      if ((error as { code?: string }).code === "23505") {
        const active = await this.getActive();
        if (active) return active;
      }
      throw error;
    }
    return toSession(data as SessionRow);
  }

  async finish(id: string, retroMd: string | null): Promise<void> {
    const sb = getSupabaseClient();
    // 終了済みなら ended_at は上書きしない（後書きretro対応）。
    const { data, error } = await sb.from("sessions").select("ended_at").eq("id", id).single();
    if (error) throw error;
    const patch: Record<string, unknown> = { retro_md: retroMd };
    if ((data as { ended_at: string | null }).ended_at == null) {
      patch.ended_at = new Date().toISOString();
    }
    const { error: updErr } = await sb.from("sessions").update(patch).eq("id", id);
    if (updErr) throw updErr;
  }

  async listRecent(n: number): Promise<PracticeSession[]> {
    const { data, error } = await getSupabaseClient()
      .from("sessions")
      .select(COLS)
      .order("started_at", { ascending: false })
      .limit(n);
    if (error) throw error;
    return (data ?? []).map((r) => toSession(r as SessionRow));
  }
}
