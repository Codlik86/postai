const LATE_API_KEY = process.env.LATE_API_KEY;
const LATE_BASE_URL =
  process.env.LATE_API_BASE_URL ?? "https://getlate.dev/api/v1";

if (!LATE_API_KEY) {
  console.warn(
    "[Late] LATE_API_KEY is not set. Late API calls will fail at runtime.",
  );
}

export async function lateFetch(path: string, init?: RequestInit) {
  if (!LATE_API_KEY) {
    throw new Error("LATE_API_KEY is not configured on the server");
  }

  const res = await fetch(`${LATE_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LATE_API_KEY}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Late API ${res.status} ${res.statusText}: ${text || "no body"}`,
    );
  }

  return res;
}

export type LateAccount = {
  _id: string;
  platform: string;
  username: string;
  displayName: string;
  profilePicture?: string;
};

export async function fetchLateAccounts(): Promise<LateAccount[]> {
  const res = await lateFetch("/accounts");
  const json = (await res.json()) as { accounts?: LateAccount[] };
  return Array.isArray(json.accounts) ? json.accounts : [];
}

export type LateMediaFile = {
  type: "image" | "video" | "gif" | "document";
  url: string;
  filename: string;
  size?: number;
  mimeType?: string;
};

export async function uploadMediaToLate(
  file: File,
): Promise<LateMediaFile> {
  const form = new FormData();
  form.append("files", file);

  const res = await fetch(`${LATE_BASE_URL}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LATE_API_KEY}`,
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Late media upload failed ${res.status}: ${text || "no body"}`,
    );
  }

  const json = (await res.json()) as {
    files?: LateMediaFile[];
  };

  const media = json.files?.[0];
  if (!media) {
    throw new Error("Late media upload response missing file");
  }
  return media;
}

export type LatePostResult = {
  postId: string;
  status: "scheduled" | "published" | "draft" | "failed";
};

export async function createLatePost(args: {
  content: string;
  scheduledFor: string;
  timezone: string;
  platform: string;
  accountId: string;
  media?: LateMediaFile | null;
  type?: "post" | "reel" | "story" | "short" | "tiktok";
  firstComment?: string;
}): Promise<LatePostResult> {
  const res = await lateFetch("/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: args.content,
      scheduledFor: args.scheduledFor,
      timezone: args.timezone,
      platforms: [
        {
          platform: args.platform,
          accountId: args.accountId,
          platformSpecificData: {
            contentType:
              args.type === "reel" || args.platform === "tiktok"
                ? "reel"
                : "post",
            ...(args.firstComment ? { firstComment: args.firstComment } : {}),
          },
        },
      ],
      ...(args.media
        ? {
            mediaItems: [
              {
                type: args.media.type,
                url: args.media.url,
                filename: args.media.filename,
              },
            ],
          }
        : {}),
    }),
  });

  const json = (await res.json()) as { post?: { _id?: string; status?: string } };
  const postId = json.post?._id;
  const status = (json.post?.status as LatePostResult["status"]) ?? "scheduled";

  if (!postId) {
    throw new Error("Late post response missing post id");
  }

  return { postId, status };
}
