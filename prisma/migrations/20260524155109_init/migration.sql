-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('homeowner', 'designer', 'contractor', 'developer');

-- CreateEnum
CREATE TYPE "BudgetTier" AS ENUM ('hemat', 'standar', 'premium', 'mewah');

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('living_room', 'bedroom', 'kitchen', 'bathroom', 'dining', 'office', 'terrace', 'garden', 'carport', 'facade', 'balcony', 'backyard');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('furniture', 'lighting', 'paint', 'flooring', 'plant', 'accessory', 'fixture', 'landscaping', 'electrical', 'masonry');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('esensial', 'direkomendasikan', 'opsional');

-- CreateEnum
CREATE TYPE "LayoutSource" AS ENUM ('template', 'upload', 'manual');

-- CreateEnum
CREATE TYPE "EntitlementType" AS ENUM ('export_credit', 'unlimited_monthly');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('stripe', 'midtrans', 'xendit');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'homeowner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "templateId" TEXT,
    "climateZone" TEXT NOT NULL DEFAULT 'tropical_indonesia',
    "budgetTier" "BudgetTier" NOT NULL DEFAULT 'standar',
    "contingencyPct" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "taxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeLayout" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" "LayoutSource" NOT NULL DEFAULT 'template',
    "floorCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "HomeLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ZoneType" NOT NULL,
    "indoor" BOOLEAN NOT NULL,
    "areaM2" DOUBLE PRECISION NOT NULL,
    "widthM" DOUBLE PRECISION NOT NULL,
    "lengthM" DOUBLE PRECISION NOT NULL,
    "heightM" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "floor" INTEGER NOT NULL DEFAULT 1,
    "styleThemeId" TEXT,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StyleTheme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "colorPalette" JSONB NOT NULL,
    "materialPalette" JSONB NOT NULL,
    "exampleImage" TEXT,

    CONSTRAINT "StyleTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneCustomization" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "floorMaterialId" TEXT,
    "wallMaterialId" TEXT,
    "ceilingMaterialId" TEXT,
    "lightingSetupId" TEXT,
    "plantSetId" TEXT,
    "colorOverrides" JSONB,

    CONSTRAINT "ZoneCustomization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "subcategory" TEXT,
    "indoorOk" BOOLEAN NOT NULL DEFAULT true,
    "outdoorOk" BOOLEAN NOT NULL DEFAULT false,
    "climateTags" TEXT[],
    "styleTags" TEXT[],
    "dimensions" JSONB,
    "durabilityScore" INTEGER NOT NULL DEFAULT 3,
    "maintenanceScore" INTEGER NOT NULL DEFAULT 3,
    "priceHemat" INTEGER NOT NULL,
    "priceStandar" INTEGER NOT NULL,
    "pricePremium" INTEGER NOT NULL,
    "priceMewah" INTEGER NOT NULL,
    "asset3dUrl" TEXT,
    "thumbnailUrl" TEXT,
    "alternativeIds" TEXT[],

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacedItem" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "transform" JSONB NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "PlacedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborRate" (
    "category" "ItemCategory" NOT NULL,
    "pctOfMaterials" DOUBLE PRECISION NOT NULL,
    "adjustable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LaborRate_pkey" PRIMARY KEY ("category")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "EntitlementType" NOT NULL,
    "source" TEXT NOT NULL,
    "exportsRemaining" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT NOT NULL,
    "amountIdr" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "entitlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "HomeLayout_projectId_key" ON "HomeLayout"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ZoneCustomization_zoneId_key" ON "ZoneCustomization"("zoneId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeLayout" ADD CONSTRAINT "HomeLayout_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_styleThemeId_fkey" FOREIGN KEY ("styleThemeId") REFERENCES "StyleTheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneCustomization" ADD CONSTRAINT "ZoneCustomization_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedItem" ADD CONSTRAINT "PlacedItem_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedItem" ADD CONSTRAINT "PlacedItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
