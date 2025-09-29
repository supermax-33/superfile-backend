-- AlterTable
ALTER TABLE "Space" ADD COLUMN "vectorStoreId" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "Space_vectorStoreId_key" ON "Space"("vectorStoreId") WHERE "vectorStoreId" IS NOT NULL;
