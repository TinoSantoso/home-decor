ALTER TABLE "Project" ADD COLUMN "data" JSONB;

CREATE UNIQUE INDEX "Payment_provider_providerRef_key" ON "Payment"("provider", "providerRef");
