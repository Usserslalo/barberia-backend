/*
  Warnings:

  - Made the column `phone` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- Actualizar filas existentes con phone NULL (placeholder para migración)
UPDATE "User" SET phone = '+521550000000' WHERE phone IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;
