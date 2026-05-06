-- AlterTable
ALTER TABLE "ScheduledJob" ADD COLUMN "triggerType" TEXT NOT NULL DEFAULT 'interval';
ALTER TABLE "ScheduledJob" ADD COLUMN "githubWebhookId" INTEGER;
ALTER TABLE "ScheduledJob" ADD COLUMN "webhookSecret" TEXT;
