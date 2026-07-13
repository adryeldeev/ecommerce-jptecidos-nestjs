/*
  Warnings:

  - You are about to drop the column `quantidadeEstoque` on the `Produto` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `Produto` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable: Add new columns to Produto (slug as nullable first)
ALTER TABLE "public"."Produto"
ADD COLUMN     "composicao" TEXT,
ADD COLUMN     "dimensaoAlturaCm" DECIMAL(6,2),
ADD COLUMN     "dimensaoComprimentoCm" DECIMAL(6,2),
ADD COLUMN     "dimensaoLarguraCm" DECIMAL(6,2),
ADD COLUMN     "fabricanteId" TEXT,
ADD COLUMN     "gramatura" DECIMAL(6,2),
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "pesoGramas" INTEGER,
ADD COLUMN     "slug" TEXT;

-- Backfill slug for existing records with collision handling
WITH slug_candidates AS (
  SELECT 
    id,
    titulo,
    lower(regexp_replace(regexp_replace(titulo, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) as base_slug,
    ROW_NUMBER() OVER (PARTITION BY lower(regexp_replace(regexp_replace(titulo, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) ORDER BY id) as row_num
  FROM "public"."Produto"
  WHERE "slug" IS NULL
)
UPDATE "public"."Produto" p
SET "slug" = CASE 
  WHEN sc.row_num = 1 THEN sc.base_slug
  ELSE sc.base_slug || '-' || (sc.row_num - 1)::text
END
FROM slug_candidates sc
WHERE p.id = sc.id;

-- Make slug NOT NULL after backfill
ALTER TABLE "public"."Produto" ALTER COLUMN "slug" SET NOT NULL;

-- Drop quantidadeEstoque
ALTER TABLE "public"."Produto" DROP COLUMN "quantidadeEstoque";

-- AlterTable
ALTER TABLE "public"."ProdutoVariacao" ADD COLUMN     "corCodigo" TEXT,
ADD COLUMN     "preco" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "public"."Fabricante" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Fabricante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fabricante_nome_key" ON "public"."Fabricante"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_slug_key" ON "public"."Produto"("slug");

-- AddForeignKey
ALTER TABLE "public"."Produto" ADD CONSTRAINT "Produto_fabricanteId_fkey" FOREIGN KEY ("fabricanteId") REFERENCES "public"."Fabricante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
