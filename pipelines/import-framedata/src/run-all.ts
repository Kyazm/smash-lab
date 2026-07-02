// パイプライン全工程を順に実行する。各工程はキャッシュ優先なので再実行は安全（冪等）。
//   1. scrape-ufd    UFD全キャラ + statsページ取得 → ufd.json
//   2. fetch-jp-names 検証窓シート日本語技名 → jp.json
//   3. match-names   英日突合 → name-mapping.csv + name-matches.json
//   4. build-output  最終JSON + REPORT.md → data/imported/
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const steps = ["scrape-ufd.ts", "fetch-jp-names.ts", "match-names.ts", "build-output.ts"];

function run(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n===== ${script} =====`);
    const child = spawn("npx", ["tsx", join(__dirname, script)], { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))));
    child.on("error", reject);
  });
}

async function main(): Promise<void> {
  for (const s of steps) await run(s);
  console.log("\n===== 全工程完了 =====");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
