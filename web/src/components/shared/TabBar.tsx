// URL状態(`?tab=`)に連動する横スクロール可能なタブバー。ADR-0009: 5タブでもモバイルで破綻しない。
// タップターゲット44px確保、focus-visible、キーボード操作（ネイティブbuttonのため自動対応）。
interface TabDef<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  tabs: TabDef<T>[];
  active: T;
  onChange: (key: T) => void;
}

export function TabBar<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <div
      role="tablist"
      className="-mx-4 flex gap-1 overflow-x-auto border-b border-border-subtle px-4 sm:mx-0 sm:px-0"
    >
      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.key)}
            className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action ${
              selected
                ? "border-action text-action-strong"
                : "border-transparent text-ink-secondary hover:text-ink-primary"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
