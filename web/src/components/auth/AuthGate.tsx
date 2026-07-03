// 認証ゲート。supabaseモード時のみ、未認証ならログイン画面を表示（docs/02: RLS+Authが唯一の防御線）。
// mockモードでは素通し。サインアップ導線は作らない（サインアップ無効運用）。
// ADR-0014: 「ゲストとして試す」で専用ゲストアカウントにログイン（サンドボックス）。
// disable_signup=true が signInAnonymously() もブロックするため、匿名認証はやめ専用アカウント方式に変更。
// ゲスト判定は session.user.id === GUEST_UID。GuestProviderで配下に伝播し、
// NotesProviderをGuestNotesProviderに切替える。
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { resolveNotesProviderKind } from "../../lib/providerMode";
import { getSupabaseClient } from "../../data/supabaseClient";
import { GuestProvider } from "../../lib/guestContext";
import { setActiveNotesProvider, defaultNotesProvider } from "../../data/notes";
import { GuestNotesProvider } from "../../data/notes/GuestNotesProvider";
import { GUEST_EMAIL, GUEST_PASSWORD, GUEST_UID } from "../../data/guestConfig";

const kind = resolveNotesProviderKind(
  import.meta.env.VITE_NOTES_PROVIDER,
  import.meta.env.VITE_DATA_PROVIDER,
);

export function AuthGate({ children }: { children: ReactNode }) {
  if (kind !== "supabase") {
    return <GuestProvider value={false}>{children}</GuestProvider>;
  }
  return <SupabaseAuthGate>{children}</SupabaseAuthGate>;
}

function SupabaseAuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const guestSeeded = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // ゲストセッションからログアウト/別セッションに変わったら、次回ゲスト化時に再シードできるようにフラグを戻す。
      if (s?.user.id !== GUEST_UID) {
        guestSeeded.current = false;
        setActiveNotesProvider(defaultNotesProvider);
      }
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isGuest = session?.user.id === GUEST_UID;

  // ゲストセッション確立時に一度だけ NotesProvider を GuestNotesProvider へ切替 + 初回シード。
  // 本人ログイン時は既定の notesProvider（Mock/Supabase切替済み）のまま。
  useEffect(() => {
    if (!isGuest || guestSeeded.current) return;
    guestSeeded.current = true;
    const guestProvider = new GuestNotesProvider();
    setActiveNotesProvider(guestProvider);
    void guestProvider.seedFromSupabaseIfEmpty();
  }, [isGuest]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0 text-sm text-ink-muted">
        読み込み中…
      </div>
    );
  }
  if (!session) return <LoginForm />;
  return (
    <GuestProvider value={isGuest}>
      {children}
      {isGuest ? <GuestBanner /> : <LogoutButton />}
    </GuestProvider>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [guestSubmitting, setGuestSubmitting] = useState(false);

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

  async function onGuestSignIn() {
    setGuestSubmitting(true);
    setError(null);
    const { error: err } = await getSupabaseClient().auth.signInWithPassword({
      email: GUEST_EMAIL,
      password: GUEST_PASSWORD,
    });
    if (err) setError("ゲストログインに失敗しました。時間をおいて再度お試しください。");
    setGuestSubmitting(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-border-subtle bg-surface-1 p-6"
      >
        <h1 className="mb-1 font-display text-3xl leading-none tracking-wide text-ink-primary">
          KYAZM<span className="text-action"> SMASH</span> LAB
        </h1>
        <p className="mb-5 font-frame text-[10px] uppercase tracking-[0.3em] text-ink-muted">
          frame data / punish / matchup
        </p>
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
          disabled={submitting || guestSubmitting}
          className="w-full min-h-11 rounded-md bg-action px-3 py-2 text-sm font-semibold text-white hover:bg-action-strong disabled:opacity-50"
        >
          {submitting ? "ログイン中…" : "ログイン"}
        </button>

        <div className="my-3 flex items-center gap-2 text-xs text-ink-muted">
          <div className="h-px flex-1 bg-border-subtle" />
          または
          <div className="h-px flex-1 bg-border-subtle" />
        </div>

        <button
          type="button"
          onClick={onGuestSignIn}
          disabled={submitting || guestSubmitting}
          className="w-full min-h-11 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm font-medium text-ink-secondary hover:text-ink-primary disabled:opacity-50"
        >
          {guestSubmitting ? "接続中…" : "ゲストとして試す"}
        </button>
        <p className="mt-2 text-xs text-ink-muted">
          ゲストの変更はこの端末内のみに保存され、実データには反映されません。
        </p>

        <div className="mt-4 border-t border-border-subtle pt-3 text-center">
          <Link
            to="/library"
            className="text-xs text-ink-secondary underline decoration-action/40 hover:text-ink-primary hover:decoration-action-strong"
          >
            ログインせずに記事を読む（ライブラリ）
          </Link>
        </div>
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

/** ゲストセッションのヘッダー表示: サンドボックス注記 + リセット + ログアウト（ADR-0014）。 */
function GuestBanner() {
  const [resetting, setResetting] = useState(false);

  async function onReset() {
    if (!window.confirm("この端末内の編集内容を全て消去し、実データを再取得します。よろしいですか？")) {
      return;
    }
    setResetting(true);
    try {
      const provider = new GuestNotesProvider();
      await provider.reset();
      setActiveNotesProvider(provider);
      window.location.reload();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center justify-between gap-2 border-t border-warning/30 bg-surface-1/95 px-3 py-2 text-xs text-ink-secondary backdrop-blur">
      <span className="font-medium text-warning">
        ゲスト（サンドボックス）・変更はこの端末内のみ、保存されません
      </span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={resetting}
          className="min-h-9 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-ink-secondary hover:text-ink-primary disabled:opacity-50"
        >
          {resetting ? "リセット中…" : "リセット"}
        </button>
        <button
          type="button"
          onClick={() => void getSupabaseClient().auth.signOut()}
          className="min-h-9 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-ink-secondary hover:text-ink-primary"
        >
          ログアウト
        </button>
      </span>
    </div>
  );
}
