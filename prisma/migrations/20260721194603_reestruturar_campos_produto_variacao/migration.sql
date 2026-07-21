/*
  Warnings:

  - You are about to drop the column `dimensaoAlturaCm` on the `Produto` table. All the data in the column will be lost.
  - You are about to drop the column `dimensaoComprimentoCm` on the `Produto` table. All the data in the column will be lost.
  - You are about to drop the column `dimensaoLarguraCm` on the `Produto` table. All the data in the column will be lost.
  - You are about to drop the column `pesoGramas` on the `Produto` table. All the data in the column will be lost.
  - You are about to drop the column `largura` on the `ProdutoVariacao` table. Existing values are migrated to `Produto.largura` before the column is dropped.

*/
-- AlterTable: add new Produto columns (nullable, backfilled below)
ALTER TABLE "public"."Produto"
ADD COLUMN     "largura" DECIMAL(5,2),
ADD COLUMN     "rendimento" DECIMAL(6,2);

-- Backfill Produto.largura from the existing ProdutoVariacao.largura value
-- (rolo de tecido: largura nao varia entre variacoes de cor do mesmo produto)
UPDATE "public"."Produto" p
SET "largura" = sub."largura"
FROM (
  SELECT DISTINCT ON ("produtoId") "produtoId", "largura"
  FROM "public"."ProdutoVariacao"
  WHERE "largura" IS NOT NULL
  ORDER BY "produtoId", "largura"
) sub
WHERE p.id = sub."produtoId";

-- Correcao manual: produto "Retalho ate 15 metros" tinha dois valores de largura
-- conflitantes (dimensaoLarguraCm = 1.7 vs ProdutoVariacao.largura = 1.4).
-- Confirmado com o time que a largura real do rolo e 1.7.
UPDATE "public"."Produto"
SET "largura" = 1.7
WHERE id = 'f25af8aa-a344-44cf-b99e-44d727991ecc';

-- Drop obsolete package weight/dimension columns from Produto
ALTER TABLE "public"."Produto"
DROP COLUMN "dimensaoAlturaCm",
DROP COLUMN "dimensaoComprimentoCm",
DROP COLUMN "dimensaoLarguraCm",
DROP COLUMN "pesoGramas";

-- AlterTable: drop largura from ProdutoVariacao (moved to Produto)
ALTER TABLE "public"."ProdutoVariacao" DROP COLUMN "largura";
