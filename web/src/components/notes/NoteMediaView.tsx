// 1件のメディア表示。youtube=埋込プレイヤー(開始秒対応) / image=Storage解決 / local_video=リンク。
import { notesProvider } from "../../data/notes";
import { youtubeInputToEmbedUrl } from "../../lib/youtube";
import type { NoteMedia } from "../../data/notes/types";

interface Props {
  media: NoteMedia;
}

export function NoteMediaView({ media }: Props) {
  const caption = media.caption ? (
    <p className="mt-1 text-xs text-ink-secondary">{media.caption}</p>
  ) : null;

  if (media.type === "youtube") {
    const embed = media.url ? youtubeInputToEmbedUrl(media.url) : null;
    if (!embed) {
      return (
        <div>
          <a
            href={media.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-action-strong underline"
          >
            {media.url ?? "（無効なYouTube URL）"}
          </a>
          {caption}
        </div>
      );
    }
    return (
      <div>
        <div className="relative w-full overflow-hidden rounded" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={embed}
            title={media.caption ?? "YouTube"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        {caption}
      </div>
    );
  }

  if (media.type === "image") {
    const src = media.storage_path ? notesProvider.resolveImageUrl(media.storage_path) : "";
    return (
      <div>
        <img
          src={src}
          alt={media.caption ?? ""}
          className="max-h-80 max-w-full rounded border border-border object-contain"
        />
        {caption}
      </div>
    );
  }

  // local_video
  return (
    <div>
      <a
        href={media.url ?? "#"}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-action-strong underline"
      >
        🎞 ローカル動画を開く
      </a>
      {caption}
    </div>
  );
}
