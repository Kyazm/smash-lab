// 確定反撃タブに常時表示する前提条件の注記（docs/02_architecture.md lines 108-110 のコピー）。
// Wave A-2で<details>折りたたみ化（初回のみ開）予定。A-1では色トークンのみ移行。
export function PunishAssumptionsNote() {
  return (
    <ul className="mt-4 space-y-1 rounded border border-border bg-surface-1/50 p-3 text-xs text-ink-secondary">
      <li>・on_shield は最終持続Fを密着ガードした場合の代表値。先端当て・持続当て・ワンパターン相殺で数F変動する</li>
      <li>・ジャストシールド時は別計算（硬直差が改善）のため対象外</li>
      <li>・extra_frames と OoS候補リスト（どの技がOoSとして実用か）は実装時に手動キュレーションし、数値は取込データと突き合わせて検証する</li>
    </ul>
  );
}
