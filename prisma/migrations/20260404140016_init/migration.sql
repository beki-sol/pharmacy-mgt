/*
  Warnings:

  - You are about to drop the column `sessionId` on the `Draft` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `Drug` table. All the data in the column will be lost.
  - Added the required column `userId` to the `Draft` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Draft_sessionId_idx";

-- DropIndex
DROP INDEX "Drug_category_idx";

-- AlterTable
ALTER TABLE "Draft" DROP COLUMN "sessionId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Drug" DROP COLUMN "category",
ADD COLUMN     "category_id" TEXT;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Draft_userId_idx" ON "Draft"("userId");

-- AddForeignKey
ALTER TABLE "Drug" ADD CONSTRAINT "Drug_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
