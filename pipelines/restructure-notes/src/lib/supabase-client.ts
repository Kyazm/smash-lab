// Supabase PostgREST 直叩きクライアント（service role キー）。
// import-discord と異なりSQLファイル出力ではなく、本番DBに対してAPI経由で読み書きする
// （note_proposals への投入はDB未接続では検証できないため）。

export interface SupabaseConfig {
  url: string; // 例: https://xxxx.supabase.co
  serviceRoleKey: string;
}

export interface NoteRow {
  id: string;
  kind: string;
  character_id: string | null;
  title: string | null;
  body_md: string | null;
  updated_at: string;
}

export interface CharacterRow {
  id: string;
  name_ja: string;
  name_en: string;
}

export interface NoteProposalRow {
  id: string;
  note_id: string;
  proposed_body_md: string;
  change_summary: string | null;
  engine: string | null;
  base_updated_at: string;
  status: string;
  created_at: string;
}

function headers(cfg: SupabaseConfig, extra?: Record<string, string>): Record<string, string> {
  return {
    apikey: cfg.serviceRoleKey,
    Authorization: `Bearer ${cfg.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function assertOk(res: Response, label: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${label} failed: ${res.status} ${res.statusText} ${body.slice(0, 500)}`);
  }
}

export async function fetchMatchupNotes(cfg: SupabaseConfig): Promise<NoteRow[]> {
  const url = `${cfg.url}/rest/v1/notes?kind=eq.matchup&select=id,kind,character_id,title,body_md,updated_at&order=id.asc`;
  const res = await fetch(url, { headers: headers(cfg) });
  await assertOk(res, "fetchMatchupNotes");
  return (await res.json()) as NoteRow[];
}

export async function fetchCharactersById(
  cfg: SupabaseConfig,
): Promise<Map<string, CharacterRow>> {
  const url = `${cfg.url}/rest/v1/characters?select=id,name_ja,name_en`;
  const res = await fetch(url, { headers: headers(cfg) });
  await assertOk(res, "fetchCharactersById");
  const rows = (await res.json()) as CharacterRow[];
  return new Map(rows.map((r) => [r.id, r]));
}

/** 既存 pending 提案があるノートIDの集合を取得する（冪等性用）。 */
export async function fetchPendingProposalNoteIds(cfg: SupabaseConfig): Promise<Set<string>> {
  const url = `${cfg.url}/rest/v1/note_proposals?status=eq.pending&select=note_id`;
  const res = await fetch(url, { headers: headers(cfg) });
  await assertOk(res, "fetchPendingProposalNoteIds");
  const rows = (await res.json()) as Array<{ note_id: string }>;
  return new Set(rows.map((r) => r.note_id));
}

export interface InsertProposalInput {
  note_id: string;
  proposed_body_md: string;
  change_summary: string | null;
  engine: string;
  base_updated_at: string;
}

export async function insertNoteProposal(
  cfg: SupabaseConfig,
  input: InsertProposalInput,
): Promise<NoteProposalRow> {
  const url = `${cfg.url}/rest/v1/note_proposals`;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(cfg, { Prefer: "return=representation" }),
    body: JSON.stringify(input),
  });
  await assertOk(res, "insertNoteProposal");
  const rows = (await res.json()) as NoteProposalRow[];
  return rows[0];
}
