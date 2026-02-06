-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "loyaltyPointsAwarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderSent" BOOLEAN NOT NULL DEFAULT false;
