// Markdown 入力欄（編集 / プレビュー トグル付き）。renderMarkdown で安全にプレビューする。
import { useState } from "react";
import { renderMarkdown } from "../../lib/markdown";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

export function MarkdownEditor({ value, onChange, placeholder, rows = 8 }: Props) {
  const [preview, setPreview] = useState(false);

  return (
    <div>
      <div className="mb-1 flex gap-2">
        <button
          type="button"
          onClick={() => setPreview(false)}
          className={`min-h-11 rounded px-2 py-1 text-xs font-medium ${
            !preview ? "bg-action text-white" : "bg-surface-2 text-ink-secondary"
          }`}
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className={`min-h-11 rounded px-2 py-1 text-xs font-medium ${
            preview ? "bg-action text-white" : "bg-surface-2 text-ink-secondary"
          }`}
        >
          プレビュー
        </button>
      </div>

      {preview ? (
        <div className="min-h-[6rem] rounded border border-border bg-surface-1/50 p-2">
          {value.trim() === "" ? (
            <p className="text-sm text-ink-muted">（プレビューする内容がありません）</p>
          ) : (
            renderMarkdown(value)
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full rounded border border-border bg-surface-1 p-2 font-mono text-sm text-ink-primary"
        />
      )}
    </div>
  );
}
