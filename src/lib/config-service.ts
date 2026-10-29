import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseSchema } from "@/db/init";
import {
  personalityConfig,
  aiConfig,
  appCustomization,
  generalSettings,
} from "@/db/schema";
import {
  publishConfigToFirestore,
  readExistingFirestoreAppConfig,
} from "@/lib/sync-firestore";
import {
  env,
  DEFAULT_BACKEND_URL,
  DEFAULT_NVIDIA_API_ENDPOINT,
  DEFAULT_NVIDIA_MODEL,
} from "@/lib/env";
import { isVerifiedModel } from "@/lib/validation";
import type {
  PersonalityInput,
  AiConfigInput,
  CustomizationInput,
  GeneralSettingsInput,
} from "@/lib/validation";

type AiConfigRow = typeof aiConfig.$inferSelect;

export type ClientSafeAiConfig = Omit<AiConfigRow, "nvidiaApiKey"> & {
  apiKeyConfigured: boolean;
  apiKeySource: "env" | "database" | "firestore" | "none";
  apiKeyMasked: string;
};

export function maskSecretKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 6)}••••${trimmed.slice(-4)}`;
}

export async function resolveServerNvidiaApiKey(row?: AiConfigRow): Promise<{
  key: string;
  source: "env" | "database" | "firestore" | "none";
}> {
  if (env.NVIDIA_API_KEY && !env.NVIDIA_API_KEY.startsWith("YOUR_")) {
    return { key: env.NVIDIA_API_KEY, source: "env" };
  }
  const aiRow = row ?? (await getAiConfig());
  if (
    aiRow.nvidiaApiKey &&
    aiRow.nvidiaApiKey.trim().length > 0 &&
    !aiRow.nvidiaApiKey.startsWith("YOUR_")
  ) {
    return { key: aiRow.nvidiaApiKey.trim(), source: "database" };
  }
  const existingFs = await readExistingFirestoreAppConfig();
  if (
    existingFs &&
    typeof existingFs.apiKey === "string" &&
    existingFs.apiKey.trim().startsWith("nvapi-")
  ) {
    return { key: existingFs.apiKey.trim(), source: "firestore" };
  }
  return { key: "", source: "none" };
}

export async function sanitizeAiConfigForClient(row: AiConfigRow): Promise<ClientSafeAiConfig> {
  const resolved = await resolveServerNvidiaApiKey(row);
  const { nvidiaApiKey: _secret, ...rest } = row;
  void _secret;
  return {
    ...rest,
    apiKeyConfigured: Boolean(resolved.key),
    apiKeySource: resolved.source,
    apiKeyMasked: maskSecretKey(resolved.key),
  };
}

export async function getPersonalityConfig() {
  await ensureDatabaseSchema();
  const rows = await db.select().from(personalityConfig).where(eq(personalityConfig.id, 1));
  if (rows[0]) return rows[0];

  const existingFs = await readExistingFirestoreAppConfig();
  const initialName =
    (typeof existingFs?.characterName === "string" && existingFs.characterName.trim()) ||
    (typeof existingFs?.companionName === "string" && existingFs.companionName.trim()) ||
    "Anjali";
  const initialGreeting =
    (typeof existingFs?.greetingMessage === "string" && existingFs.greetingMessage.trim()) ||
    (typeof existingFs?.defaultGreeting === "string" && existingFs.defaultGreeting.trim()) ||
    "Heyy! 😄\nKaise ho? Aaj ka din kaisa raha?";
  const initialInstructions =
    (typeof existingFs?.personalityInstructions === "string" &&
      existingFs.personalityInstructions.trim()) ||
    (typeof existingFs?.systemPrompt === "string" && existingFs.systemPrompt.trim()) ||
    "Be a caring, non-judgemental bestie. Keep replies natural and conversational. Avoid giving medical, legal or financial advice. Encourage healthy habits.";

  const [created] = await db
    .insert(personalityConfig)
    .values({
      id: 1,
      characterName: initialName,
      greetingMessage: initialGreeting,
      additionalInstructions: initialInstructions,
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  const retry = await db.select().from(personalityConfig).where(eq(personalityConfig.id, 1));
  return retry[0]!;
}

export async function getAiConfig() {
  await ensureDatabaseSchema();
  const rows = await db.select().from(aiConfig).where(eq(aiConfig.id, 1));
  if (rows[0]) return rows[0];

  const existingFs = await readExistingFirestoreAppConfig();
  const initialModel =
    (typeof existingFs?.selectedModel === "string" && existingFs.selectedModel.trim()) ||
    (typeof existingFs?.model === "string" && existingFs.model.trim()) ||
    env.NVIDIA_MODEL ||
    DEFAULT_NVIDIA_MODEL;
  const initialEndpoint =
    (typeof existingFs?.apiEndpoint === "string" && existingFs.apiEndpoint.trim()) ||
    env.NVIDIA_API_ENDPOINT ||
    DEFAULT_NVIDIA_API_ENDPOINT;
  const initialProvider =
    typeof existingFs?.provider === "string" &&
    (existingFs.provider === "nvidia" || existingFs.provider === "gemini")
      ? existingFs.provider
      : "nvidia";
  const initialTemp =
    typeof existingFs?.temperature === "number" ? existingFs.temperature : 0.75;
  const initialMaxTokens =
    typeof existingFs?.maximumResponseLength === "number"
      ? existingFs.maximumResponseLength
      : typeof existingFs?.maxTokens === "number"
        ? existingFs.maxTokens
        : 600;
  const legacyFsKey =
    typeof existingFs?.apiKey === "string" &&
    existingFs.apiKey.trim().length > 0 &&
    !existingFs.apiKey.startsWith("YOUR_")
      ? existingFs.apiKey.trim()
      : "";

  const [created] = await db
    .insert(aiConfig)
    .values({
      id: 1,
      provider: initialProvider,
      apiEndpoint: initialEndpoint,
      nvidiaApiKey: legacyFsKey,
      backendUrl: env.NEXT_PUBLIC_APP_URL || DEFAULT_BACKEND_URL,
      selectedModel: initialModel,
      modelVerified: isVerifiedModel(initialModel),
      temperature: initialTemp,
      maxOutputTokens: initialMaxTokens,
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  const retry = await db.select().from(aiConfig).where(eq(aiConfig.id, 1));
  return retry[0]!;
}

export async function getCustomization() {
  await ensureDatabaseSchema();
  const rows = await db.select().from(appCustomization).where(eq(appCustomization.id, 1));
  if (rows[0]) return rows[0];

  const [created] = await db
    .insert(appCustomization)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  const retry = await db.select().from(appCustomization).where(eq(appCustomization.id, 1));
  return retry[0]!;
}

export async function getGeneralSettings() {
  await ensureDatabaseSchema();
  const rows = await db.select().from(generalSettings).where(eq(generalSettings.id, 1));
  if (rows[0]) return rows[0];

  const [created] = await db
    .insert(generalSettings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();

  if (created) return created;
  const retry = await db.select().from(generalSettings).where(eq(generalSettings.id, 1));
  return retry[0]!;
}

async function publishAndFlag(adminEmail: string) {
  const [personality, ai, customization, general] = await Promise.all([
    getPersonalityConfig(),
    getAiConfig(),
    getCustomization(),
    getGeneralSettings(),
  ]);

  const result = await publishConfigToFirestore({ personality, ai, customization, general });

  if (result.attempted) {
    const now = new Date();
    await Promise.all([
      db
        .update(personalityConfig)
        .set({ publishedToFirestore: result.success, publishedAt: result.success ? now : undefined })
        .where(eq(personalityConfig.id, 1)),
      db
        .update(aiConfig)
        .set({ publishedToFirestore: result.success, publishedAt: result.success ? now : undefined })
        .where(eq(aiConfig.id, 1)),
      db
        .update(appCustomization)
        .set({ publishedToFirestore: result.success, publishedAt: result.success ? now : undefined })
        .where(eq(appCustomization.id, 1)),
      db
        .update(generalSettings)
        .set({ publishedToFirestore: result.success, publishedAt: result.success ? now : undefined })
        .where(eq(generalSettings.id, 1)),
    ]);
  }

  void adminEmail;
  return result;
}

export async function savePersonalityConfig(input: PersonalityInput, adminEmail: string) {
  const current = await getPersonalityConfig();
  const [updated] = await db
    .update(personalityConfig)
    .set({
      ...input,
      version: current.version + 1,
      updatedAt: new Date(),
      updatedBy: adminEmail,
    })
    .where(eq(personalityConfig.id, 1))
    .returning();

  const publish = await publishAndFlag(adminEmail);
  return { row: updated, publish };
}

export async function saveAiConfig(input: AiConfigInput, adminEmail: string) {
  const current = await getAiConfig();
  const { apiKey, ...restInput } = input;
  const nextApiKey =
    typeof apiKey === "string" && apiKey.trim().length > 0
      ? apiKey.trim()
      : current.nvidiaApiKey;

  const [updated] = await db
    .update(aiConfig)
    .set({
      ...restInput,
      nvidiaApiKey: nextApiKey,
      modelVerified: isVerifiedModel(input.selectedModel),
      version: current.version + 1,
      updatedAt: new Date(),
      updatedBy: adminEmail,
    })
    .where(eq(aiConfig.id, 1))
    .returning();

  const publish = await publishAndFlag(adminEmail);
  return { row: updated, publish };
}

export async function saveCustomization(input: CustomizationInput, adminEmail: string) {
  const current = await getCustomization();
  const [updated] = await db
    .update(appCustomization)
    .set({
      ...input,
      version: current.version + 1,
      updatedAt: new Date(),
      updatedBy: adminEmail,
    })
    .where(eq(appCustomization.id, 1))
    .returning();

  const publish = await publishAndFlag(adminEmail);
  return { row: updated, publish };
}

export async function saveGeneralSettings(input: GeneralSettingsInput, adminEmail: string) {
  const current = await getGeneralSettings();
  const [updated] = await db
    .update(generalSettings)
    .set({
      ...input,
      version: current.version + 1,
      configurationVersion: current.configurationVersion + 1,
      updatedAt: new Date(),
      updatedBy: adminEmail,
    })
    .where(eq(generalSettings.id, 1))
    .returning();

  const publish = await publishAndFlag(adminEmail);
  return { row: updated, publish };
}
