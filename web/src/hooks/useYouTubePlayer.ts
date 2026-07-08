// YouTube IFrame Player API のロード + マウント（docs/13_match-review.md ②画面仕様: 場面ジャンプ用プレイヤー）。
// @types/youtube 等の追加npm依存は入れず、使用する範囲のみ最小限に型定義する。
// lib/twitterWidgets.ts と同じ「scriptタグを一度だけ挿入し、Promiseで待つ」パターンをモジュールレベルで踏襲する。
import { useEffect, useState } from "react";

export interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  destroy(): void;
}

interface YTPlayerOptions {
  host?: string;
  videoId?: string;
  playerVars?: Record<string, unknown>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
  };
}

interface YTNamespace {
  Player: new (elementId: string, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";
const SCRIPT_ID = "youtube-iframe-api";

// 複数のフックインスタンス/再マウントをまたいで <script> を二重注入しないためのモジュールレベルpromise。
let loadPromise: Promise<YTNamespace> | null = null;

/** IFrame Player API を一度だけ挿入してロードを待つ。以後の呼び出しは同じ Promise を返す。 */
function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<YTNamespace>((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      if (window.YT) resolve(window.YT);
    };
    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = IFRAME_API_SRC;
      document.head.appendChild(script);
    }
  });
  return loadPromise;
}

/** 指定element idにYouTube IFrame Playerをマウントし、Player参照を返す（null=未準備）。videoIdの変更時は再マウント。 */
export function useYouTubePlayer(elementId: string, videoId: string | null): YTPlayer | null {
  const [player, setPlayer] = useState<YTPlayer | null>(null);

  useEffect(() => {
    if (!videoId) {
      setPlayer(null);
      return;
    }
    let cancelled = false;
    let instance: YTPlayer | null = null;

    loadYouTubeIframeApi().then((YT) => {
      if (cancelled) return;
      instance = new YT.Player(elementId, {
        host: "https://www.youtube-nocookie.com",
        videoId,
        playerVars: { playsinline: 1 },
        events: {
          onReady: (event) => {
            if (!cancelled) setPlayer(event.target);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      instance?.destroy();
      setPlayer(null);
    };
  }, [elementId, videoId]);

  return player;
}
