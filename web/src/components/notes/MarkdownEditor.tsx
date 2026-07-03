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
          className={`rounded px-2 py-1 text-xs font-medium ${
            !preview ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
          }`}
        >
          編集
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className={`rounded px-2 py-1 text-xs font-medium ${
            preview ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"
          }`}
        >
          プレビュー
        </button>
      </div>

      {preview ? (
        <div className="min-h-[6rem] rounded border border-slate-700 bg-slate-900/50 p-2">
          {value.trim() === "" ? (
            <p className="text-sm text-slate-500">（プレビューする内容がありません）</p>
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
          className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono text-sm text-slate-100"
        />
      )}
    </div>
  );
}
