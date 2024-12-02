-- CreateTable
CREATE TABLE "BTreeNode" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER,
    "keys" INTEGER[],
    "children" INTEGER[],
    "isLeaf" BOOLEAN NOT NULL,

    CONSTRAINT "BTreeNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" SERIAL NOT NULL,
    "key" INTEGER NOT NULL,
    "value" TEXT NOT NULL,
    "nodeId" INTEGER NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BTreeNode" ADD CONSTRAINT "BTreeNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BTreeNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "BTreeNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
