// Central place for allow-listed, "safe" values the dashboard is permitted to
// write into app configuration. Keeping these as explicit allow-lists means
// the API routes can reject anything unexpected instead of trusting raw input.

// Models verified to work with the ANJALI AI integration (NVIDIA AI API /
// Gemma & Llama endpoints as well as Firebase AI Logic / Gemini models).
export const VERIFIED_GEMINI_MODELS = [
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "nemotron-3.5-lightning-30b-a3b",
  "google/gemma-4-31b-it",
  "meta/llama-3.3-70b-instruct",
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.1-8b-instruct",
  "google/gemma-2-27b-it",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
] as const;

export const AI_PROVIDERS = ["nvidia", "gemini"] as const;

export const SUPPORTED_LANGUAGES = ["Hindi", "Hinglish", "English"] as const;

export const CONVERSATION_TONES = [
  "friendly",
  "playful",
  "caring",
  "flirty-lite",
  "calm",
  "energetic",
] as const;

export const RESPONSE_STYLES = ["friendly", "concise", "expressive", "formal"] as const;
export const RESPONSE_LENGTHS = ["short", "medium", "long"] as const;
export const FALLBACK_BEHAVIORS = ["retry", "static_message", "disable_chat"] as const;
export const CHAT_THEMES = ["light", "dark", "auto"] as const;

export const ADMIN_SESSION_COOKIE = "anjali_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: "admin.login.success",
  LOGIN_DENIED: "admin.login.denied",
  LOGOUT: "admin.logout",
  PERSONALITY_UPDATE: "personality.update",
  AI_CONFIG_UPDATE: "ai_config.update",
  CUSTOMIZATION_UPDATE: "customization.update",
  GENERAL_SETTINGS_UPDATE: "general_settings.update",
  MAINTENANCE_MODE_TOGGLE: "general_settings.maintenance_toggle",
  USER_STATUS_CHANGE: "user.status_change",
  AVATAR_UPLOAD: "customization.avatar_upload",
} as const;

export const MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
