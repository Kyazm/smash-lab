// メモ供給インターフェース。MockNotesProvider / SupabaseNotesProvider の共通契約。
// フレームデータ供給（../DataProvider.ts）とは責務を分離する（ADR-0008）。
import type {
  NoteWithMedia,
  NoteCreateInput,
  NoteUpdateInput,
  NoteMedia,
  NoteMediaCreateInput,
  NoteQuery,
  NoteProposal,
  ApplyProposalResult,
} from "./types";

export interface NotesProvider {
  /** 条件に一致するノートを media 付きで返す（updated_at 降順） */
  listNotes(query?: NoteQuery): Promise<NoteWithMedia[]>;
  /** 単一ノートを media 付きで返す。無ければ null */
  getNote(id: string): Promise<NoteWithMedia | null>;
  createNote(input: NoteCreateInput): Promise<NoteWithMedia>;
  updateNote(id: string, patch: NoteUpdateInput): Promise<NoteWithMedia>;
  deleteNote(id: string): Promise<void>;

  /** ノートにメディアを追加 */
  addMedia(input: NoteMediaCreateInput): Promise<NoteMedia>;
  removeMedia(mediaId: string): Promise<void>;

  /**
   * 画像をアップロードし、参照可能な文字列を返す。
   * - Mock: DataURL をそのまま返す（storage_path に格納）
   * - Supabase: Storage にアップロードし path を返す
   * 返り値は note_media.storage_path に入れる想定。
   */
  uploadImage(file: File): Promise<string>;

  /**
   * storage_path から表示用 URL を解決する。
   * - Mock: DataURL はそのまま返す
   * - Supabase: getPublicUrl / signedUrl
   */
  resolveImageUrl(storagePath: string): string;

  /**
   * notes.title / body_md / tags を対象に部分一致検索（ILIKE 相当）。
   * 検索結果はキャラ/技レーンとは別（呼び出し側でレーン分け）。
   */
  searchNotes(keyword: string): Promise<NoteWithMedia[]>;

  // ── AI整頓（ADR-0010）: 提案・承認制。listNotes等と同じProviderに同居させる（notesと密結合のため、ADR-0008追補） ──

  /** 指定ノートの提案一覧（created_at 降順）。noteId 省略時は全ノート分。 */
  listProposals(noteId?: string): Promise<NoteProposal[]>;
  /**
   * 提案を承認する。楽観ロック: 生成時の base_updated_at と現在の notes.updated_at が一致する場合のみ
   * body_md を置き換え、不一致なら 'stale' を返して中断する（承認前の手動編集を上書きしない）。
   * 承認前に note_revisions へ旧本文を保全する。
   */
  applyProposal(proposalId: string): Promise<ApplyProposalResult>;
  /** 提案を却下する（pending以外は例外）。 */
  rejectProposal(proposalId: string): Promise<void>;
}
