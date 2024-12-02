/*
  Warnings:

  - You are about to drop the column `groupKey` on the `Record` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[key]` on the table `Record` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Record" DROP COLUMN "groupKey",
ALTER COLUMN "value" SET DATA TYPE TEXT;

-- CreateIndex
CREATE INDEX "BTreeNode_parentId_idx" ON "BTreeNode"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Record_key_key" ON "Record"("key");

-- CreateIndex
CREATE INDEX "Record_key_idx" ON "Record"("key");
