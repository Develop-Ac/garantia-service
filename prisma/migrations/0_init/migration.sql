-- Garantias
CREATE TABLE "gar_garantias" (
    "id" SERIAL NOT NULL,
    "erp_fornecedor_id" INTEGER,
    "nome_fornecedor" VARCHAR(255) NOT NULL,
    "email_fornecedor" VARCHAR(255),
    "produtos" TEXT NOT NULL,
    "nota_interna" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "tipo_garantia" VARCHAR(100),
    "nfs_compra" VARCHAR(255),
    "status" VARCHAR(100) NOT NULL DEFAULT 'Aguardando Aprovação do Fornecedor',
    "data_criacao" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "precisa_nota_fiscal" BOOLEAN,
    "cfop" VARCHAR(10),
    "frete_por_conta_de" VARCHAR(50),
    "transportadora_razao_social" VARCHAR(255),
    "transportadora_cnpj" VARCHAR(20),
    "transportadora_ie" VARCHAR(20),
    "transportadora_endereco" TEXT,
    "numero_nf_devolucao" VARCHAR(50),
    "data_coleta_envio" DATE,
    "nf_abatida_boleto" VARCHAR(50),
    "tipo_credito_final" VARCHAR(255),
    "protocolo_fornecedor" VARCHAR(255),
    "tem_nova_interacao" BOOLEAN DEFAULT false,
    "copias_email" TEXT,
    "transportadora_cidade" TEXT,
    "transportadora_uf" TEXT,
    "codigo_coleta_envio" TEXT,
    "obs" TEXT,
    "valor_credito_total" NUMERIC(12, 2),
    "valor_credito_utilizado" NUMERIC(12, 2) NOT NULL DEFAULT 0,
    CONSTRAINT "garantias_pkey" PRIMARY KEY ("id")
);

-- Anexos de Garantias
CREATE TABLE "gar_anexos_garantias" (
    "id" SERIAL NOT NULL,
    "garantia_id" INTEGER NOT NULL,
    "nome_ficheiro" VARCHAR(255) NOT NULL,
    "path_ficheiro" VARCHAR(255) NOT NULL,
    "data_upload" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anexos_garantias_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "anexos_garantias_garantia_id_fkey" FOREIGN KEY ("garantia_id") REFERENCES "gar_garantias"("id") ON DELETE CASCADE
);

-- Garantias Abatimentos
CREATE TABLE "gar_garantias_abatimentos" (
    "id" BIGSERIAL NOT NULL,
    "garantia_id" INTEGER NOT NULL,
    "nf" TEXT NOT NULL,
    "parcela" TEXT NOT NULL,
    "vencimento" DATE NOT NULL,
    "valor" NUMERIC(12, 2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "garantias_abatimentos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "garantias_abatimentos_garantia_id_fkey" FOREIGN KEY ("garantia_id") REFERENCES "gar_garantias"("id") ON DELETE CASCADE
);

-- Historico de Garantias
CREATE TABLE "gar_historico_garantias" (
    "id" SERIAL NOT NULL,
    "garantia_id" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo_interacao" VARCHAR(100) NOT NULL,
    "data_ocorrencia" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "foi_visto" BOOLEAN DEFAULT true,
    "message_id" TEXT,
    "assunto" TEXT,
    CONSTRAINT "historico_garantias_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "historico_garantias_garantia_id_fkey" FOREIGN KEY ("garantia_id") REFERENCES "gar_garantias"("id") ON DELETE CASCADE
);

-- Caixa de Entrada de Emails
CREATE TABLE "gar_caixa_de_entrada_emails" (
    "id" SERIAL NOT NULL,
    "message_id" TEXT NOT NULL,
    "garantia_id" INTEGER,
    "remetente" TEXT,
    "assunto" TEXT,
    "corpo_html" TEXT,
    "data_recebimento" TIMESTAMPTZ,
    "foi_processado" BOOLEAN DEFAULT false,
    "reply_to" TEXT,
    "to_list" TEXT[] DEFAULT '{}'::TEXT[],
    "cc_list" TEXT[] DEFAULT '{}'::TEXT[],
    "bcc_list" TEXT[] DEFAULT '{}'::TEXT[],
    "attachments" JSONB DEFAULT '[]'::jsonb,
    CONSTRAINT "caixa_de_entrada_emails_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "caixa_de_entrada_emails_message_id_key" UNIQUE ("message_id"),
    CONSTRAINT "caixa_de_entrada_emails_garantia_id_fkey" FOREIGN KEY ("garantia_id") REFERENCES "gar_garantias"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "gar_idx_caixa_entrada_garantia_id" ON "gar_caixa_de_entrada_emails" ("garantia_id");

-- Emails recebidos
CREATE TABLE "gar_emails" (
    "id" BIGSERIAL NOT NULL,
    "message_id" TEXT,
    "remetente" TEXT,
    "assunto" TEXT,
    "corpo_html" TEXT,
    "data_recebimento" TIMESTAMPTZ,
    "reply_to" TEXT,
    "to_list" JSONB,
    "cc_list" JSONB,
    "bcc_list" JSONB,
    "controle_interno" TEXT,
    "nota_interna" TEXT,
    "garantia_id" INTEGER,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "emails_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "emails_message_id_key" UNIQUE ("message_id"),
    CONSTRAINT "emails_garantia_id_fkey" FOREIGN KEY ("garantia_id") REFERENCES "gar_garantias"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "gar_idx_emails_garantia_id" ON "gar_emails" ("garantia_id");
CREATE INDEX IF NOT EXISTS "gar_idx_emails_nota_interna" ON "gar_emails" ("nota_interna");

-- Anexos de Emails
CREATE TABLE "gar_email_attachments" (
    "id" BIGSERIAL NOT NULL,
    "email_id" BIGINT,
    "filename" TEXT,
    "mime_type" TEXT,
    "size_bytes" BIGINT,
    "content_id" TEXT,
    "content_base64" TEXT,
    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_attachments_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "gar_emails"("id") ON DELETE CASCADE
);

-- Configuracao de Fornecedores
CREATE TABLE "gar_fornecedores_config" (
    "id" SERIAL NOT NULL,
    "erp_fornecedor_id" INTEGER NOT NULL,
    "processo_tipo" VARCHAR(50) NOT NULL,
    "portal_link" TEXT,
    "formulario_path" TEXT,
    "nome_formulario" VARCHAR(255),
    CONSTRAINT "fornecedores_config_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fornecedores_config_erp_fornecedor_id_key" UNIQUE ("erp_fornecedor_id")
);


