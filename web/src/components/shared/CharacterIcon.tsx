// キャラアイコン表示（FU-8 B）。外部CDN(jsDelivr)を img src で参照し、
// 404/障害/URL無し時はカタカナ頭文字チップにフォールバックする堅牢実装。
// onError は state で一度だけチップに切替え、コンソールに大量エラーを出さない
// （img の onError はネットワークエラーを console に自動出力しないため、静かに処理される）。
import { useState } from "react";
import { iconUrl } from "../../lib/characterIcon";
import type { Character } from "../../types";

type Size = "sm" | "lg";

// sm: 一覧行（h-8 w-8）, lg: キャラページヘッダー（h-12 w-12）
const SIZE_CLASS: Record<Size, { box: string; text: string }> = {
  sm: { box: "h-8 w-8", text: "text-xs" },
  lg: { box: "h-12 w-12", text: "text-base" },
};

export function CharacterIcon({
  character,
  size = "sm",
  className = "",
}: {
  character: Pick<Character, "slug" | "name_ja">;
  size?: Size;
  className?: string;
}) {
  const url = iconUrl(character);
  const [failed, setFailed] = useState(false);
  const { box, text } = SIZE_CLASS[size];
  const initial = character.name_ja.slice(0, 1);

  if (!url || failed) {
    return (
      <span
        aria-hidden="true"
        className={`flex ${box} shrink-0 items-center justify-center rounded bg-surface-2 ${text} text-ink-muted ${className}`}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${box} shrink-0 rounded object-contain ${className}`}
    />
  );
}
