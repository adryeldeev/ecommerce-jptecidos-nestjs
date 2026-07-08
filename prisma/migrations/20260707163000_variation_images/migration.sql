-- AlterTable
ALTER TABLE "public"."ProdutoImagem"
ADD COLUMN "produtoVariacaoId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."ProdutoImagem"
ADD CONSTRAINT "ProdutoImagem_produtoVariacaoId_fkey"
FOREIGN KEY ("produtoVariacaoId") REFERENCES "public"."ProdutoVariacao"("id")
ON DELETE SET NULL ON UPDATE CASCADE;