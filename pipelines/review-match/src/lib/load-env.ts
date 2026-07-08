// メインリポジトリの .env を読み込む（worktreeには .env が存在しないため絶対パス参照）。
// 依存追加を避けるため簡易パーサ（KEY=VALUE 形式、# コメント行と空行を無視）を自前実装する。
// restructure-notes/src/lib/load-env.ts と同一。
import { readFile } from "node:fs/promises";

export function parseEnv(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export async function loadEnvFile(path: string): Promise<Record<string, string>> {
  const text = await readFile(path, "utf-8");
  return parseEnv(text);
}

/** .env が存在しないとき空オブジェクトを返す（dry-run で env 無しでも動くように）。 */
export async function loadEnvFileOptional(path: string): Promise<Record<string, string>> {
  try {
    return await loadEnvFile(path);
  } catch {
    return {};
  }
}
