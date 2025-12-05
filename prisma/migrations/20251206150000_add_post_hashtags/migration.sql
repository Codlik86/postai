-- Add hashtags field to Post for storing generated/edited hashtag strings
ALTER TABLE "Post" ADD COLUMN "hashtags" TEXT;
