-- AlterTable
ALTER TABLE "LandingConfig" ADD COLUMN     "address" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ALTER COLUMN "googleMapsIframe" DROP NOT NULL;
