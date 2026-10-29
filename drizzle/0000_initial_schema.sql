-- Initial & Non-Destructive PostgreSQL Schema for ANJALI AI Admin Dashboard (Drizzle ORM)
-- Safe to run on both empty and existing Neon PostgreSQL databases.

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

CREATE TABLE IF NOT EXISTS "personality_config" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "character_name" text DEFAULT 'Anjali' NOT NULL,
  "short_description" text DEFAULT 'Anjali is a warm, supportive AI bestie who chats in natural Hinglish.' NOT NULL,
  "personality_traits" jsonb DEFAULT '["caring","playful","supportive","curious"]'::jsonb NOT NULL,
  "conversation_tone" text DEFAULT 'friendly' NOT NULL,
  "greeting_message" text DEFAULT 'Hey! Kaise ho? 💕' NOT NULL,
  "language_preferences" jsonb DEFAULT '["Hindi","Hinglish","English"]'::jsonb NOT NULL,
  "response_style" text DEFAULT 'friendly' NOT NULL,
  "response_length" text DEFAULT 'medium' NOT NULL,
  "emoji_usage" boolean DEFAULT true NOT NULL,
  "friendly_supportive" boolean DEFAULT true NOT NULL,
  "additional_instructions" text DEFAULT 'Be a caring, non-judgemental bestie. Keep replies natural and conversational. Avoid giving medical, legal or financial advice. Encourage healthy habits.' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" text,
  "published_to_firestore" boolean DEFAULT false NOT NULL,
  "published_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "ai_config" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "provider" text DEFAULT 'nvidia' NOT NULL,
  "api_endpoint" text DEFAULT 'https://integrate.api.nvidia.com/v1/chat/completions' NOT NULL,
  "nvidia_api_key" text DEFAULT '' NOT NULL,
  "backend_url" text DEFAULT 'https://anjalia.vercel.app' NOT NULL,
  "selected_model" text DEFAULT 'google/gemma-4-31b-it' NOT NULL,
  "model_verified" boolean DEFAULT true NOT NULL,
  "temperature" double precision DEFAULT 0.75 NOT NULL,
  "max_output_tokens" integer DEFAULT 600 NOT NULL,
  "supported_languages" jsonb DEFAULT '["Hindi","Hinglish","English"]'::jsonb NOT NULL,
  "response_style" text DEFAULT 'friendly' NOT NULL,
  "ai_enabled" boolean DEFAULT true NOT NULL,
  "voice_replies_enabled" boolean DEFAULT false NOT NULL,
  "proactive_messages_enabled" boolean DEFAULT false NOT NULL,
  "fallback_behavior" text DEFAULT 'static_message' NOT NULL,
  "fallback_message" text DEFAULT 'Anjali is taking a quick break — please try again in a moment.' NOT NULL,
  "per_user_daily_limit" integer DEFAULT 200 NOT NULL,
  "global_daily_limit" integer DEFAULT 50000 NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" text,
  "published_to_firestore" boolean DEFAULT false NOT NULL,
  "published_at" timestamp with time zone
);

ALTER TABLE "ai_config"
  ADD COLUMN IF NOT EXISTS "provider" text DEFAULT 'nvidia' NOT NULL,
  ADD COLUMN IF NOT EXISTS "api_endpoint" text DEFAULT 'https://integrate.api.nvidia.com/v1/chat/completions' NOT NULL,
  ADD COLUMN IF NOT EXISTS "nvidia_api_key" text DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS "backend_url" text DEFAULT 'https://anjalia.vercel.app' NOT NULL;

CREATE TABLE IF NOT EXISTS "app_customization" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "display_name" text DEFAULT 'Anjali' NOT NULL,
  "avatar_url" text DEFAULT '' NOT NULL,
  "welcome_message" text DEFAULT 'Hey! Kaise ho? 💕' NOT NULL,
  "chat_theme" text DEFAULT 'light' NOT NULL,
  "accent_color" text DEFAULT '#ec4899' NOT NULL,
  "background_color" text DEFAULT '#fff5f8' NOT NULL,
  "banner_enabled" boolean DEFAULT false NOT NULL,
  "banner_text" text DEFAULT '' NOT NULL,
  "show_mood_tracker" boolean DEFAULT true NOT NULL,
  "show_voice_button" boolean DEFAULT false NOT NULL,
  "show_gallery" boolean DEFAULT false NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" text,
  "published_to_firestore" boolean DEFAULT false NOT NULL,
  "published_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "general_settings" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "app_display_name" text DEFAULT 'ANJALI' NOT NULL,
  "default_language" text DEFAULT 'Hinglish' NOT NULL,
  "maintenance_mode" boolean DEFAULT false NOT NULL,
  "maintenance_message" text DEFAULT 'Anjali is getting a quick glow-up — please check back soon.' NOT NULL,
  "support_email" text DEFAULT '' NOT NULL,
  "privacy_policy_url" text DEFAULT '' NOT NULL,
  "chat_history_enabled" boolean DEFAULT true NOT NULL,
  "chat_retention_days" integer DEFAULT 180 NOT NULL,
  "data_export_enabled" boolean DEFAULT true NOT NULL,
  "configuration_version" integer DEFAULT 1 NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by" text,
  "published_to_firestore" boolean DEFAULT false NOT NULL,
  "published_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  "admin_email" text NOT NULL,
  "action_type" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "result" text DEFAULT 'success' NOT NULL
);

CREATE TABLE IF NOT EXISTS "usage_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
  "user_id" text,
  "request_type" text DEFAULT 'chat_message' NOT NULL,
  "status" text DEFAULT 'success' NOT NULL,
  "tokens_used" integer,
  "prompt_tokens" integer,
  "completion_tokens" integer,
  "model" text,
  "provider" text DEFAULT 'nvidia',
  "latency_ms" integer,
  "request_id" text,
  "error_message" text,
  "source" text DEFAULT 'ingest_api' NOT NULL
);

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
