// 確定反撃タブに常時表示する前提条件の注記（docs/02_architecture.md lines 108-110 のコピー）。
export function PunishAssumptionsNote() {
  return (
    <ul className="mt-4 space-y-1 rounded border border-slate-700 bg-slate-900/50 p-3 text-xs text-slate-400">
      <li>・on_shield は最終持続Fを密着ガードした場合の代表値。先端当て・持続当て・ワンパターン相殺で数F変動する</li>
      <li>・ジャストシールド時は別計算（硬直差が改善）のため対象外</li>
      <li>・extra_frames と OoS候補リスト（どの技がOoSとして実用か）は実装時に手動キュレーションし、数値は取込データと突き合わせて検証する</li>
    </ul>
  );
}
