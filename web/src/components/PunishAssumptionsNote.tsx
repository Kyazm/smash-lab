// 確定反撃タブの前提条件注記（docs/02_architecture.md lines 108-110）。
// docs/06 A-3: 常時表示から<details>折りたたみへ変更。初回のみ開（2回目以降は閉じた状態で表示）。
import { useEffect, useState } from "react";

const SEEN_KEY = "smash-lab.punish-assumptions-seen.v1";

function hasSeenBefore(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // localStorage 不可の環境（SSR/テスト）では何もしない
  }
}

export function PunishAssumptionsNote() {
  // 初回レンダーの判定はマウント前に確定させたいため useState の初期化関数で読む。
  const [defaultOpen] = useState(() => !hasSeenBefore());

  useEffect(() => {
    markSeen();
  }, []);

  return (
    <details open={defaultOpen} className="mt-4 rounded border border-border bg-surface-1/50 p-3 text-xs">
      <summary className="cursor-pointer font-medium text-ink-secondary">
        計算の前提条件（タップで開閉）
      </summary>
      <ul className="mt-2 space-y-1 text-ink-secondary">
        <li>・on_shield は最終持続Fを密着ガードした場合の代表値。先端当て・持続当て・ワンパターン相殺で数F変動する</li>
        <li>・ジャストシールド時は別計算（硬直差が改善）のため対象外</li>
        <li>・extra_frames と OoS候補リスト（どの技がOoSとして実用か）は実装時に手動キュレーションし、数値は取込データと突き合わせて検証する</li>
      </ul>
    </details>
  );
}
