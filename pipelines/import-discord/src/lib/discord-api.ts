// Discord REST API v10 クライアント。
// 認証: 環境変数 DISCORD_TOKEN。
//   - 推奨: Bot トークン（Authorization: "Bot <token>"）。ユーザーは自サーバー管理者なので Bot 招待可能。
//   - 非推奨フォールバック: ユーザートークン（self-bot）は Discord ToS 違反リスクがあるため既定では使わない。
//     どうしても使う場合のみ DISCORD_TOKEN_TYPE=user を明示（README に ToS リスクを明記）。
// レート制限:
//   - 429 は retry_after（秒）を尊重して待機・再試行
//   - X-RateLimit-Remaining が 0 の場合 X-RateLimit-Reset-After まで自主待機
//   - グローバル最小間隔も設ける
import type { DiscordChannel, DiscordMessage } from "./types.js";

const API_BASE = "https://discord.com/api/v10";
// ASCII のみ（HTTPヘッダは latin1）。Discord は User-Agent 明示を要求する。
const USER_AGENT =
  "DiscordBot (https://github.com/smash-lab/import-discord, 1.0) personal-one-time-migration";
const MIN_INTERVAL_MS = 250; // 自主スロットル（4 req/s 上限相当）
const MAX_RETRIES = 5;

export type TokenType = "Bot" | "user";

export interface DiscordClientOptions {
  token: string;
  tokenType?: TokenType; // 既定 Bot
}

export class DiscordClient {
  private readonly authHeader: string;
  private lastRequestAt = 0;

  constructor(opts: DiscordClientOptions) {
    if (!opts.token) throw new Error("DISCORD_TOKEN is empty");
    const type = opts.tokenType ?? "Bot";
    // Bot は "Bot <token>"、ユーザートークンは生値（プレフィックスなし）。
    this.authHeader = type === "Bot" ? `Bot ${opts.token}` : opts.token;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): DiscordClient {
    const token = env.DISCORD_TOKEN;
    if (!token) {
      throw new Error(
        "環境変数 DISCORD_TOKEN が未設定です。リポジトリ直下 .env に設定してください（README 参照）。",
      );
    }
    const raw = (env.DISCORD_TOKEN_TYPE ?? "bot").toLowerCase();
    const tokenType: TokenType = raw === "user" ? "user" : "Bot";
    return new DiscordClient({ token, tokenType });
  }

  private async throttle(): Promise<void> {
    const wait = MIN_INTERVAL_MS - (Date.now() - this.lastRequestAt);
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();
  }

  /** レート制限・429 リトライ込みの GET。JSON を返す。 */
  private async get<T>(path: string): Promise<T> {
    let attempt = 0;
    for (;;) {
      await this.throttle();
      const res = await fetch(`${API_BASE}${path}`, {
        headers: {
          Authorization: this.authHeader,
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });

      if (res.status === 429) {
        // レート超過。retry_after を尊重。
        const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
        const retryAfter = body.retry_after ?? 1;
        if (attempt++ >= MAX_RETRIES) {
          throw new Error(`429 rate limited too many times for ${path}`);
        }
        await sleep((retryAfter + 0.1) * 1000);
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Discord API ${res.status} ${res.statusText} for ${path}: ${text.slice(0, 300)}`);
      }

      // 自主スロットル: 残枠 0 なら reset まで待つ
      const remaining = res.headers.get("X-RateLimit-Remaining");
      const resetAfter = res.headers.get("X-RateLimit-Reset-After");
      if (remaining === "0" && resetAfter) {
        await sleep((parseFloat(resetAfter) + 0.1) * 1000);
      }

      return (await res.json()) as T;
    }
  }

  /** GET /guilds/{id}/channels — ギルドの全チャンネル（カテゴリ含む）。 */
  async listGuildChannels(guildId: string): Promise<DiscordChannel[]> {
    return this.get<DiscordChannel[]>(`/guilds/${guildId}/channels`);
  }

  /**
   * GET /channels/{id}/messages を before ページネーションで全件取得。
   * limit=100 固定、最古まで遡る。降順で返るため、呼び出し側で必要ならソートする。
   */
  async fetchAllMessages(channelId: string): Promise<DiscordMessage[]> {
    const all: DiscordMessage[] = [];
    let before: string | undefined;
    for (;;) {
      const q = new URLSearchParams({ limit: "100" });
      if (before) q.set("before", before);
      const page = await this.get<DiscordMessage[]>(
        `/channels/${channelId}/messages?${q.toString()}`,
      );
      if (page.length === 0) break;
      all.push(...page);
      // page は新しい順。最後の要素が最古。それより前を次に取る。
      before = page[page.length - 1].id;
      if (page.length < 100) break;
    }
    return all;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
