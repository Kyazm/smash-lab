// ゲスト（専用アカウント）サンドボックス用 NotesProvider（ADR-0014 / docs/08 G-3）。
// MockNotesProvider（localStorage永続）を継承し、初回のみ Supabase から notes/note_media/note_proposals を
// SELECT で読み込んでシードにする。以降の読み書きは全てローカル（実DBには一切書き込まない）。
// リロードで残る（同じ storageKey を再利用）。リセットボタンで localStorage を消去する。
import { MockNotesProvider, LocalStore, type Store } from "./MockNotesProvider";
import type { Note, NoteMedia, NoteProposal } from "./types";
import { getSupabaseClient } from "../supabaseClient";

const GUEST_STORAGE_KEY = "smash-lab.guest-notes.v1";

const NOTE_COLUMNS =
  "id,kind,character_id,move_id,player_name,title,body_md,section,starred,pinned,tags,source,created_at,updated_at";
const PROPOSAL_COLUMNS =
  "id,note_id,proposed_body_md,change_summary,engine,base_updated_at,status,created_at";

/**
 * Supabase から notes/note_media/note_proposals を SELECT で取得し Store 形にする。
 * RLS: 0005 で select は authenticated 全員（ゲストの専用アカウント含む）に開放されているため読める。
 * 失敗時（未ログイン・RLS拒否等）は空データにフォールバックする（ゲストは編集はできてよい）。
 */
async function fetchSnapshot(): Promise<Store> {
  const sb = getSupabaseClient();
  try {
    const [notesRes, mediaRes, proposalsRes] = await Promise.all([
      sb.from("notes").select(NOTE_COLUMNS),
      sb.from("note_media").select("id,note_id,type,storage_path,url,caption"),
      sb.from("note_proposals").select(PROPOSAL_COLUMNS),
    ]);
    if (notesRes.error) throw notesRes.error;
    if (mediaRes.error) throw mediaRes.error;
    if (proposalsRes.error) throw proposalsRes.error;
    return {
      notes: (notesRes.data ?? []) as Note[],
      media: (mediaRes.data ?? []) as NoteMedia[],
      proposals: (proposalsRes.data ?? []) as NoteProposal[],
    };
  } catch {
    return { notes: [], media: [], proposals: [] };
  }
}

export class GuestNotesProvider extends MockNotesProvider {
  private readonly guestStore: LocalStore;

  constructor() {
    // 初回は空シード（seedSnapshotで後から流し込む）。既存データがあればそれをそのまま使う。
    const store = new LocalStore(GUEST_STORAGE_KEY, () => ({ notes: [], media: [], proposals: [] }));
    super(store);
    this.guestStore = store;
  }

  /** 初回のみ Supabase スナップショットで初期化する。既にローカルにデータがあれば何もしない（非破壊）。 */
  async seedFromSupabaseIfEmpty(): Promise<void> {
    if (this.guestStore.exists()) return;
    const snapshot = await fetchSnapshot();
    this.guestStore.write(snapshot);
  }

  /** ゲストのローカル編集を全て消去し、Supabaseスナップショットで再シードする。 */
  async reset(): Promise<void> {
    this.guestStore.clear();
    const snapshot = await fetchSnapshot();
    this.guestStore.write(snapshot);
  }
}
