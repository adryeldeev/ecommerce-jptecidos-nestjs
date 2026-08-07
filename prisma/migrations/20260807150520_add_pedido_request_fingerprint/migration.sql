-- AlterTable
ALTER TABLE "public"."Pedido" ADD COLUMN     "requestFingerprint" TEXT;

-- CreateIndex
CREATE INDEX "Pedido_usuarioId_requestFingerprint_criadoEm_idx" ON "public"."Pedido"("usuarioId", "requestFingerprint", "criadoEm");
