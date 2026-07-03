// Twitter/X 公式 widgets.js の遅延ロード（ADR-0012）。
// ツイート埋め込みを含むメモの表示時のみ、一度だけ script を挿入する（プライバシー配慮）。
// 失敗時は呼び出し側（TweetEmbed）がリンク表示にフォールバックする。

let loadPromise: Promise<void> | null = null;

declare global {
  interface Window {
    twttr?: {
      widgets?: {
        load: (el?: HTMLElement) => void;
      };
    };
  }
}

/** widgets.js を一度だけ挿入してロードを待つ。以後の呼び出しは同じ Promise を返す。 */
export function loadTwitterWidgets(): Promise<void> {
  if (typeof document === "undefined") return Promise.reject(new Error("no document"));
  if (window.twttr?.widgets) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById("twitter-wjs") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("twitter widgets.js load failed")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.id = "twitter-wjs";
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("twitter widgets.js load failed"));
    document.body.appendChild(script);
  });

  return loadPromise;
}

/** テスト用: モジュール内キャッシュをリセットする。 */
export function __resetTwitterWidgetsForTest(): void {
  loadPromise = null;
}
