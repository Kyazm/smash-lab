// 実 Supabase DB 用の NotesProvider 実装（ADR-0008）。
// migration 適用・Auth ログイン後に有効化する（VITE_NOTES_PROVIDER=supabase）。
// notes/note_media テーブルと Storage バケット(NOTE_MEDIA_BUCKET) を使う。
// RLS: authenticated ロールに全権（0001_schema.sql）。認証はアプリのログイン UI で確立する前提。
import type { NotesProvider } from "./NotesProvider";
import type {
  Note,
  NoteMedia,
  NoteWithMedia,
  NoteCreateInput,
  NoteUpdateInput,
  NoteMediaCreateInput,
  NoteQuery,
  NoteProposal,
  ApplyProposalResult,
  PendingProposalItem,
} from "./types";
import { getSupabaseClient, NOTE_MEDIA_BUCKET } from "../supabaseClient";

const NOTE_COLUMNS =
  "id,kind,character_id,move_id,player_name,title,body_md,section,starred,pinned,tags,source,created_at,updated_at";

const PROPOSAL_COLUMNS =
  "id,note_id,proposed_body_md,change_summary,engine,base_updated_at,status,created_at";

function genPath(fileName: string): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop() : "png";
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${rand}.${ext}`;
}

export class SupabaseNotesProvider implements NotesProvider {
  private get sb() {
    return getSupabaseClient();
  }

  private async mediaFor(noteIds: string[]): Promise<Map<string, NoteMedia[]>> {
    const map = new Map<string, NoteMedia[]>();
    if (noteIds.length === 0) return map;
    const { data, error } = await this.sb
      .from("note_media")
      .select("id,note_id,type,storage_path,url,caption")
      .in("note_id", noteIds);
    if (error) throw error;
    for (const m of (data ?? []) as NoteMedia[]) {
      const arr = map.get(m.note_id) ?? [];
      arr.push(m);
      map.set(m.note_id, arr);
    }
    return map;
  }

  private async attach(notes: Note[]): Promise<NoteWithMedia[]> {
    const map = await this.mediaFor(notes.map((n) => n.id));
    return notes.map((n) => ({ ...n, media: map.get(n.id) ?? [] }));
  }

  async listNotes(query?: NoteQuery): Promise<NoteWithMedia[]> {
    let q = this.sb.from("notes").select(NOTE_COLUMNS);
    if (query?.kind !== undefined) q = q.eq("kind", query.kind);
    if (query?.move_id !== undefined) q = q.eq("move_id", query.move_id);
    if (query?.starred !== undefined) q = q.eq("starred", query.starred);
    if (query?.pinned !== undefined) q = q.eq("pinned", query.pinned);
    if (query?.character_id !== undefined) {
      q = query.character_id === null ? q.is("character_id", null) : q.eq("character_id", query.character_id);
    }
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) throw error;
    return this.attach((data ?? []) as Note[]);
  }

  async getNote(id: string): Promise<NoteWithMedia | null> {
    const { data, error } = await this.sb
      .from("notes")
      .select(NOTE_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [withMedia] = await this.attach([data as Note]);
    return withMedia;
  }

  async createNote(input: NoteCreateInput): Promise<NoteWithMedia> {
    const row = {
      kind: input.kind,
      character_id: input.character_id ?? null,
      move_id: input.move_id ?? null,
      player_name: input.player_name ?? null,
      title: input.title ?? null,
      body_md: input.body_md ?? null,
      section: input.section ?? null,
      starred: input.starred ?? false,
      pinned: input.pinned ?? false,
      tags: input.tags ?? [],
      source: input.source ?? "manual",
    };
    const { data, error } = await this.sb.from("notes").insert(row).select(NOTE_COLUMNS).single();
    if (error) throw error;
    const [withMedia] = await this.attach([data as Note]);
    return withMedia;
  }

  async updateNote(id: string, patch: NoteUpdateInput): Promise<NoteWithMedia> {
    // updated_at は DB トリガ(notes_set_updated_at)が更新するため送らない
    const { data, error } = await this.sb
      .from("notes")
      .update(patch)
      .eq("id", id)
      .select(NOTE_COLUMNS)
      .single();
    if (error) throw error;
    const [withMedia] = await this.attach([data as Note]);
    return withMedia;
  }

  async deleteNote(id: string): Promise<void> {
    // note_media は ON DELETE CASCADE（0001_schema.sql）で自動削除される
    const { error } = await this.sb.from("notes").delete().eq("id", id);
    if (error) throw error;
  }

  async addMedia(input: NoteMediaCreateInput): Promise<NoteMedia> {
    const { data, error } = await this.sb
      .from("note_media")
      .insert(input)
      .select("id,note_id,type,storage_path,url,caption")
      .single();
    if (error) throw error;
    return data as NoteMedia;
  }

  async removeMedia(mediaId: string): Promise<void> {
    const { error } = await this.sb.from("note_media").delete().eq("id", mediaId);
    if (error) throw error;
  }

  async uploadImage(file: File): Promise<string> {
    const path = genPath(file.name);
    const { error } = await this.sb.storage
      .from(NOTE_MEDIA_BUCKET)
      .upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  }

  resolveImageUrl(storagePath: string): string {
    // DataURL がそのまま来た場合（モックからの移行データ等）はそのまま返す
    if (storagePath.startsWith("data:")) return storagePath;
    const { data } = this.sb.storage.from(NOTE_MEDIA_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  async searchNotes(keyword: string): Promise<NoteWithMedia[]> {
    const k = keyword.trim();
    if (k === "") return [];
    // title / body_md の部分一致（ILIKE）。tags(text[]) は cs でトークン一致を別途 OR。
    // pg_trgm インデックスが効く（0001_schema.sql）。
    const pattern = `%${k}%`;
    const { data, error } = await this.sb
      .from("notes")
      .select(NOTE_COLUMNS)
      .or(`title.ilike.${pattern},body_md.ilike.${pattern}`)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const byTitleBody = (data ?? []) as Note[];

    // tags 一致分を別クエリで取得し id 重複排除して統合
    const { data: tagData, error: tagErr } = await this.sb
      .from("notes")
      .select(NOTE_COLUMNS)
      .contains("tags", [k])
      .order("updated_at", { ascending: false });
    if (tagErr) throw tagErr;

    const seen = new Set(byTitleBody.map((n) => n.id));
    const merged = [...byTitleBody];
    for (const n of (tagData ?? []) as Note[]) {
      if (!seen.has(n.id)) merged.push(n);
    }
    return this.attach(merged);
  }

  async listProposals(noteId?: string): Promise<NoteProposal[]> {
    let q = this.sb.from("note_proposals").select(PROPOSAL_COLUMNS);
    if (noteId !== undefined) q = q.eq("note_id", noteId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as NoteProposal[];
  }

  async applyProposal(proposalId: string): Promise<ApplyProposalResult> {
    const { data, error } = await this.sb.rpc("apply_note_proposal", {
      p_proposal_id: proposalId,
    });
    if (error) throw error;
    return data as ApplyProposalResult;
  }

  async rejectProposal(proposalId: string): Promise<void> {
    const { error } = await this.sb.rpc("reject_note_proposal", {
      p_proposal_id: proposalId,
    });
    if (error) throw error;
  }

  async listPendingProposals(): Promise<PendingProposalItem[]> {
    // note_proposals → notes → characters をネストselectで1クエリJOIN（docs/07 F-A）。
    const { data, error } = await this.sb
      .from("note_proposals")
      .select(
        `${PROPOSAL_COLUMNS},notes(title,kind,character_id,characters(name_ja,slug))`,
      )
      .in("status", ["pending", "stale"])
      .order("created_at", { ascending: false });
    if (error) throw error;

    type Row = NoteProposal & {
      notes: {
        title: string | null;
        kind: NoteWithMedia["kind"];
        character_id: string | null;
        characters: { name_ja: string; slug: string } | null;
      } | null;
    };

    return ((data ?? []) as unknown as Row[]).map((row) => {
      const { notes, ...proposal } = row;
      return {
        proposal,
        noteTitle: notes?.title ?? null,
        kind: notes?.kind ?? "matchup",
        characterName: notes?.characters?.name_ja ?? null,
        characterSlug: notes?.characters?.slug ?? null,
      };
    });
  }
}
