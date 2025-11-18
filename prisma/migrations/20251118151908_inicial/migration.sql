-- DropForeignKey
ALTER TABLE "gar_email_attachments" DROP CONSTRAINT "email_attachments_email_id_fkey";

-- DropForeignKey
ALTER TABLE "gar_emails" DROP CONSTRAINT "emails_garantia_id_fkey";

-- AlterTable
ALTER TABLE "gar_anexos_garantias" RENAME CONSTRAINT "anexos_garantias_pkey" TO "gar_anexos_garantias_pkey";

-- AlterTable
ALTER TABLE "gar_caixa_de_entrada_emails" RENAME CONSTRAINT "caixa_de_entrada_emails_pkey" TO "gar_caixa_de_entrada_emails_pkey";

-- AlterTable
ALTER TABLE "gar_email_attachments" RENAME CONSTRAINT "email_attachments_pkey" TO "gar_email_attachments_pkey";

ALTER TABLE "gar_emails" RENAME CONSTRAINT "emails_pkey" TO "gar_emails_pkey";

-- AlterTable
ALTER TABLE "gar_emails" ALTER COLUMN "garantia_id" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "gar_fornecedores_config" RENAME CONSTRAINT "fornecedores_config_pkey" TO "gar_fornecedores_config_pkey";

-- AlterTable
ALTER TABLE "gar_garantias" RENAME CONSTRAINT "garantias_pkey" TO "gar_garantias_pkey";

-- AlterTable
ALTER TABLE "gar_garantias_abatimentos" RENAME CONSTRAINT "garantias_abatimentos_pkey" TO "gar_garantias_abatimentos_pkey";

-- AlterTable
ALTER TABLE "gar_historico_garantias" RENAME CONSTRAINT "historico_garantias_pkey" TO "gar_historico_garantias_pkey";

-- RenameForeignKey
ALTER TABLE "gar_anexos_garantias" RENAME CONSTRAINT "anexos_garantias_garantia_id_fkey" TO "gar_anexos_garantias_garantia_id_fkey";

-- RenameForeignKey
ALTER TABLE "gar_caixa_de_entrada_emails" RENAME CONSTRAINT "caixa_de_entrada_emails_garantia_id_fkey" TO "gar_caixa_de_entrada_emails_garantia_id_fkey";

-- RenameForeignKey
ALTER TABLE "gar_garantias_abatimentos" RENAME CONSTRAINT "garantias_abatimentos_garantia_id_fkey" TO "gar_garantias_abatimentos_garantia_id_fkey";

-- RenameForeignKey
ALTER TABLE "gar_historico_garantias" RENAME CONSTRAINT "historico_garantias_garantia_id_fkey" TO "gar_historico_garantias_garantia_id_fkey";

-- RenameIndex
ALTER INDEX "caixa_de_entrada_emails_message_id_key" RENAME TO "gar_caixa_de_entrada_emails_message_id_key";

-- RenameIndex
ALTER INDEX "emails_message_id_key" RENAME TO "gar_emails_message_id_key";

-- RenameIndex
ALTER INDEX "fornecedores_config_erp_fornecedor_id_key" RENAME TO "gar_fornecedores_config_erp_fornecedor_id_key";
