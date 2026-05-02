ALTER TABLE "gar_anexos_email"
  ADD COLUMN IF NOT EXISTS "mime_type" TEXT,
  ADD COLUMN IF NOT EXISTS "size_bytes" BIGINT,
  ADD COLUMN IF NOT EXISTS "content_id" TEXT,
  ADD COLUMN IF NOT EXISTS "is_inline" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "storage_bucket" TEXT,
  ADD COLUMN IF NOT EXISTS "storage_key" TEXT;

CREATE INDEX IF NOT EXISTS "gar_idx_anexos_email_garantia_id" ON "gar_anexos_email" ("garantia_id");
CREATE INDEX IF NOT EXISTS "gar_idx_anexos_email_content_id" ON "gar_anexos_email" ("content_id");
