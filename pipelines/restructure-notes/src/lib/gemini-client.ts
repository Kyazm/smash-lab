// Gemini API（REST直叩き）クライアント。
// generateContent を素朴に呼ぶだけの薄いラッパー。プロンプト組み立ては build-prompt.ts に分離。
import { GEMINI_API_BASE, GEMINI_MODEL } from "../config.js";

export interface GenerateOptions {
  apiKey: string;
  prompt: string;
  model?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export async function generateRestructuredBody(opts: GenerateOptions): Promise<string> {
  const model = opts.model ?? GEMINI_MODEL;
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${opts.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gemini API error: ${res.status} ${res.statusText} ${errBody.slice(0, 500)}`);
  }

  const data = (await res.json()) as GeminiResponse;

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini prompt blocked: ${data.promptFeedback.blockReason}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text || text.trim().length === 0) {
    throw new Error("Gemini response contained no text");
  }
  return text.trim();
}
