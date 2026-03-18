-- AlterTable: Add agentId column to Message table
-- This stores which agent created each message so agent icons/names are preserved
-- when the branch's current agent is changed
ALTER TABLE "Message" ADD COLUMN "agentId" TEXT;
