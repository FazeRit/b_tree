/*
  Warnings:

  - You are about to drop the column `leftBoundary` on the `BTreeNode` table. All the data in the column will be lost.
  - You are about to drop the column `minDegree` on the `BTreeNode` table. All the data in the column will be lost.
  - You are about to drop the column `position` on the `BTreeNode` table. All the data in the column will be lost.
  - You are about to drop the column `positionType` on the `BTreeNode` table. All the data in the column will be lost.
  - You are about to drop the column `rightBoundary` on the `BTreeNode` table. All the data in the column will be lost.
  - You are about to drop the `Record` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Record" DROP CONSTRAINT "Record_nodeId_fkey";

-- DropIndex
DROP INDEX "BTreeNode_parentId_idx";

-- AlterTable
ALTER TABLE "BTreeNode" DROP COLUMN "leftBoundary",
DROP COLUMN "minDegree",
DROP COLUMN "position",
DROP COLUMN "positionType",
DROP COLUMN "rightBoundary";

-- DropTable
DROP TABLE "Record";

-- CreateTable
CREATE TABLE "BTreeKey" (
    "id" SERIAL NOT NULL,
    "key" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "nodeId" INTEGER NOT NULL,

    CONSTRAINT "BTreeKey_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BTreeKey" ADD CONSTRAINT "BTreeKey_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "BTreeNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
