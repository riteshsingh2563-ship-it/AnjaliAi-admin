import { z } from "zod";
import {
  CHAT_THEMES,
  CONVERSATION_TONES,
  FALLBACK_BEHAVIORS,
  RESPONSE_LENGTHS,
  RESPONSE_STYLES,
  VERIFIED_GEMINI_MODELS,
} from "@/lib/constants";

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a valid hex color, e.g. #ec4899");

const languageList = z
  .array(z.string().min(1).max(30))
  .min(1, "Select at least one language")
  .max(10);

export const personalitySchema = z.object({
  characterName: z.string().trim().min(1, "Character name is required").max(60),
  shortDescription: z.string().trim().min(1, "Short description is required").max(400),
  personalityTraits: z.array(z.string().trim().min(1).max(30)).min(1).max(12),
  conversationTone: z.enum(CONVERSATION_TONES),
  greetingMessage: z.string().trim().min(1, "Greeting message is required").max(300),
  languagePreferences: languageList,
  responseStyle: z.enum(RESPONSE_STYLES),
  responseLength: z.enum(RESPONSE_LENGTHS),
  emojiUsage: z.boolean(),
  friendlySupportive: z.boolean(),
  additionalInstructions: z.string().trim().max(6000).default(""),
});
export type PersonalityInput = z.infer<typeof personalitySchema>;

export const aiConfigSchema = z.object({
  selectedModel: z.string().trim().min(1).max(60),
  temperature: z.number().min(0).max(2),
  maxOutputTokens: z.number().int().min(16).max(8192),
  supportedLanguages: languageList,
  responseStyle: z.enum(RESPONSE_STYLES),
  aiEnabled: z.boolean(),
  voiceRepliesEnabled: z.boolean(),
  proactiveMessagesEnabled: z.boolean(),
  fallbackBehavior: z.enum(FALLBACK_BEHAVIORS),
  fallbackMessage: z.string().trim().min(1).max(300),
  perUserDailyLimit: z.number().int().min(1).max(100000),
  globalDailyLimit: z.number().int().min(1).max(100000000),
});
export type AiConfigInput = z.infer<typeof aiConfigSchema>;

export function isVerifiedModel(model: string): boolean {
  return (VERIFIED_GEMINI_MODELS as readonly string[]).includes(model);
}

export const customizationSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  avatarUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => v === "" || /^https?:\/\//.test(v), "Avatar URL must start with http(s):// or be empty"),
  welcomeMessage: z.string().trim().min(1).max(300),
  chatTheme: z.enum(CHAT_THEMES),
  accentColor: hexColor,
  backgroundColor: hexColor,
  bannerEnabled: z.boolean(),
  bannerText: z.string().trim().max(200).default(""),
  showMoodTracker: z.boolean(),
  showVoiceButton: z.boolean(),
  showGallery: z.boolean(),
});
export type CustomizationInput = z.infer<typeof customizationSchema>;

export const generalSettingsSchema = z.object({
  appDisplayName: z.string().trim().min(1).max(60),
  defaultLanguage: z.string().trim().min(1).max(30),
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().trim().min(1).max(300),
  supportEmail: z.string().trim().max(200).refine(
    (v) => v === "" || z.string().email().safeParse(v).success,
    "Must be a valid email or empty",
  ),
  privacyPolicyUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => v === "" || /^https?:\/\//.test(v), "Must be a valid URL or empty"),
  chatHistoryEnabled: z.boolean(),
  chatRetentionDays: z.number().int().min(1).max(3650),
  dataExportEnabled: z.boolean(),
});
export type GeneralSettingsInput = z.infer<typeof generalSettingsSchema>;
