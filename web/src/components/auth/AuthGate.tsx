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
      <div className="flex min-h-screen items-center justify-center bg-surface-0 text-sm text-ink-muted">
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
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface-1 p-6"
      >
        <h1 className="mb-4 text-lg font-bold text-ink-primary">smash-lab</h1>
        <label className="mb-1 block text-xs text-ink-secondary" htmlFor="email">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full min-h-11 rounded-md border border-border bg-surface-0 px-3 py-2 text-sm text-ink-primary focus:border-action focus:outline-none"
        />
        <label className="mb-1 block text-xs text-ink-secondary" htmlFor="password">
          パスワード
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full min-h-11 rounded-md border border-border bg-surface-0 px-3 py-2 text-sm text-ink-primary focus:border-action focus:outline-none"
        />
        {error && <p className="mb-3 text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-11 rounded-md bg-action px-3 py-2 text-sm font-semibold text-white hover:bg-action-strong disabled:opacity-50"
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
      className="fixed bottom-3 right-3 min-h-11 rounded-md border border-border bg-surface-1/90 px-2 py-1 text-xs text-ink-muted hover:text-ink-primary"
    >
      ログアウト
    </button>
  );
}
