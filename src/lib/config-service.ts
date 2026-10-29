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
import { publishConfigToFirestore } from "@/lib/sync-firestore";
import { isVerifiedModel } from "@/lib/validation";
import type {
  PersonalityInput,
  AiConfigInput,
  CustomizationInput,
  GeneralSettingsInput,
} from "@/lib/validation";

export async function getPersonalityConfig() {
  try {
    await ensureDatabaseSchema();
  } catch (err) {
    console.error("[getPersonalityConfig] Schema check:", err);
  }
  const rows = await db.select().from(personalityConfig).where(eq(personalityConfig.id, 1));
  if (rows[0]) return rows[0];
  const [created] = await db.insert(personalityConfig).values({ id: 1 }).returning();
  return created;
}

export async function getAiConfig() {
  try {
    await ensureDatabaseSchema();
  } catch (err) {
    console.error("[getAiConfig] Schema check:", err);
  }
  const rows = await db.select().from(aiConfig).where(eq(aiConfig.id, 1));
  if (rows[0]) return rows[0];
  const [created] = await db.insert(aiConfig).values({ id: 1 }).returning();
  return created;
}

export async function getCustomization() {
  try {
    await ensureDatabaseSchema();
  } catch (err) {
    console.error("[getCustomization] Schema check:", err);
  }
  const rows = await db.select().from(appCustomization).where(eq(appCustomization.id, 1));
  if (rows[0]) return rows[0];
  const [created] = await db.insert(appCustomization).values({ id: 1 }).returning();
  return created;
}

export async function getGeneralSettings() {
  try {
    await ensureDatabaseSchema();
  } catch (err) {
    console.error("[getGeneralSettings] Schema check:", err);
  }
  const rows = await db.select().from(generalSettings).where(eq(generalSettings.id, 1));
  if (rows[0]) return rows[0];
  const [created] = await db.insert(generalSettings).values({ id: 1 }).returning();
  return created;
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
  const [updated] = await db
    .update(aiConfig)
    .set({
      ...input,
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
