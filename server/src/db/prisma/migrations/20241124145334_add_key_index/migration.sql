-- AlterTable
ALTER TABLE "BTreeNode" ALTER COLUMN "t" SET DEFAULT 3;

-- CreateIndex
CREATE INDEX "BTreeKey_key_idx" ON "BTreeKey"("key");
