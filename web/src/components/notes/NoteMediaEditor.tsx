// 既存ノートへのメディア追加/削除UI。画像アップロード(モック=DataURL) と YouTube URL 埋込。
import { useState } from "react";
import { notesProvider } from "../../data/notes";
import { parseYouTube } from "../../lib/youtube";
import { NoteMediaView } from "./NoteMediaView";
import type { NoteMedia } from "../../data/notes/types";

interface Props {
  noteId: string;
  media: NoteMedia[];
  /** 追加/削除後の再取得トリガ */
  onChange: () => void;
}

export function NoteMediaEditor({ noteId, media, onChange }: Props) {
  const [ytUrl, setYtUrl] = useState("");
  const [ytCaption, setYtCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addYoutube = async () => {
    setError(null);
    if (!parseYouTube(ytUrl)) {
      setError("YouTube URL（または動画ID）として認識できません");
      return;
    }
    setBusy(true);
    try {
      await notesProvider.addMedia({
        note_id: noteId,
        type: "youtube",
        storage_path: null,
        url: ytUrl.trim(),
        caption: ytCaption.trim() || null,
      });
      setYtUrl("");
      setYtCaption("");
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addImage = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const path = await notesProvider.uploadImage(file);
      await notesProvider.addMedia({
        note_id: noteId,
        type: "image",
        storage_path: path,
        url: null,
        caption: null,
      });
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (mediaId: string) => {
    setError(null);
    try {
      await notesProvider.removeMedia(mediaId);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="mt-3 rounded border border-slate-700 bg-slate-900/40 p-3">
      <h4 className="text-sm font-semibold text-slate-200">メディア</h4>

      {media.length > 0 ? (
        <ul className="mt-2 space-y-3">
          {media.map((m) => (
            <li key={m.id} className="rounded border border-slate-800 p-2">
              <NoteMediaView media={m} />
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="mt-2 text-xs text-red-400 hover:text-red-300"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-slate-500">まだメディアはありません。</p>
      )}

      <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
        <div>
          <label className="block text-xs text-slate-400">画像を追加</label>
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addImage(f);
              e.target.value = "";
            }}
            className="mt-1 block w-full text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400">YouTube URL（開始秒 t= 対応）</label>
          <input
            type="text"
            value={ytUrl}
            onChange={(e) => setYtUrl(e.target.value)}
            placeholder="https://youtu.be/xxxx?t=30"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
          />
          <input
            type="text"
            value={ytCaption}
            onChange={(e) => setYtCaption(e.target.value)}
            placeholder="キャプション（任意）"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-sm text-slate-100"
          />
          <button
            type="button"
            onClick={addYoutube}
            disabled={busy || ytUrl.trim() === ""}
            className="mt-1 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            YouTube を追加
          </button>
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
