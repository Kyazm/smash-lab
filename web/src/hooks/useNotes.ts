// notes の取得・作成・更新・削除・スター/ピン切替をまとめた React フック。
// ページ側の状態管理を薄くするための共通ロジック。notesProvider（Mock/Supabase 切替済み）を使う。
import { useCallback, useEffect, useState } from "react";
import { notesProvider } from "../data/notes";
import type {
  NoteWithMedia,
  NoteCreateInput,
  NoteUpdateInput,
  NoteQuery,
} from "../data/notes/types";

export interface UseNotesResult {
  notes: NoteWithMedia[] | null;
  error: string | null;
  reload: () => Promise<void>;
  create: (input: NoteCreateInput) => Promise<NoteWithMedia>;
  update: (id: string, patch: NoteUpdateInput) => Promise<NoteWithMedia>;
  remove: (id: string) => Promise<void>;
  toggleStar: (note: NoteWithMedia) => Promise<void>;
  togglePin: (note: NoteWithMedia) => Promise<void>;
}

/** query に一致する notes を購読する。query は毎回オブジェクトを新規生成しないよう呼び出し側で安定化すること。 */
export function useNotes(query?: NoteQuery): UseNotesResult {
  const [notes, setNotes] = useState<NoteWithMedia[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // query をキー文字列化して安定な依存にする
  const queryKey = query ? JSON.stringify(query) : "";

  const reload = useCallback(async () => {
    try {
      setError(null);
      const q = queryKey ? (JSON.parse(queryKey) as NoteQuery) : undefined;
      const list = await notesProvider.listNotes(q);
      setNotes(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setNotes([]);
    }
  }, [queryKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const q = queryKey ? (JSON.parse(queryKey) as NoteQuery) : undefined;
        const list = await notesProvider.listNotes(q);
        if (!cancelled) setNotes(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setNotes([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryKey]);

  const create = useCallback(
    async (input: NoteCreateInput) => {
      const created = await notesProvider.createNote(input);
      await reload();
      return created;
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, patch: NoteUpdateInput) => {
      const updated = await notesProvider.updateNote(id, patch);
      await reload();
      return updated;
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await notesProvider.deleteNote(id);
      await reload();
    },
    [reload],
  );

  const toggleStar = useCallback(
    async (note: NoteWithMedia) => {
      await notesProvider.updateNote(note.id, { starred: !note.starred });
      await reload();
    },
    [reload],
  );

  const togglePin = useCallback(
    async (note: NoteWithMedia) => {
      await notesProvider.updateNote(note.id, { pinned: !note.pinned });
      await reload();
    },
    [reload],
  );

  return { notes, error, reload, create, update, remove, toggleStar, togglePin };
}
