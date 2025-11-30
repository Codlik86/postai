# PostAI

Планировщик контента для «Помни» (Next.js + Prisma + OpenAI + Late).

## Стек
- Next.js (App Router, TypeScript, Tailwind)
- Prisma + Postgres
- OpenAI для генерации
- Late API для автопостинга

## ENV
Смотри `.env.example`:
- `DATABASE_URL`
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
- `LATE_API_KEY`, `LATE_API_BASE_URL`
- `DEFAULT_TIMEZONE`

## Скрипты
- `npm run dev`
- `npm run build` (включает `prisma generate`)
- `npm start`
- `npm run lint`

## Работа
1. Заполни `.env`, затем `npm install` и `npx prisma migrate dev`.
2. На `/`: синхронизируй аккаунты Late.
3. Создай план (диапазон дат, темы, ТЗ, платформы) — посты по дням создадутся.
4. Переключай дни через табы, генерируй контент дня, редактируй пост справа, загружай медиа.
5. Отправь неделю в Late одной кнопкой.
