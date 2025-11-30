import { SYSTEM_PROMPT } from "./postPrompt";

const DEFAULT_MODEL = "gpt-4.1-mini";

export type PlannedPostInput = {
  date: string;
  platform: string;
  type: string;
  theme: string;
};

export type GeneratedPostOutput = {
  content: string;
  firstComment?: string;
};

export async function generatePostsForBatch(args: {
  productDescription: string;
  batchName: string;
  themes: string[];
  posts: PlannedPostInput[];
}): Promise<Record<number, GeneratedPostOutput>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const baseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/+$/, "") ||
    "https://api.openai.com/v1";

  const userPayload = {
    product: args.productDescription,
    batch: args.batchName,
    themes: args.themes,
    posts: args.posts.map((p, index) => ({ index, ...p })),
    responseShape: {
      posts: [
        {
          index: 0,
          content: "Текст",
          firstComment: "Опционально",
        },
      ],
    },
  };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(userPayload, null, 2) },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.message ??
    "";

  if (typeof content !== "string") {
    throw new Error("Unexpected OpenAI response");
  }

  try {
    const parsed = JSON.parse(content) as {
      posts?: { index: number; content: string; firstComment?: string }[];
    };
    const map: Record<number, GeneratedPostOutput> = {};
    (parsed.posts || []).forEach((p) => {
      map[p.index] = {
        content: p.content,
        firstComment: p.firstComment,
      };
    });
    return map;
  } catch (err) {
    throw new Error("Failed to parse JSON from OpenAI");
  }
}
