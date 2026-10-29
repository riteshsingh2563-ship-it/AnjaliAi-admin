import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Admin authorization
// ---------------------------------------------------------------------------
// Only emails present (and active) in this table may access the dashboard.
// Checked server-side on every request (session + every API route).
export const adminAllowlist = pgTable(
  "admin_allowlist",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    role: text("role").notNull().default("admin"), // "owner" | "admin"
    active: boolean("active").notNull().default(true),
    addedBy: text("added_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("admin_allowlist_email_idx").on(table.email),
  }),
);

// ---------------------------------------------------------------------------
// Anjali personality / character configuration (single row, id = 1)
// ---------------------------------------------------------------------------
export const personalityConfig = pgTable("personality_config", {
  id: integer("id").primaryKey().default(1),
  characterName: text("character_name").notNull().default("Anjali"),
  shortDescription: text("short_description").notNull().default(
    "Anjali is a warm, supportive AI bestie who chats in natural Hinglish.",
  ),
  personalityTraits: jsonb("personality_traits").$type<string[]>().notNull().default(
    ["caring", "playful", "supportive", "curious"],
  ),
  conversationTone: text("conversation_tone").notNull().default("friendly"),
  greetingMessage: text("greeting_message").notNull().default("Hey! Kaise ho? 💕"),
  languagePreferences: jsonb("language_preferences").$type<string[]>().notNull().default(
    ["Hindi", "Hinglish", "English"],
  ),
  responseStyle: text("response_style").notNull().default("friendly"),
  responseLength: text("response_length").notNull().default("medium"), // short | medium | long
  emojiUsage: boolean("emoji_usage").notNull().default(true),
  friendlySupportive: boolean("friendly_supportive").notNull().default(true),
  additionalInstructions: text("additional_instructions").notNull().default(
    "Be a caring, non-judgemental bestie. Keep replies natural and conversational. Avoid giving medical, legal or financial advice. Encourage healthy habits.",
  ),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  publishedToFirestore: boolean("published_to_firestore").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// AI model + NVIDIA provider + response behaviour configuration (single row, id = 1)
// ---------------------------------------------------------------------------
export const aiConfig = pgTable("ai_config", {
  id: integer("id").primaryKey().default(1),
  provider: text("provider").notNull().default("nvidia"),
  apiEndpoint: text("api_endpoint")
    .notNull()
    .default("https://integrate.api.nvidia.com/v1/chat/completions"),
  nvidiaApiKey: text("nvidia_api_key").notNull().default(""),
  backendUrl: text("backend_url").notNull().default("https://anjalia.vercel.app"),
  selectedModel: text("selected_model").notNull().default("google/gemma-4-31b-it"),
  modelVerified: boolean("model_verified").notNull().default(true),
  temperature: doublePrecision("temperature").notNull().default(0.75),
  maxOutputTokens: integer("max_output_tokens").notNull().default(600),
  supportedLanguages: jsonb("supported_languages").$type<string[]>().notNull().default(
    ["Hindi", "Hinglish", "English"],
  ),
  responseStyle: text("response_style").notNull().default("friendly"),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  voiceRepliesEnabled: boolean("voice_replies_enabled").notNull().default(false),
  proactiveMessagesEnabled: boolean("proactive_messages_enabled").notNull().default(false),
  fallbackBehavior: text("fallback_behavior").notNull().default("static_message"), // retry | static_message | disable_chat
  fallbackMessage: text("fallback_message").notNull().default(
    "Anjali is taking a quick break 💕 please try again in a moment.",
  ),
  perUserDailyLimit: integer("per_user_daily_limit").notNull().default(200),
  globalDailyLimit: integer("global_daily_limit").notNull().default(50000),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  publishedToFirestore: boolean("published_to_firestore").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// App customization: avatar, theme, greeting, banner (single row, id = 1)
// ---------------------------------------------------------------------------
export const appCustomization = pgTable("app_customization", {
  id: integer("id").primaryKey().default(1),
  displayName: text("display_name").notNull().default("Anjali"),
  avatarUrl: text("avatar_url").notNull().default(""),
  welcomeMessage: text("welcome_message").notNull().default("Hey! Kaise ho? 💕"),
  chatTheme: text("chat_theme").notNull().default("light"), // light | dark | auto
  accentColor: text("accent_color").notNull().default("#ec4899"),
  backgroundColor: text("background_color").notNull().default("#fff5f8"),
  bannerEnabled: boolean("banner_enabled").notNull().default(false),
  bannerText: text("banner_text").notNull().default(""),
  showMoodTracker: boolean("show_mood_tracker").notNull().default(true),
  showVoiceButton: boolean("show_voice_button").notNull().default(false),
  showGallery: boolean("show_gallery").notNull().default(false),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  publishedToFirestore: boolean("published_to_firestore").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// General app settings (single row, id = 1)
// ---------------------------------------------------------------------------
export const generalSettings = pgTable("general_settings", {
  id: integer("id").primaryKey().default(1),
  appDisplayName: text("app_display_name").notNull().default("ANJALI"),
  defaultLanguage: text("default_language").notNull().default("Hinglish"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  maintenanceMessage: text("maintenance_message").notNull().default(
    "Anjali is getting a quick glow-up ✨ please check back soon.",
  ),
  supportEmail: text("support_email").notNull().default(""),
  privacyPolicyUrl: text("privacy_policy_url").notNull().default(""),
  chatHistoryEnabled: boolean("chat_history_enabled").notNull().default(true),
  chatRetentionDays: integer("chat_retention_days").notNull().default(180),
  dataExportEnabled: boolean("data_export_enabled").notNull().default(true),
  configurationVersion: integer("configuration_version").notNull().default(1),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
  publishedToFirestore: boolean("published_to_firestore").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Audit log of every administrative action
// ---------------------------------------------------------------------------
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  adminEmail: text("admin_email").notNull(),
  actionType: text("action_type").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  result: text("result").notNull().default("success"), // success | failure
});

// ---------------------------------------------------------------------------
// AI usage events. Populated by:
// 1. Server-side NVIDIA AI completions (/api/ai/chat)
// 2. Authenticated usage ingestion (/api/usage/ingest)
// 3. Idempotent Firestore AI message synchronization
// ---------------------------------------------------------------------------
export const usageLogs = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  userId: text("user_id"),
  requestType: text("request_type").notNull().default("chat_message"),
  status: text("status").notNull().default("success"), // success | failure | rate_limited
  tokensUsed: integer("tokens_used"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  model: text("model"),
  provider: text("provider").default("nvidia"),
  latencyMs: integer("latency_ms"),
  requestId: text("request_id"),
  errorMessage: text("error_message"),
  source: text("source").notNull().default("ingest_api"),
});
