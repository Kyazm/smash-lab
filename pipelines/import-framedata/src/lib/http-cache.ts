// 礼儀正しいHTTP取得 + ローカルキャッシュ。
// - 1リクエスト/秒のレート制限（グローバル、全取得で共有）
// - User-Agent明示
// - 生レスポンスを .context/raw-cache/ にキャッシュし、再実行時は再取得しない（ADR-0003: 先方負荷回避）
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
export const CACHE_DIR = join(REPO_ROOT, ".context", "raw-cache");

// HTTPヘッダはlatin1(ByteString)のみ許容のため、User-Agentは必ずASCIIで書く（日本語不可）。
const USER_AGENT =
  "smash-lab-personal-import/1.0 (personal use; SSBU frame data one-time import)";
const RATE_LIMIT_MS = 1100; // 1req/秒 + 余裕

let lastRequestAt = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const wait = RATE_LIMIT_MS - (now - lastRequestAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * URLを取得しキャッシュする。キャッシュがあればネットワークに触れず返す。
 * @param url        取得先
 * @param cacheName  .context/raw-cache/ 以下の相対パス（例 "ufd/mario.html"）
 * @param opts.force キャッシュを無視して再取得
 */
export async function fetchCached(
  url: string,
  cacheName: string,
  opts: { force?: boolean } = {},
): Promise<string> {
  const cachePath = join(CACHE_DIR, cacheName);
  if (!opts.force && (await fileExists(cachePath))) {
    return readFile(cachePath, "utf8");
  }

  await rateLimit();
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/csv,*/*" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`fetch failed ${res.status} ${res.statusText} for ${url}`);
  }
  const body = await res.text();

  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, body, "utf8");
  return body;
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function readJsonIfExists<T>(path: string): Promise<T | null> {
  if (!(await fileExists(path))) return null;
  return JSON.parse(await readFile(path, "utf8")) as T;
}
