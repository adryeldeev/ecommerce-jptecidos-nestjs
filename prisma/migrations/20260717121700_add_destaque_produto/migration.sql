-- AlterTable
ALTER TABLE "public"."Produto" ADD COLUMN "maisProcurado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "lancamento" BOOLEAN NOT NULL DEFAULT false;
