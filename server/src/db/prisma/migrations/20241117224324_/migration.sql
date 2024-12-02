-- DropIndex
DROP INDEX "Record_key_key";

-- CreateIndex
CREATE INDEX "Record_nodeId_idx" ON "Record"("nodeId");
