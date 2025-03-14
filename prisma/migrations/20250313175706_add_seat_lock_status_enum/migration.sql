/*
  Warnings:

  - The `status` column on the `SeatLock` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "SeatLockStatus" AS ENUM ('Active', 'Released', 'Expired');

-- AlterTable
ALTER TABLE "SeatLock" DROP COLUMN "status",
ADD COLUMN     "status" "SeatLockStatus" NOT NULL DEFAULT 'Active';
