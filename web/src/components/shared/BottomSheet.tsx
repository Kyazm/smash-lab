// 汎用ボトムシート（モバイル）/ モーダル（デスクトップ）プリミティブ。
// docs/06: 行タップ→詳細ドロワー、技選択のボトムシート化で共有する。
// フォーカス管理: 開いた瞬間にダイアログへフォーカス、Escapeで閉じる、背景スクロールロック。
import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-xl border-t border-border bg-surface-1 p-4 shadow-xl focus:outline-none sm:max-w-lg sm:rounded-xl sm:border"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex min-h-11 min-w-11 items-center justify-center rounded text-ink-muted hover:text-ink-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-action"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
