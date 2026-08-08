-- CreateEnum
CREATE TYPE "Site" AS ENUM ('LOWES', 'HOME_DEPOT', 'BEST_BUY', 'FRIGIDAIRE');

-- CreateEnum
CREATE TYPE "TrendType" AS ENUM ('RISING', 'FALLING', 'VOLATILE');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelNumber" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemSite" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "site" "Site" NOT NULL,
    "productUrl" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSaleNotifiedPrice" DECIMAL(10,2),
    "lastSaleNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "ItemSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceCheck" (
    "id" TEXT NOT NULL,
    "itemSiteId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price" DECIMAL(10,2),
    "listPrice" DECIMAL(10,2),
    "isSale" BOOLEAN NOT NULL DEFAULT false,
    "percentOff" DECIMAL(5,2),
    "inStock" BOOLEAN,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,

    CONSTRAINT "PriceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendAlert" (
    "id" TEXT NOT NULL,
    "itemSiteId" TEXT NOT NULL,
    "trendType" "TrendType" NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "fromPrice" DECIMAL(10,2),
    "toPrice" DECIMAL(10,2),
    "percentChange" DECIMAL(5,2),
    "emailed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TrendAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricePrediction" (
    "id" TEXT NOT NULL,
    "itemSiteId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forDate" TIMESTAMP(3) NOT NULL,
    "predictedPrice" DECIMAL(10,2) NOT NULL,
    "confidence" DECIMAL(5,2),
    "method" TEXT NOT NULL,

    CONSTRAINT "PricePrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemSite_itemId_site_key" ON "ItemSite"("itemId", "site");

-- CreateIndex
CREATE INDEX "PriceCheck_itemSiteId_checkedAt_idx" ON "PriceCheck"("itemSiteId", "checkedAt");

-- CreateIndex
CREATE INDEX "TrendAlert_itemSiteId_detectedAt_idx" ON "TrendAlert"("itemSiteId", "detectedAt");

-- CreateIndex
CREATE INDEX "PricePrediction_itemSiteId_generatedAt_idx" ON "PricePrediction"("itemSiteId", "generatedAt");

-- AddForeignKey
ALTER TABLE "ItemSite" ADD CONSTRAINT "ItemSite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceCheck" ADD CONSTRAINT "PriceCheck_itemSiteId_fkey" FOREIGN KEY ("itemSiteId") REFERENCES "ItemSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendAlert" ADD CONSTRAINT "TrendAlert_itemSiteId_fkey" FOREIGN KEY ("itemSiteId") REFERENCES "ItemSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricePrediction" ADD CONSTRAINT "PricePrediction_itemSiteId_fkey" FOREIGN KEY ("itemSiteId") REFERENCES "ItemSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
