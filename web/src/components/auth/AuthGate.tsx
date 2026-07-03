// 認証ゲート。supabaseモード時のみ、未認証ならログイン画面を表示（docs/02: RLS+Authが唯一の防御線）。
// mockモードでは素通し。サインアップ導線は作らない（サインアップ無効運用）。
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { resolveNotesProviderKind } from "../../lib/providerMode";
import { getSupabaseClient } from "../../data/supabaseClient";

const kind = resolveNotesProviderKind(
  import.meta.env.VITE_NOTES_PROVIDER,
  import.meta.env.VITE_DATA_PROVIDER,
);

export function AuthGate({ children }: { children: ReactNode }) {
  if (kind !== "supabase") return <>{children}</>;
  return <SupabaseAuthGate>{children}</SupabaseAuthGate>;
}

function SupabaseAuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        読み込み中…
      </div>
    );
  }
  if (!session) return <LoginForm />;
  return (
    <>
      {children}
      <LogoutButton />
    </>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: err } = await getSupabaseClient().auth.signInWithPassword({
      email,
      password,
    });
    if (err) setError("ログインに失敗しました。メールアドレスとパスワードを確認してください。");
    setSubmitting(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6"
      >
        <h1 className="mb-4 text-lg font-bold text-slate-100">smash-lab</h1>
        <label className="mb-1 block text-xs text-slate-400" htmlFor="email">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
        <label className="mb-1 block text-xs text-slate-400" htmlFor="password">
          パスワード
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
        />
        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}

function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => void getSupabaseClient().auth.signOut()}
      className="fixed bottom-3 right-3 rounded-md border border-slate-700 bg-slate-900/90 px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
    >
      ログアウト
    </button>
  );
}
