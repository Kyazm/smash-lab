/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_PROVIDER?: string;
  readonly VITE_NOTES_PROVIDER?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ?raw インポート（docs/*.md をビルド時に文字列として取り込む。ライブラリ記事のオフライン描画）。
declare module "*?raw" {
  const content: string;
  export default content;
}
