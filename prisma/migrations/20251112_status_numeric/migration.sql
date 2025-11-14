-- Convert textual status to numeric codes (1-16) preserving existing data.
ALTER TABLE "garantias" ADD COLUMN "status_temp" INTEGER;

UPDATE "garantias"
SET "status_temp" = CASE
  WHEN "status" ~ '^\d+$' THEN CAST("status" AS INTEGER)
  WHEN LOWER("status") IN ('aguardando aprovacao do fornecedor', 'aguardando aprovação do fornecedor') THEN 1
  WHEN LOWER("status") IN ('emissao de nota fiscal', 'emissão de nota fiscal') THEN 2
  WHEN LOWER("status") IN ('descarte da mercadoria') THEN 3
  WHEN LOWER("status") IN ('aguardando coleta') THEN 4
  WHEN LOWER("status") IN ('aguardando frete cortesia') THEN 5
  WHEN LOWER("status") IN ('aguardando analise de garantia', 'aguardando análise de garantia') THEN 6
  WHEN LOWER("status") IN ('aguardando credito', 'aguardando crédito') THEN 7
  WHEN LOWER("status") IN ('produto em proxima compra', 'produto em próxima compra') THEN 8
  WHEN LOWER("status") IN ('troca de produto') THEN 9
  WHEN LOWER("status") IN ('abatimento em proximo pedido', 'abatimento em próximo pedido') THEN 10
  WHEN LOWER("status") IN ('credito em conta', 'crédito em conta') THEN 11
  WHEN LOWER("status") IN ('abatimento em boleto') THEN 12
  WHEN LOWER("status") IN ('garantia recebida') THEN 13
  WHEN LOWER("status") IN ('concluida', 'concluída') THEN 14
  WHEN LOWER("status") IN ('garantia reprovada') THEN 15
  WHEN LOWER("status") IN ('garantia reprovada na analise', 'garantia reprovada na análise') THEN 16
  ELSE 1
END;

ALTER TABLE "garantias" ALTER COLUMN "status_temp" SET DEFAULT 1;
UPDATE "garantias" SET "status_temp" = 1 WHERE "status_temp" IS NULL;
ALTER TABLE "garantias" ALTER COLUMN "status_temp" SET NOT NULL;

ALTER TABLE "garantias" DROP COLUMN "status";
ALTER TABLE "garantias" RENAME COLUMN "status_temp" TO "status";
