-- Migration generated manually for Late API switch.
-- Run locally with: npx prisma migrate dev

-- Drop existing tables to realign IDs and remove BufferAuth.
DROP TABLE IF EXISTS "ContentItem" CASCADE;
DROP TABLE IF EXISTS "ContentBatch" CASCADE;
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "BufferAuth" CASCADE;

-- Recreate tables with Late-friendly schema.
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "lateAccountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentBatch" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentItem" (
    "id" SERIAL NOT NULL,
    "batchId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "script" JSONB,
    "hashtags" TEXT,
    "cta" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "latePostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ContentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
