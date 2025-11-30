# PostAI

Минимальный каркас Next.js (App Router, TypeScript, Tailwind CSS).

## Стек
- Next.js (App Router, TS, Tailwind)
- Prisma + Postgres (Neon)
- OpenAI (генерация текста)
- Late API (публикация в соцсети)

## Скрипты
- `npm run dev` — дев-сервер на http://localhost:3000
- `npm run build` — продакшн-сборка
- `npm start` — запуск собранного приложения
- `npm run lint` — проверка кода

Главные файлы: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`.

## ENV
Создай `.env` (можешь ориентироваться на `.env.example`):
- `DATABASE_URL` — строка подключения Postgres (Neon/Supabase)
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` — ключ, база и модель OpenAI/прокси
- `LATE_API_KEY`, `LATE_API_BASE_URL`, `DEFAULT_TIMEZONE` — ключ и базовый URL Late API, таймзона по умолчанию

## Prisma
После установки зависимостей прогоняй миграции:
```bash
npm install
npx prisma migrate dev
```

## Late API (автопостинг)
- Создай API-ключ в Late и подключи соцаккаунты, положи `LATE_API_KEY` в `.env`.
- Синхронизация: кнопка «Синхронизировать аккаунты» (GET `/api/accounts/sync`), сохраняет аккаунты в БД.
- Планирование: на главной странице заполни форму и нажми «Сгенерировать план» (POST `/api/batches`) — GPT создаст тексты и сохранит посты.
- Редактирование: правь контент/время/медиа прямо в таблице (PATCH `/api/posts/[id]`, upload `/api/media/upload`, regen `/api/posts/[id]/regenerate`).
- Публикация: «Запланировать всё в Late» (POST `/api/batches/[id]/schedule-late`) — создаёт посты в Late и обновляет статусы.

## Быстрый старт
1. Заполни `.env` (DATABASE_URL, OPENAI_*, LATE_API_KEY, LATE_API_BASE_URL, DEFAULT_TIMEZONE).
2. `npm install`
3. `npx prisma migrate dev`
4. `npm run dev`
5. Открой http://localhost:3000, синхронизируй аккаунты, создай план, отредактируй, нажми «Запланировать всё в Late».
