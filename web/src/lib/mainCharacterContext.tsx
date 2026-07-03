// 自キャラ（is_main）選択のContext化（ADR-0013 / docs/08 G-2）。
// フレームデータ（characters/moves/oos_options）は data/imported/ の静的JSONが実体でビルド時固定のため、
// dataProvider.setMainCharacterOverride() でランタイム上書きし、この Context 経由で変更を配下に伝播する。
// 本人ログイン時は set_main_character RPC で実DBも更新。ゲスト時（useIsGuest()=専用アカウント）は
// ローカル状態のみ変更（実DBの is_main は変えない、ADR-0014）。mockモードはRPCなしでローカルのみ変更。
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { dataProvider } from "../data";
import { resolveNotesProviderKind } from "./providerMode";
import { getSupabaseClient } from "../data/supabaseClient";
import { useIsGuest } from "./guestContext";

const notesProviderKind = resolveNotesProviderKind(
  import.meta.env.VITE_NOTES_PROVIDER,
  import.meta.env.VITE_DATA_PROVIDER,
);

interface MainCharacterContextValue {
  /** 現在の自キャラID。未確定時は null。 */
  mainCharacterId: string | null;
  /** 自キャラを切り替える。本人ならSupabase RPCで実DBも更新、ゲスト/mockはローカルのみ。 */
  setMainCharacter: (characterId: string) => Promise<void>;
}

const MainCharacterContext = createContext<MainCharacterContextValue | null>(null);

export function MainCharacterProvider({ children }: { children: ReactNode }) {
  const isGuest = useIsGuest();
  const [mainCharacterId, setMainCharacterId] = useState<string | null>(null);

  // 初期化: Supabaseモード時は characters.is_main の実値を取得して dataProvider に反映
  // （静的JSONのis_mainと実DBがズレている可能性があるため、起動時に一度だけ同期する）。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (notesProviderKind === "supabase") {
        try {
          const { data, error } = await getSupabaseClient()
            .from("characters")
            .select("id")
            .eq("is_main", true)
            .maybeSingle();
          if (!error && data && !cancelled) {
            dataProvider.setMainCharacterOverride(data.id as string);
            setMainCharacterId(data.id as string);
            return;
          }
        } catch {
          // 取得失敗時は静的JSONのis_mainにフォールバック
        }
      }
      const main = await dataProvider.getMainCharacter();
      if (!cancelled) setMainCharacterId(main?.character.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMainCharacter = useCallback(
    async (characterId: string) => {
      // ゲスト（専用アカウント）はRPCを呼ばずローカルのみ更新（実DBのis_mainは変えない、ADR-0014）。
      // 本人のみ set_main_character RPCで実DBも更新（DB側 is_writer()=オーナーuidガードで二重防御）。
      if (notesProviderKind === "supabase" && !isGuest) {
        const { error } = await getSupabaseClient().rpc("set_main_character", {
          p_character_id: characterId,
        });
        if (error) throw error;
      }
      dataProvider.setMainCharacterOverride(characterId);
      setMainCharacterId(characterId);
    },
    [isGuest],
  );

  return (
    <MainCharacterContext.Provider value={{ mainCharacterId, setMainCharacter }}>
      {children}
    </MainCharacterContext.Provider>
  );
}

export function useMainCharacter(): MainCharacterContextValue {
  const ctx = useContext(MainCharacterContext);
  if (!ctx) {
    throw new Error("useMainCharacter must be used within MainCharacterProvider");
  }
  return ctx;
}
