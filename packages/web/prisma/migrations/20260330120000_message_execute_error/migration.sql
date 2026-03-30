-- AlterTable
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "executeError" JSONB;
