"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";

type Account = {
  id: number;
  platform: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

type Batch = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  timezone: string;
  status: string;
};

type PostStatus = "generated" | "edited" | "scheduled" | "failed";

type Post = {
  id: number;
  batchId: number;
  platform: string;
  accountId: number;
  scheduledFor: string;
  localTime: string;
  timezone: string;
  type: string;
  content: string;
  firstComment?: string | null;
  status: PostStatus | string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaFilename?: string | null;
  lateError?: string | null;
};

type LateMediaFile = {
  url: string;
  filename: string;
  type: string;
};

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Europe/Moscow";

function localToUtc(date: string, time: string, tz: string) {
  const ref = new Date(`${date}T${time}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(ref);
  const get = (type: string) => fmt.find((p) => p.type === type)?.value ?? "00";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const second = Number(get("second"));
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

const platformLabel: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  threads: "Threads",
  telegram: "Telegram",
};

const statusClasses: Record<string, string> = {
  generated: "bg-slate-800 text-slate-200",
  edited: "bg-blue-500/20 text-blue-200",
  scheduled: "bg-emerald-500/20 text-emerald-200",
  failed: "bg-rose-500/20 text-rose-200",
};

function StatusBadge({ status, error }: { status: string; error?: string }) {
  const cls = statusClasses[status] ?? "bg-slate-700 text-slate-200";
  return (
    <span
      title={error}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${cls}`}
    >
      {status}
      {error ? "!" : ""}
    </span>
  );
}

function useGroupedPosts(posts: Post[]) {
  return useMemo(() => {
    const groups: Record<string, Post[]> = {};
    [...posts]
      .sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime(),
      )
      .forEach((post) => {
        const date = post.scheduledFor.slice(0, 10);
        groups[date] = groups[date] ? [...groups[date], post] : [post];
      });
    return groups;
  }, [posts]);
}

function platformIcon(platform: string) {
  if (platform === "instagram") return "IG";
  if (platform === "tiktok") return "TT";
  if (platform === "threads") return "TH";
  if (platform === "telegram") return "TG";
  return platform.slice(0, 2).toUpperCase();
}

export default function Home() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [batchForm, setBatchForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    timezone: DEFAULT_TZ,
    themes: "",
    notes: "",
    platforms: {
      instagram: false,
      tiktok: false,
      threads: false,
      telegram: false,
    },
    postsPerDay: 1,
  });
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    const name = defaultWeekName();
    setBatchForm((prev) => ({ ...prev, name }));
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data) => setAccounts(data.accounts ?? []))
      .catch(() => {});
  }, []);

  function defaultWeekName() {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) =>
      `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
    return `Неделя ${fmt(now)}–${fmt(end)}`;
  }

  async function syncAccounts() {
    setSyncing(true);
    try {
      const res = await fetch("/api/accounts/sync");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAccounts(data.accounts ?? []);
      showToast({ type: "success", title: "Аккаунты обновлены" });
    } catch (err) {
      showToast({
        type: "error",
        title: "Ошибка синхронизации",
        description: "Проверь LATE_API_KEY в .env",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function createBatch() {
    setLoading(true);
    try {
      const platforms = Object.entries(batchForm.platforms)
        .filter(([, v]) => v)
        .map(([k]) => k);

      const body = {
        name: batchForm.name || defaultWeekName(),
        startDate: batchForm.startDate,
        endDate: batchForm.endDate,
        timezone: batchForm.timezone,
        themes: batchForm.themes
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        notes: batchForm.notes,
        platforms,
        postsPerDay: batchForm.postsPerDay,
      };

      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      const data = await res.json();
      setActiveBatch(data.batch);
      setPosts(data.posts);
      showToast({ type: "success", title: "План создан" });
      if (batchForm.name === "") {
        setBatchForm((prev) => ({ ...prev, name: defaultWeekName() }));
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Не удалось создать план",
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function reloadBatch(id: number) {
    const res = await fetch(`/api/batches/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setActiveBatch({
      id: data.id,
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      timezone: data.timezone,
      status: data.status,
    });
    setPosts(data.posts ?? []);
  }

  async function updatePost(id: number, payload: Partial<Post>) {
    const res = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      showToast({ type: "error", title: "Не удалось сохранить" });
      return;
    }
    const updated = await res.json();
    setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    showToast({ type: "success", title: "Сохранено" });
  }

  async function regeneratePost(id: number) {
    const res = await fetch(`/api/posts/${id}/regenerate`, { method: "POST" });
    if (!res.ok) {
      showToast({ type: "error", title: "Не удалось перегенерировать" });
      return;
    }
    const updated = await res.json();
    setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    showToast({ type: "success", title: "Текст обновлён" });
  }

  async function uploadMedia(id: number, file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/media/upload", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      showToast({ type: "error", title: "Не удалось загрузить медиа" });
      return;
    }
    const media: LateMediaFile = await res.json();
    await updatePost(id, {
      mediaUrl: media.url,
      mediaType: media.type,
      mediaFilename: media.filename,
      status: "edited",
    } as any);
    showToast({ type: "success", title: "Медиа загружено" });
  }

  async function scheduleAll() {
    if (!activeBatch) return;
    setScheduling(true);
    try {
      const res = await fetch(
        `/api/batches/${activeBatch.id}/schedule-late`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Ошибка планирования");
      const result = await res.json();
      const failed = (result.results || []).filter(
        (r: any) => r.status === "failed",
      ).length;
      await reloadBatch(activeBatch.id);
      if (failed > 0) {
        showToast({
          type: "warning",
          title: "Частично запланировано",
          description: `Ошибок: ${failed}`,
        });
      } else {
        showToast({ type: "success", title: "Посты запланированы" });
      }
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Не удалось отправить в Late",
        description: err.message,
      });
    } finally {
      setScheduling(false);
    }
  }

  const platformList = useMemo(
    () => [
      { key: "instagram", label: "Instagram" },
      { key: "tiktok", label: "TikTok" },
      { key: "threads", label: "Threads" },
      { key: "telegram", label: "Telegram" },
    ],
    [],
  );

  const groupedPosts = useGroupedPosts(posts);

  return (
    <main className="grid gap-6 md:grid-cols-[360px,1fr]">
      <aside className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-indigo-500/5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-300">
                Late
              </p>
              <h2 className="text-lg font-semibold text-white">
                Аккаунты Late
              </h2>
            </div>
            <button
              onClick={syncAccounts}
              disabled={syncing}
              className="rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 px-3 py-1 text-xs font-semibold text-white shadow hover:shadow-indigo-500/30 disabled:opacity-60"
            >
              {syncing ? "Синк..." : "Синхронизировать"}
            </button>
          </div>
          <div className="space-y-2">
            {accounts.length === 0 && (
              <p className="text-sm text-slate-400">
                Подключи аккаунты в Late и нажми “Синхронизировать аккаунты”.
              </p>
            )}
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/40 to-sky-500/40 text-xs font-semibold text-white">
                  {platformIcon(acc.platform)}
                </div>
                <div className="leading-tight">
                  <p className="text-sm text-white">{acc.displayName}</p>
                  <p className="text-xs text-slate-400">@{acc.username}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-indigo-500/5">
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-300">
              Новый план
            </p>
            <h2 className="text-lg font-semibold text-white">Панель</h2>
          </div>
          <div className="space-y-3">
            <LabeledInput
              label="Название"
              value={batchForm.name}
              onChange={(value) => setBatchForm((p) => ({ ...p, name: value }))}
              placeholder="Неделя ..."
            />
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput
                label="Начало"
                type="date"
                value={batchForm.startDate}
                onChange={(value) =>
                  setBatchForm((p) => ({ ...p, startDate: value }))
                }
              />
              <LabeledInput
                label="Конец"
                type="date"
                value={batchForm.endDate}
                onChange={(value) =>
                  setBatchForm((p) => ({ ...p, endDate: value }))
                }
              />
            </div>
            <LabeledInput
              label="Таймзона"
              value={batchForm.timezone}
              onChange={(value) =>
                setBatchForm((p) => ({ ...p, timezone: value }))
              }
            />
            <LabeledTextarea
              label="Темы недели"
              placeholder="Темы через запятую: тревога, выгорание..."
              value={batchForm.themes}
              onChange={(value) =>
                setBatchForm((p) => ({ ...p, themes: value }))
              }
            />
            <LabeledTextarea
              label="ТЗ для GPT (опционально)"
              placeholder="Подробное ТЗ для недели..."
              value={batchForm.notes}
              onChange={(value) =>
                setBatchForm((p) => ({ ...p, notes: value }))
              }
            />
            <div>
              <p className="text-xs text-slate-300">Платформы</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {platformList.map((p) => (
                  <label
                    key={p.key}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  >
                    <input
                      type="checkbox"
                      checked={(batchForm.platforms as any)[p.key]}
                      onChange={(e) =>
                        setBatchForm((prev) => ({
                          ...prev,
                          platforms: {
                            ...prev.platforms,
                            [p.key]: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-indigo-100">
                      {platformIcon(p.key)}
                    </span>
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
              <span>Постов в день</span>
              <input
                type="number"
                min={1}
                max={3}
                className="w-16 rounded bg-slate-900 px-2 py-1 text-right text-sm"
                value={batchForm.postsPerDay}
                onChange={(e) =>
                  setBatchForm((p) => ({
                    ...p,
                    postsPerDay: Number(e.target.value) || 1,
                  }))
                }
              />
            </label>
            <button
              onClick={createBatch}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:scale-[1.01] disabled:opacity-60"
            >
              {loading ? "Генерируем..." : "Создать план"}
            </button>
          </div>
        </section>
      </aside>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-indigo-500/5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-300">
              Текущий батч
            </p>
            <h3 className="text-lg font-semibold text-white">
              {activeBatch ? activeBatch.name : "Не выбран"}
            </h3>
            {activeBatch && (
              <p className="text-sm text-slate-400">
                {activeBatch.startDate?.slice(0, 10)} —{" "}
                {activeBatch.endDate?.slice(0, 10)} · {activeBatch.timezone}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeBatch && (
              <StatusBadge status={activeBatch.status} />
            )}
            {activeBatch && (
              <>
                <button
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white hover:border-indigo-400"
                  onClick={() => reloadBatch(activeBatch.id)}
                >
                  Обновить батч
                </button>
                <button
                  className="rounded-lg bg-gradient-to-r from-indigo-500 to-sky-500 px-3 py-2 text-sm font-semibold text-white shadow hover:shadow-indigo-500/30 disabled:opacity-60"
                  disabled={scheduling}
                  onClick={scheduleAll}
                >
                  {scheduling ? "Отправляем..." : "Запланировать всё в Late"}
                </button>
              </>
            )}
          </div>
        </div>

        {!activeBatch && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-slate-400 shadow-xl shadow-indigo-500/5">
            Сначала создайте план слева, чтобы увидеть посты.
          </div>
        )}

        {activeBatch &&
          Object.entries(groupedPosts).map(([date, items]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-200">
                <span className="h-px flex-1 bg-white/10" />
                <span className="whitespace-nowrap bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  {new Date(date).toLocaleDateString("ru-RU", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <div className="space-y-4">
                {items.map((post) => (
                  <PostRow
                    key={post.id}
                    post={post}
                    onChange={updatePost}
                    onRegenerate={regeneratePost}
                    onUpload={uploadMedia}
                  />
                ))}
              </div>
            </div>
          ))}
      </section>
    </main>
  );
}

function LabeledInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block space-y-1 text-sm text-slate-200">
      <span className="text-xs text-slate-400">{props.label}</span>
      <input
        type={props.type || "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
      />
    </label>
  );
}

function LabeledTextarea(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1 text-sm text-slate-200">
      <span className="text-xs text-slate-400">{props.label}</span>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
        rows={3}
      />
    </label>
  );
}

function MediaUploader({
  post,
  onUpload,
}: {
  post: Post;
  onUpload: (id: number, file: File) => Promise<void>;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    onUpload(post.id, file);
  };

  return (
    <div
      className={`relative flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed px-3 py-3 text-sm ${
        dragOver ? "border-indigo-400 bg-indigo-500/10" : "border-white/10"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        handleFile(file);
      }}
    >
      {post.mediaUrl ? (
        <div className="w-full space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-14 w-14 overflow-hidden rounded-lg border border-white/10 bg-slate-900">
              {post.mediaType?.startsWith("image") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.mediaUrl}
                  alt={post.mediaFilename ?? "media"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                  {post.mediaFilename ?? "media"}
                </div>
              )}
            </div>
            <div className="text-xs text-slate-300">
              <p className="font-semibold">{post.mediaFilename}</p>
              <p className="text-slate-500">{post.mediaType}</p>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-indigo-200 hover:text-indigo-100">
            <input
              type="file"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            Заменить файл
          </label>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-200">Перетащи медиа сюда</p>
          <p className="text-xs text-slate-500">или выбери файл</p>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-indigo-200 hover:border-indigo-300 hover:text-indigo-100">
            <input
              type="file"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            Выбрать файл
          </label>
        </>
      )}
    </div>
  );
}

function PreviewCard({ post }: { post: Post }) {
  const commonText = (
    <div className="space-y-2 text-xs text-slate-200">
      <p className="font-semibold text-slate-100">@platform</p>
      <div className="line-clamp-4 text-slate-300">{post.content}</div>
    </div>
  );

  if (post.platform === "instagram") {
    return (
      <div className="h-full rounded-xl border border-white/10 bg-gradient-to-b from-white/5 to-white/0 p-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-pink-500 to-yellow-400" />
          <p className="text-xs font-semibold text-slate-100">Instagram</p>
        </div>
        <div className="mb-2 h-36 rounded-lg border border-white/10 bg-slate-900/60" />
        {commonText}
      </div>
    );
  }

  if (post.platform === "tiktok") {
    return (
      <div className="h-full rounded-xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-3">
        <div className="mb-2 text-xs font-semibold text-white">TikTok</div>
        <div className="mb-2 h-36 rounded-lg border border-white/10 bg-gradient-to-b from-slate-800 to-black" />
        {commonText}
      </div>
    );
  }

  if (post.platform === "telegram") {
    return (
      <div className="h-full rounded-xl border border-white/10 bg-slate-900/60 p-3">
        <div className="mb-2 text-xs font-semibold text-white">Telegram</div>
        <div className="rounded-lg bg-slate-800/70 p-3 text-xs text-slate-100">
          {post.content}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2 text-xs font-semibold text-white">
        {platformLabel[post.platform] ?? post.platform}
      </div>
      {commonText}
    </div>
  );
}

function PostRow({
  post,
  onChange,
  onRegenerate,
  onUpload,
}: {
  post: Post;
  onChange: (id: number, payload: Partial<Post>) => Promise<void>;
  onRegenerate: (id: number) => Promise<void>;
  onUpload: (id: number, file: File) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const date = post.scheduledFor.slice(0, 10);

  const saveField = async (payload: Partial<Post>) => {
    setSaving(true);
    await onChange(post.id, payload);
    setSaving(false);
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-indigo-500/5 md:grid-cols-[1.4fr,1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white">
            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] uppercase">
              {platformIcon(post.platform)}
            </span>
            {platformLabel[post.platform] ?? post.platform}
          </span>
          <select
            className="rounded-lg border border-white/10 bg-slate-900/50 px-2 py-1 text-xs text-white"
            value={post.type}
            onChange={(e) => saveField({ type: e.target.value, status: "edited" })}
          >
            <option value="post">post</option>
            <option value="reel">reel</option>
            <option value="tiktok">tiktok</option>
            <option value="story">story</option>
          </select>
          <input
            type="time"
            className="rounded-lg border border-white/10 bg-slate-900/50 px-2 py-1 text-xs text-white"
            value={post.localTime || "10:00"}
            onChange={(e) =>
              saveField({
                localTime: e.target.value,
                scheduledFor: localToUtc(
                  date,
                  e.target.value,
                  post.timezone,
                ).toISOString(),
              } as any)
            }
          />
          <StatusBadge status={post.status} error={post.lateError ?? undefined} />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Caption</p>
          <textarea
            className="min-h-[120px] w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
            value={post.content}
            onChange={(e) =>
              saveField({ content: e.target.value, status: "edited" })
            }
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-slate-400">First comment (опционально)</p>
          <textarea
            className="min-h-[60px] w-full rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
            value={post.firstComment ?? ""}
            onChange={(e) =>
              saveField({ firstComment: e.target.value, status: "edited" })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white hover:border-indigo-400 disabled:opacity-60"
            disabled={regenLoading}
            onClick={async () => {
              setRegenLoading(true);
              await onRegenerate(post.id);
              setRegenLoading(false);
            }}
          >
            {regenLoading ? "Генерируем..." : "Regen"}
          </button>
          {saving && (
            <span className="text-xs text-slate-400">Сохраняем...</span>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <MediaUploader post={post} onUpload={onUpload} />
        <PreviewCard post={post} />
      </div>
    </div>
  );
}
