// "/me" は廃止（ADR-0009）。使用キャラ（characters.is_main）を動的解決し `/c/:slug?tab=own` へリダイレクトする。
// slugをハードコードしないため使用キャラ変更に耐える。AuthGateがRouter外側のため、認証後も同URLがそのまま解決される。
// ADR-0013 (G-2): is_main の実効値は useMainCharacter()（Context）から取得する。
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { dataProvider } from "../data";
import { useMainCharacter } from "../lib/mainCharacterContext";
import type { CharacterBundle } from "../types";

export function MainCharacterPage() {
  const { mainCharacterId } = useMainCharacter();
  const [main, setMain] = useState<CharacterBundle | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    dataProvider.getMainCharacter().then((m) => {
      if (!cancelled) setMain(m);
    });
    return () => {
      cancelled = true;
    };
  }, [mainCharacterId]);

  if (main === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="text-sm text-ink-muted">読み込み中…</p>
      </div>
    );
  }

  if (main === null) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <p className="text-sm text-ink-muted">
          使用キャラ（is_main=true）のデータが見つかりません。
        </p>
        <Link to="/" className="mt-2 inline-block text-sm text-action-strong">
          一覧へ戻る
        </Link>
      </div>
    );
  }

  return <Navigate to={`/c/${main.character.slug}?tab=own`} replace />;
}
