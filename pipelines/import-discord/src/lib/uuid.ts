// 決定的UUID生成（UUIDv5）。取込を再実行しても同じキーに同じIDが振られるよう、
// 名前空間+キーの SHA-1 から UUIDv5 を作る（Supabase投入の冪等性・参照整合のため）。
// import-framedata/src/lib/uuid.ts と同型だが、名前空間を分けて衝突を避ける。
import { createHash } from "node:crypto";

// smash-lab import-discord 用の固定名前空間UUID
const NAMESPACE = "6d1b7c9e-4a3f-5b2d-8e1a-000000000d15";

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** UUIDv5（名前空間+name のSHA-1）。同一入力で常に同一UUIDを返す。 */
export function uuidv5(name: string): string {
  const ns = hexToBytes(NAMESPACE);
  const nameBytes = Buffer.from(name, "utf8");
  const hash = createHash("sha1").update(Buffer.concat([ns, nameBytes])).digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC4122
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
