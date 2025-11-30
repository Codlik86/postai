-- Migration for Late-based scheduler.
-- Run locally: npx prisma migrate dev

DROP TABLE IF EXISTS "Post" CASCADE;
DROP TABLE IF EXISTS "ContentItem" CASCADE;
DROP TABLE IF EXISTS "ContentBatch" CASCADE;
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "BufferAuth" CASCADE;

CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "platform" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "lateAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Account_lateAccountId_key" UNIQUE ("lateAccountId")
);

CREATE TABLE "ContentBatch" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "themes" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "platform" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "localTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'post',
    "content" TEXT NOT NULL,
    "firstComment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "mediaFilename" TEXT,
    "latePostId" TEXT,
    "lateError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Post_latePostId_key" UNIQUE ("latePostId")
);

ALTER TABLE "Post" ADD CONSTRAINT "Post_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ContentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
