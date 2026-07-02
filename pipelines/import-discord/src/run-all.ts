// 全工程オーケストレータ: export → transform → load を順に実行する。
//
// 注意: transform と load の間には「人間によるマッピング確認」が本来入る（docs/02）。
// run-all は下見/再現用。実運用では individually（export → 確認 → transform → CSV修正 → load）推奨。
//
// フラグはそのまま export に渡る（--dry-run など）。
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function run(script: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", `${__dirname}/${script}`, ...args], {
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))));
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  await run("export.ts", args);
  await run("transform.ts", []);
  console.log(
    "\n[run-all] ここで .context/discord-mapping.csv を確認・修正してください（未解決 slug を埋める）。",
  );
  console.log("[run-all] 確認後、`npm run load` を実行してノート/SQLを生成します。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
