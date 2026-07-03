// アプリ全体のエラーバウンダリ（監査FU-2）。描画時の例外でツリー全体が真っ白になるのを防ぎ、
// フォールバックUIと再読み込み導線を出す。ログはconsole.errorに残す（無言失敗を避ける）。
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-0 px-4 text-center">
        <p className="text-sm font-semibold text-danger">画面の表示中にエラーが発生しました</p>
        <p className="max-w-md break-words text-xs text-ink-muted">{error.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 rounded-md bg-action px-4 py-2 text-sm font-semibold text-white hover:bg-action-strong"
        >
          再読み込み
        </button>
      </div>
    );
  }
}
