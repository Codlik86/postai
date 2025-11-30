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
  date: string;
  time: string;
  kind: string;
  caption?: string | null;
  firstComment?: string | null;
  status: PostStatus | string;
  mediaUrl?: string | null;
};

type LateMediaFile = {
  url: string;
  filename: string;
  type: string;
};

const DEFAULT_TZ = process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Europe/Moscow";
const TODAY_ISO = new Date().toISOString().slice(0, 10);

const platformLabel: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  threads: "Threads",
  telegram: "Telegram",
};

const statusClasses: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  generated: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  edited: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  scheduled: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

function StatusBadge({ status, error }: { status: string; error?: string }) {
  const cls = statusClasses[status] ?? "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
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

function platformIcon(platform: string) {
  if (platform === "instagram") return "IG";
  if (platform === "tiktok") return "TT";
  if (platform === "threads") return "TH";
  if (platform === "telegram") return "TG";
  return platform.slice(0, 2).toUpperCase();
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("ru-RU", {
    month: "short",
    day: "numeric",
  });
}

export default function Page() {
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
  });
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [isGeneratingThemes, setIsGeneratingThemes] = useState(false);
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);

useEffect(() => {
  const name = defaultWeekName();
  setBatchForm((prev) => ({ ...prev, name }));
  fetch("/api/accounts")
    .then((res) => res.json())
    .then((data) => setAccounts(data.accounts ?? []))
    .catch(() => {});
}, []);

  useEffect(() => {
    if (posts.length && selectedPostId === null) {
      setSelectedPostId(posts[0].id);
      const firstDate = posts[0].date?.slice(0, 10);
      setActiveDay(firstDate);
    }
    if (!posts.length) {
      setSelectedPostId(null);
      setActiveDay(null);
    }
  }, [posts, selectedPostId]);

  useEffect(() => {
    if (activeDay) {
      const match = posts.find((p) => p.date?.slice(0, 10) === activeDay);
      if (match) setSelectedPostId(match.id);
    }
  }, [activeDay, posts]);

  const selectedPost = useMemo(
    () => posts.find((p) => p.id === selectedPostId) ?? null,
    [posts, selectedPostId],
  );

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

  async function generateBrief(mode: "themes" | "brief") {
    const start =
      batchForm.startDate && batchForm.startDate.length > 0
        ? batchForm.startDate
        : TODAY_ISO;
    const end =
      batchForm.endDate && batchForm.endDate.length > 0
        ? batchForm.endDate
        : TODAY_ISO;

    const platforms = Object.entries(batchForm.platforms)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (platforms.length === 0) {
      showToast({
        type: "error",
        title: "Отметь хотя бы одну платформу",
      });
      return;
    }

    if (mode === "themes") setIsGeneratingThemes(true);
    if (mode === "brief") setIsGeneratingBrief(true);

    try {
      const res = await fetch("/api/ai/weekly-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          platforms,
          notes: batchForm.notes || batchForm.themes,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка генерации");
      }

      const data = await res.json();
      setBatchForm((prev) => ({
        ...prev,
        themes:
          mode === "themes" || (!prev.themes && data.themes)
            ? data.themes
            : prev.themes,
        notes:
          mode === "brief" || (!prev.notes && data.brief)
            ? data.brief
            : prev.notes,
      }));

      showToast({ type: "success", title: "Готово" });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Не удалось сгенерировать",
        description: err.message,
      });
    } finally {
      setIsGeneratingThemes(false);
      setIsGeneratingBrief(false);
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
      setSelectedPostId(data.posts?.[0]?.id ?? null);
    setActiveDay(data.posts?.[0] ? data.posts[0].date?.slice(0, 10) : null);
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
      id: data.batch.id,
      name: data.batch.name,
      startDate: data.batch.startDate,
      endDate: data.batch.endDate,
      timezone: data.batch.timezone,
      status: data.batch.status,
    });
    setPosts(data.posts ?? []);
    setSelectedPostId(data.posts?.[0]?.id ?? null);
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
      status: "edited",
    } as any);
    showToast({ type: "success", title: "Медиа загружено" });
  }

  async function scheduleAll() {
    if (!activeBatch) return;
    setScheduling(true);
    try {
      const res = await fetch(`/api/late/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: activeBatch.id }),
      });
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

  const days = useMemo(() => {
    const uniq = new Set<string>();
    posts.forEach((p) => uniq.add(p.date?.slice(0, 10)));
    return Array.from(uniq).sort();
  }, [posts]);

  useEffect(() => {
    if (!activeDay && days.length) {
      setActiveDay(days[0]);
    }
  }, [activeDay, days]);

  async function generateAllPostsForDay(day: string) {
    if (!activeBatch) return;
    try {
      const res = await fetch("/api/generate/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: activeBatch.id, date: day }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Ошибка генерации");
      }
      const data = await res.json();
      setPosts(data.posts ?? []);
      showToast({ type: "success", title: "Посты дня обновлены" });
    } catch (err: any) {
      showToast({
        type: "error",
        title: "Не удалось сгенерировать",
        description: err.message,
      });
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">PostAI</h1>
            <p className="mt-1 text-sm text-slate-500">
              Планировщик контента для Помни
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          {/* Левая колонка */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-slate-900">
                    Late
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Подключи аккаунты в Late и нажми «Синхронизировать».
                  </p>
                </div>
                <button
                  onClick={syncAccounts}
                  disabled={syncing}
                  className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {syncing ? "Синк..." : "Синхронизировать"}
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {accounts.length === 0 && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                    Нет аккаунтов
                  </span>
                )}
                {accounts.map((acc) => (
                  <span
                    key={acc.id}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                      {platformIcon(acc.platform)}
                    </span>
                    {acc.displayName}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Новый план
                </h2>
                <p className="text-xs text-slate-500">
                  Заполни поля и сгенерируй контент на неделю.
                </p>
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
                  actionLabel={isGeneratingThemes ? "Генерация..." : "🎲 Сгенерировать темы"}
                  onAction={
                    isGeneratingThemes || isGeneratingBrief ? undefined : () => generateBrief("themes")
                  }
                  disabled={isGeneratingThemes}
                  placeholder="Темы через запятую: тревога, выгорание..."
                  value={batchForm.themes}
                  onChange={(value) =>
                    setBatchForm((p) => ({ ...p, themes: value }))
                  }
                />
                <LabeledTextarea
                  label="ТЗ для GPT (опционально)"
                  actionLabel={isGeneratingBrief ? "Генерация..." : "✨ Сгенерировать ТЗ"}
                  onAction={
                    isGeneratingThemes || isGeneratingBrief ? undefined : () => generateBrief("brief")
                  }
                  disabled={isGeneratingBrief}
                  placeholder="Подробное ТЗ для недели..."
                  value={batchForm.notes}
                  onChange={(value) =>
                    setBatchForm((p) => ({ ...p, notes: value }))
                  }
                />
                <div>
                  <p className="text-xs text-slate-500">Платформы</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {platformList.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900"
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
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                          {platformIcon(p.key)}
                        </span>
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  onClick={createBatch}
                  disabled={loading}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {loading ? "Генерируем..." : "Создать план"}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Посты
                  </h2>
                  {activeBatch && (
                    <p className="text-xs text-slate-500">
                      {activeBatch.startDate?.slice(0, 10)} —{" "}
                      {activeBatch.endDate?.slice(0, 10)}
                    </p>
                  )}
                </div>
                {activeBatch && (
                  <div className="flex items-center gap-2">
                    <StatusBadge status={activeBatch.status} />
                    <button
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => reloadBatch(activeBatch.id)}
                    >
                      Обновить батч
                    </button>
                    <button
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                      disabled={scheduling}
                      onClick={scheduleAll}
                    >
                      {scheduling ? "Отправляем..." : "Отправить неделю"}
                    </button>
                  </div>
                )}
              </div>

              {days.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {days.map((day) => (
                    <button
                      key={day}
                      onClick={() => setActiveDay(day)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        activeDay === day
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {formatDate(day)}
                    </button>
                  ))}
                </div>
              )}

              {activeDay && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Посты за {activeDay}
                  </p>
                  <button
                    onClick={() => generateAllPostsForDay(activeDay)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Сгенерировать все посты дня ✨
                  </button>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white">
                {posts.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-slate-500">
                    Постов нет. Сначала создайте план.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {posts
                      .filter(
                        (post) =>
                          post.date?.slice(0, 10) === activeDay,
                      )
                      .map((post) => {
                        const isSelected = post.id === selectedPostId;
                        return (
                          <li
                            key={post.id}
                            onClick={() => setSelectedPostId(post.id)}
                            className={`flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition hover:bg-slate-50 ${
                              isSelected ? "bg-slate-50" : ""
                            }`}
                          >
                            <div className="w-24 text-xs text-slate-600">
                              <input
                                type="time"
                                value={post.time || "10:00"}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setPosts((prev) =>
                                    prev.map((p) =>
                                      p.id === post.id ? { ...p, time: e.target.value } : p,
                                    ),
                                  )
                                }
                                onBlur={(e) => updatePost(post.id, { time: e.target.value })}
                                className="w-24 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                                {platformIcon(post.platform)}
                              </span>
                              <span className="text-slate-800">
                                {platformLabel[post.platform] ?? post.platform}
                              </span>
                              <select
                                value={post.kind}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const kind = e.target.value;
                                  setPosts((prev) =>
                                    prev.map((p) =>
                                      p.id === post.id ? { ...p, kind, status: "edited" } : p,
                                    ),
                                  );
                                  updatePost(post.id, { kind, status: "edited" } as any);
                                }}
                                className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none"
                              >
                                <option value="post">post</option>
                                <option value="reel">reel</option>
                                <option value="tiktok">tiktok</option>
                                <option value="story">story</option>
                              </select>
                            </div>
                            <StatusBadge status={post.status} />
                            {post.mediaUrl && (
                              <span className="ml-auto text-[11px] text-slate-500">
                                📎 медиа
                              </span>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {/* Правая колонка */}
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {selectedPost ? (
                <SelectedPostEditor
                  post={selectedPost}
                  onChangeLocal={(updates) =>
                    setPosts((prev) =>
                      prev.map((p) =>
                        p.id === selectedPost.id ? { ...p, ...updates } : p,
                      ),
                    )
                  }
                  onSave={updatePost}
                  onRegenerate={regeneratePost}
                  onUpload={uploadMedia}
                />
              ) : (
                <p className="text-sm text-slate-500">
                  Выбери пост слева, чтобы отредактировать его.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
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
    <label className="block space-y-1 text-sm text-slate-900">
      <span className="text-xs text-slate-500">{props.label}</span>
      <input
        type={props.type || "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
      />
    </label>
  );
}

function LabeledTextarea(props: {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1 text-sm text-slate-900">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{props.label}</span>
        {props.onAction && props.actionLabel && (
          <button
            type="button"
            onClick={props.onAction}
            disabled={props.disabled}
            className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 disabled:opacity-60"
          >
            {props.actionLabel}
          </button>
        )}
      </div>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
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
      className={`relative flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed px-3 py-3 text-sm ${
        dragOver ? "border-slate-400 bg-slate-100" : "border-slate-200 bg-slate-50"
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
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.mediaUrl}
                alt="media"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="text-xs text-slate-600">
              <p className="font-semibold">Медиа добавлено</p>
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700 hover:text-slate-900">
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
          <p className="text-sm text-slate-700">Перетащи медиа сюда</p>
          <p className="text-xs text-slate-500">или выбери файл</p>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-50">
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

function SelectedPostEditor({
  post,
  onChangeLocal,
  onSave,
  onRegenerate,
  onUpload,
}: {
  post: Post;
  onChangeLocal: (updates: Partial<Post>) => void;
  onSave: (id: number, payload: Partial<Post>) => Promise<void>;
  onRegenerate: (id: number) => Promise<void>;
  onUpload: (id: number, file: File) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);

  const saveField = async (payload: Partial<Post>) => {
    setSaving(true);
    await onSave(post.id, payload);
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Текущий пост
          </p>
          <h2 className="mt-1 text-sm font-semibold text-slate-900">
            {(platformLabel[post.platform] ?? post.platform) +
              " · " +
              post.date.slice(0, 10) +
              " · " +
              (post.time || "10:00")}
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
          {post.kind}
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600">Caption</label>
        <textarea
          className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          rows={5}
          value={post.caption ?? ""}
          onChange={(e) => onChangeLocal({ caption: e.target.value, status: "edited" })}
          onBlur={(e) => saveField({ caption: e.target.value, status: "edited" })}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600">
          First comment (опционально)
        </label>
        <textarea
          className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          rows={3}
          value={post.firstComment ?? ""}
          onChange={(e) =>
            onChangeLocal({ firstComment: e.target.value, status: "edited" })
          }
          onBlur={(e) => saveField({ firstComment: e.target.value, status: "edited" })}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex flex-col text-sm text-slate-700">
          <span className="text-xs text-slate-500">Время</span>
          <input
            type="time"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            value={post.time || "10:00"}
            onChange={(e) =>
              onChangeLocal({
                time: e.target.value,
                status: "edited",
              })
            }
            onBlur={(e) => {
              saveField({
                time: e.target.value,
              });
            }}
          />
        </div>
        <div className="flex flex-col text-sm text-slate-700">
          <span className="text-xs text-slate-500">Тип</span>
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            value={post.kind}
            onChange={(e) => {
              onChangeLocal({ kind: e.target.value, status: "edited" });
              saveField({ kind: e.target.value, status: "edited" });
            }}
          >
            <option value="post">post</option>
            <option value="reel">reel</option>
            <option value="tiktok">tiktok</option>
            <option value="story">story</option>
          </select>
        </div>
        <div className="ml-auto">
          <StatusBadge status={post.status} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            setRegenLoading(true);
            await onRegenerate(post.id);
            setRegenLoading(false);
          }}
          className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          disabled={regenLoading}
        >
          {regenLoading ? "Генерируем..." : "Regen"}
        </button>
        {saving && <span className="text-xs text-slate-500">Сохраняем...</span>}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600">Медиа</label>
        <div className="mt-2">
          <MediaUploader post={post} onUpload={onUpload} />
        </div>
      </div>
    </div>
  );
}
