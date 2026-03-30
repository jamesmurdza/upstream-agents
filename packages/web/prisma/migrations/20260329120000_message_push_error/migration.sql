-- Persist push-retry UI payload on messages (reload-safe)
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "pushError" JSONB;
