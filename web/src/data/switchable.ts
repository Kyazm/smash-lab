// プロバイダのProxy委譲を共通化するファクトリ（ADR-0018。notes/index.tsのパターンの一般化）。
// owner=Supabase / guest・mock=ローカル を実行時に差し替えるドメイン（match/session/focus）で共用する。
// 制約: T は「全てメソッド」のインターフェイスであること（getは関数のみbindする。フィールド/getterは委譲が壊れる）。
// notes は Guestシードの特殊性があるため既存実装のまま（このファクトリには載せない）。
export interface Switchable<T extends object> {
  /** 起動時に決定する既定プロバイダ（本人ログイン/mock用）。ゲスト復帰時にこれへ戻す。 */
  defaultProvider: T;
  /** ゲスト確立/復帰時に委譲先を差し替える（guestSwitch.ts から呼ぶ）。 */
  setActive: (p: T) => void;
  /** 呼び出し側が常に参照するProxy（実体委譲）。 */
  proxy: T;
}

export function createSwitchable<T extends object>(create: () => T): Switchable<T> {
  const defaultProvider = create();
  let active: T = defaultProvider;
  return {
    defaultProvider,
    setActive: (p: T) => {
      active = p;
    },
    proxy: new Proxy({} as T, {
      get(_target, prop) {
        const value = active[prop as keyof T];
        return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(active) : value;
      },
    }),
  };
}

/** notes/match と同じ環境変数規約でプロバイダ種別を決める（supabase or ローカル）。 */
export function isSupabaseProviderMode(): boolean {
  const kind = import.meta.env.VITE_NOTES_PROVIDER;
  if (kind === "supabase") return true;
  if (kind === "mock") return false;
  return import.meta.env.VITE_DATA_PROVIDER === "supabase";
}
