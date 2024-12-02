/*
  Warnings:

  - You are about to drop the column `children` on the `BTreeNode` table. All the data in the column will be lost.
  - You are about to drop the column `keys` on the `BTreeNode` table. All the data in the column will be lost.
  - You are about to alter the column `value` on the `Record` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(100)`.

*/
-- DropIndex
DROP INDEX "Record_key_nodeId_key";

-- AlterTable
ALTER TABLE "BTreeNode" DROP COLUMN "children",
DROP COLUMN "keys",
ADD COLUMN     "leftBoundary" INTEGER DEFAULT 0,
ADD COLUMN     "minDegree" INTEGER,
ADD COLUMN     "position" INTEGER,
ADD COLUMN     "rightBoundary" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "Record" ADD COLUMN     "groupKey" TEXT,
ALTER COLUMN "value" SET DATA TYPE VARCHAR(100);
