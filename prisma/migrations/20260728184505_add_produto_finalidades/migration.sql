-- AlterTable
ALTER TABLE "public"."Produto" ADD COLUMN     "finalidades" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
