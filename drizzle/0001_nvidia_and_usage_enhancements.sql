-- Non-destructive incremental migration for existing Neon PostgreSQL databases
-- Ensures admin_allowlist exists and adds NVIDIA provider & usage tracking columns

CREATE TABLE IF NOT EXISTS "admin_allowlist" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "display_name" text,
  "role" text DEFAULT 'admin' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "added_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_allowlist_email_idx" ON "admin_allowlist" ("email");

ALTER TABLE "ai_config"
  ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'nvidia' NOT NULL,
  ADD COLUMN IF NOT EXISTS "api_endpoint" text DEFAULT 'https://integrate.api.nvidia.com/v1/chat/completions' NOT NULL,
  ADD COLUMN IF NOT EXISTS "nvidia_api_key" text DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS "backend_url" text DEFAULT 'https://anjalia.vercel.app' NOT NULL;

ALTER TABLE "usage_logs"
  ADD COLUMN IF NOT EXISTS "prompt_tokens" integer,
  ADD COLUMN IF NOT EXISTS "completion_tokens" integer,
  ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'nvidia',
  ADD COLUMN IF NOT EXISTS "request_id" text,
  ADD COLUMN IF NOT EXISTS "error_message" text;

CREATE UNIQUE INDEX IF NOT EXISTS "usage_logs_request_id_idx"
  ON "usage_logs" ("request_id")
  WHERE "request_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "usage_logs_timestamp_idx"
  ON "usage_logs" ("timestamp");
