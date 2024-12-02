/*
  Warnings:

  - A unique constraint covering the columns `[key,nodeId]` on the table `Record` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Record_key_nodeId_key" ON "Record"("key", "nodeId");
