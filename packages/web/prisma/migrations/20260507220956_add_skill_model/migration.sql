-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullHandle" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Skill_userId_repo_idx" ON "Skill"("userId", "repo");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_userId_repo_fullHandle_key" ON "Skill"("userId", "repo", "fullHandle");

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
