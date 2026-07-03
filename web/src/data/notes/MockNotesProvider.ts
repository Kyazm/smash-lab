// localStorage 永続の NotesProvider 実装（ADR-0008）。開発・ブラウザ検証の既定。
// 実 Supabase DB が未適用のため、これで全 UI を動作検証する。
// 画像は DataURL を storage_path に格納し、resolveImageUrl はそのまま返す。
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
import { filterAndSort, searchAndSort } from "../../lib/noteQuery";
import { SEED_NOTES, SEED_MEDIA, SEED_PROPOSALS } from "./mockSeed";
import { dataProvider } from "../index";

// シードデータ形状の変更（AI整頓の提案seed追加）に伴い、旧バージョンのlocalStorageと衝突しないようにバージョンを上げる。
const STORAGE_KEY = "smash-lab.notes.v2";

export interface Store {
  notes: Note[];
  media: NoteMedia[];
  proposals: NoteProposal[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function genId(): string {
  // crypto.randomUUID はモダンブラウザ・Node18+ で利用可
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function defaultSeed(): Store {
  return {
    notes: SEED_NOTES.map((n) => ({ ...n, tags: [...n.tags] })),
    media: SEED_MEDIA.map((m) => ({ ...m })),
    proposals: SEED_PROPOSALS.map((p) => ({ ...p })),
  };
}

/**
 * 永続層の薄いラッパ。localStorage が無い環境（SSR/テスト）ではメモリに退避。
 * storageKey とシード関数を注入可能にし、ゲスト用（GuestNotesProvider）に別キー・別シードで
 * 使い回せるようにする（ADR-0014）。
 */
export class LocalStore {
  private memory: Store | null = null;

  constructor(
    private readonly storageKey: string = STORAGE_KEY,
    private readonly seed: () => Store = defaultSeed,
  ) {}

  private hasLocalStorage(): boolean {
    try {
      return typeof localStorage !== "undefined";
    } catch {
      return false;
    }
  }

  read(): Store {
    if (this.hasLocalStorage()) {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        try {
          return JSON.parse(raw) as Store;
        } catch {
          // 壊れていたら seed で再初期化
        }
      }
      const seeded = this.seed();
      this.write(seeded);
      return seeded;
    }
    if (this.memory == null) this.memory = this.seed();
    return this.memory;
  }

  write(store: Store): void {
    if (this.hasLocalStorage()) {
      localStorage.setItem(this.storageKey, JSON.stringify(store));
    } else {
      this.memory = store;
    }
  }

  /** localStorage/メモリを完全に消去する（ゲストのリセットボタン用）。 */
  clear(): void {
    if (this.hasLocalStorage()) {
      localStorage.removeItem(this.storageKey);
    }
    this.memory = null;
  }

  /** 既にデータが書き込まれているか（localStorage/メモリいずれか）。初回シード要否の判定に使う。 */
  exists(): boolean {
    if (this.hasLocalStorage()) {
      return localStorage.getItem(this.storageKey) != null;
    }
    return this.memory != null;
  }
}

export class MockNotesProvider implements NotesProvider {
  private store: LocalStore;

  constructor(store: LocalStore = new LocalStore()) {
    this.store = store;
  }

  private attachMedia(note: Note, allMedia: NoteMedia[]): NoteWithMedia {
    return { ...note, media: allMedia.filter((m) => m.note_id === note.id) };
  }

  async listNotes(query?: NoteQuery): Promise<NoteWithMedia[]> {
    const { notes, media } = this.store.read();
    return filterAndSort(notes, query).map((n) => this.attachMedia(n, media));
  }

  async getNote(id: string): Promise<NoteWithMedia | null> {
    const { notes, media } = this.store.read();
    const note = notes.find((n) => n.id === id);
    return note ? this.attachMedia(note, media) : null;
  }

  async createNote(input: NoteCreateInput): Promise<NoteWithMedia> {
    const store = this.store.read();
    const ts = nowIso();
    const note: Note = {
      id: genId(),
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
      created_at: ts,
      updated_at: ts,
    };
    store.notes.push(note);
    this.store.write(store);
    return this.attachMedia(note, store.media);
  }

  async updateNote(id: string, patch: NoteUpdateInput): Promise<NoteWithMedia> {
    const store = this.store.read();
    const idx = store.notes.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error(`note ${id} not found`);
    const updated: Note = {
      ...store.notes[idx],
      ...patch,
      // id/timestamps は patch から除外済みだが念のため保護
      id,
      created_at: store.notes[idx].created_at,
      updated_at: nowIso(),
    };
    store.notes[idx] = updated;
    this.store.write(store);
    return this.attachMedia(updated, store.media);
  }

  async deleteNote(id: string): Promise<void> {
    const store = this.store.read();
    store.notes = store.notes.filter((n) => n.id !== id);
    store.media = store.media.filter((m) => m.note_id !== id);
    this.store.write(store);
  }

  async addMedia(input: NoteMediaCreateInput): Promise<NoteMedia> {
    const store = this.store.read();
    const media: NoteMedia = { id: genId(), ...input };
    store.media.push(media);
    this.store.write(store);
    return media;
  }

  async removeMedia(mediaId: string): Promise<void> {
    const store = this.store.read();
    store.media = store.media.filter((m) => m.id !== mediaId);
    this.store.write(store);
  }

  async uploadImage(file: File): Promise<string> {
    // モックは DataURL 化して storage_path に格納
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error("read failed"));
      reader.readAsDataURL(file);
    });
  }

  resolveImageUrl(storagePath: string): string {
    // DataURL はそのまま表示可能
    return storagePath;
  }

  async searchNotes(keyword: string): Promise<NoteWithMedia[]> {
    const { notes, media } = this.store.read();
    return searchAndSort(notes, keyword).map((n) => this.attachMedia(n, media));
  }

  async listProposals(noteId?: string): Promise<NoteProposal[]> {
    const { proposals } = this.store.read();
    const filtered = noteId === undefined ? proposals : proposals.filter((p) => p.note_id === noteId);
    return [...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  /**
   * apply_note_proposal RPC(0002_note_proposals.sql)と同じ楽観ロック挙動をローカルで再現する。
   * base_updated_at と現在の notes.updated_at が不一致なら stale にして中断（承認前の手動編集を上書きしない）。
   */
  async applyProposal(proposalId: string): Promise<ApplyProposalResult> {
    const store = this.store.read();
    const proposal = store.proposals.find((p) => p.id === proposalId);
    if (!proposal) throw new Error(`note_proposal ${proposalId} not found`);
    if (proposal.status !== "pending") {
      throw new Error(`note_proposal ${proposalId} is not pending (status=${proposal.status})`);
    }
    const note = store.notes.find((n) => n.id === proposal.note_id);
    if (!note) throw new Error(`note ${proposal.note_id} not found`);

    if (note.updated_at !== proposal.base_updated_at) {
      proposal.status = "stale";
      this.store.write(store);
      return "stale";
    }

    note.body_md = proposal.proposed_body_md;
    note.updated_at = nowIso();
    proposal.status = "accepted";
    this.store.write(store);
    return "accepted";
  }

  async rejectProposal(proposalId: string): Promise<void> {
    const store = this.store.read();
    const proposal = store.proposals.find((p) => p.id === proposalId);
    if (!proposal) throw new Error(`note_proposal ${proposalId} not found`);
    if (proposal.status !== "pending") {
      throw new Error(`note_proposal ${proposalId} is not pending (status=${proposal.status})`);
    }
    proposal.status = "rejected";
    this.store.write(store);
  }

  /**
   * note_proposals → notes → characters のJOINを手元データで模す（docs/07 F-A）。
   * dataProvider（フレームデータ側）からキャラ名解決する。own系ノートはcharacterName/Slugがnull。
   */
  async listPendingProposals(): Promise<PendingProposalItem[]> {
    const { notes, proposals } = this.store.read();
    const pending = proposals.filter((p) => p.status === "pending" || p.status === "stale");
    if (pending.length === 0) return [];

    const characters = await dataProvider.listCharacters();
    const charById = new Map(characters.map((c) => [c.id, c]));

    const sorted = [...pending].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return sorted.map((proposal) => {
      const note = notes.find((n) => n.id === proposal.note_id);
      const character = note?.character_id ? charById.get(note.character_id) : undefined;
      return {
        proposal,
        noteTitle: note?.title ?? null,
        kind: note?.kind ?? "matchup",
        characterName: character?.name_ja ?? null,
        characterSlug: character?.slug ?? null,
      };
    });
  }
}
