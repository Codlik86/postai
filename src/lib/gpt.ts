import { SYSTEM_PROMPT } from "./postPrompt";

const DEFAULT_MODEL = "gpt-4.1-mini";

export type PlannedPostInput = {
  date: string;
  platform: string;
  kind: string;
  theme: string;
};

export type GeneratedPostOutput = {
  caption: string;
  firstComment?: string;
  hashtags?: string;
};

export async function generateWeeklyBrief(params: {
  startDate: string;
  endDate: string;
  platforms: string[];
  notes?: string;
}): Promise<{ themes: string; brief: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const baseUrl =
    process.env.OPENAI_BASE_URL?.replace(/\/+$/, "") ||
    "https://api.openai.com/v1";

  const userPayload = {
    task:
      "Сгенерируй список тем для контента Помни на указанную неделю и краткое ТЗ для генерации постов.",
    period: { startDate: params.startDate, endDate: params.endDate },
    platforms: params.platforms,
    notes: params.notes ?? "",
    responseShape: {
      themes: "строка (через запятую или короткими предложениями)",
      brief: "2-4 абзаца про фокус недели, тон, подачу",
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
      themes?: string;
      brief?: string;
    };
    if (!parsed.themes || !parsed.brief) {
      throw new Error("Missing themes or brief");
    }
    return { themes: parsed.themes, brief: parsed.brief };
  } catch (err) {
    throw new Error("Failed to parse JSON from OpenAI");
  }
}

export async function generateDayPosts(args: {
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
          caption: "Текст",
          first_comment: "Опционально",
          hashtags: "#пример #пример2",
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
      posts?: {
        index: number;
        caption: string;
        firstComment?: string;
        first_comment?: string;
        hashtags?: string;
      }[];
    };
    const map: Record<number, GeneratedPostOutput> = {};
    (parsed.posts || []).forEach((p) => {
      map[p.index] = {
        caption: p.caption,
        firstComment: p.firstComment ?? p.first_comment,
        hashtags: p.hashtags,
      };
    });
    return map;
  } catch (err) {
    throw new Error("Failed to parse JSON from OpenAI");
  }
}
