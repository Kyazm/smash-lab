// 汎用 IO ヘルパー。
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname } from "node:path";

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function readText(path: string): Promise<string> {
  return readFile(path, "utf8");
}

export async function readJsonIfExists<T>(path: string): Promise<T | null> {
  if (!(await fileExists(path))) return null;
  return readJson<T>(path);
}

export async function writeText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}
