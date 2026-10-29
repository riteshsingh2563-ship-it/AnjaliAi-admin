import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { env, DEFAULT_BACKEND_URL, DEFAULT_NVIDIA_API_ENDPOINT } from "@/lib/env";
import type {
  personalityConfig as PersonalityTable,
  aiConfig as AiConfigTable,
  appCustomization as CustomizationTable,
  generalSettings as GeneralSettingsTable,
} from "@/db/schema";

type PersonalityRow = typeof PersonalityTable.$inferSelect;
type AiConfigRow = typeof AiConfigTable.$inferSelect;
type CustomizationRow = typeof CustomizationTable.$inferSelect;
type GeneralSettingsRow = typeof GeneralSettingsTable.$inferSelect;

export type PublishResult = {
  attempted: boolean;
  success: boolean;
  error?: string;
};

/**
 * Reads the existing `app_config/ai` document from Cloud Firestore if
 * available so first-time PostgreSQL initialization can preserve any
 * existing production settings already stored in Firestore.
 */
export async function readExistingFirestoreAppConfig(): Promise<Record<string, unknown> | null> {
  const admin = getFirebaseAdmin();
  if (!admin) return null;
  try {
    const snap = await admin.firestore.collection("app_config").doc("ai").get();
    if (!snap.exists) return null;
    return (snap.data() as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

/**
 * Publishes the current configuration to Cloud Firestore so the Android app
 * can read it (via Firestore real-time listeners on `app_config/ai`)
 * without requiring a new APK release.
 *
 * Security note: `nvidiaApiKey` is stripped and never written to public
 * Firestore documents from the dashboard.
 */
export async function publishConfigToFirestore(data: {
  personality: PersonalityRow;
  ai: AiConfigRow;
  customization: CustomizationRow;
  general: GeneralSettingsRow;
}): Promise<PublishResult> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return {
      attempted: false,
      success: false,
      error: "Firebase Admin SDK is not configured.",
    };
  }

  try {
    const { personality, ai, customization, general } = data;

    const configurationVersion =
      personality.version + ai.version + customization.version + general.version;

    const resolvedName =
      personality.characterName.trim() ||
      customization.displayName.trim() ||
      "Anjali";
    const resolvedGreeting =
      personality.greetingMessage.trim() ||
      customization.welcomeMessage.trim() ||
      "Heyy! 😄\nKaise ho? Aaj ka din kaisa raha?";
    const resolvedBanner =
      customization.bannerEnabled && customization.bannerText.trim().length > 0
        ? customization.bannerText.trim()
        : "";
    const resolvedEndpoint =
      ai.apiEndpoint.trim() || DEFAULT_NVIDIA_API_ENDPOINT;
    const resolvedBackendUrl =
      ai.backendUrl.trim() || env.NEXT_PUBLIC_APP_URL || DEFAULT_BACKEND_URL;

    const flatDoc = {
      // Dashboard canonical fields
      characterName: resolvedName,
      displayName: customization.displayName || resolvedName,
      appName: general.appDisplayName,
      shortDescription: personality.shortDescription,
      personalityTraits: personality.personalityTraits,
      conversationTone: personality.conversationTone,
      greetingMessage: resolvedGreeting,
      welcomeMessage: customization.welcomeMessage || resolvedGreeting,
      personalityInstructions: personality.additionalInstructions,
      languagePreferences: personality.languagePreferences,
      supportedLanguages: ai.supportedLanguages,
      defaultLanguage: general.defaultLanguage,
      responseStyle: ai.responseStyle || personality.responseStyle,
      responseLength: personality.responseLength,
      emojiEnabled: personality.emojiUsage,
      friendlySupportive: personality.friendlySupportive,
      maximumResponseLength: ai.maxOutputTokens,
      provider: ai.provider || "nvidia",
      apiEndpoint: resolvedEndpoint,
      backendUrl: resolvedBackendUrl,
      selectedModel: ai.selectedModel,
      temperature: ai.temperature,
      aiEnabled: ai.aiEnabled,
      voiceRepliesEnabled: ai.voiceRepliesEnabled,
      proactiveMessagesEnabled: ai.proactiveMessagesEnabled,
      fallbackBehavior: ai.fallbackBehavior,
      fallbackMessage: ai.fallbackMessage,
      perUserDailyLimit: ai.perUserDailyLimit,
      globalDailyLimit: ai.globalDailyLimit,
      maintenanceMode: general.maintenanceMode,
      maintenanceMessage: general.maintenanceMessage,
      supportEmail: general.supportEmail,
      privacyPolicyUrl: general.privacyPolicyUrl,
      avatarUrl: customization.avatarUrl,
      accentColor: customization.accentColor,
      backgroundColor: customization.backgroundColor,
      chatTheme: customization.chatTheme,
      bannerEnabled: customization.bannerEnabled,
      bannerText: customization.bannerText,
      showMoodTracker: customization.showMoodTracker,
      showVoiceButton: customization.showVoiceButton,
      showGallery: customization.showGallery,
      chatHistoryEnabled: general.chatHistoryEnabled,
      chatRetentionDays: general.chatRetentionDays,
      dataExportEnabled: general.dataExportEnabled,
      configurationVersion,

      // Android BackendAppConfig fields (ensuring 100% live compatibility)
      companionName: resolvedName,
      companionTagline: "Your Bestie",
      onlineStatusText: general.maintenanceMode ? "Maintenance" : "Online",
      welcomeQuote: personality.shortDescription,
      defaultGreeting: resolvedGreeting,
      systemPrompt: personality.additionalInstructions,
      model: ai.selectedModel,
      maxTokens: ai.maxOutputTokens,
      announcementBanner: resolvedBanner,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Strip server-only nvidiaApiKey before writing the model document to Firestore
    const { nvidiaApiKey: _omittedSecret, ...safeAiDoc } = ai;
    void _omittedSecret;

    const batch = admin.firestore.batch();
    const configCollection = admin.firestore.collection("app_config");

    batch.set(configCollection.doc("ai"), flatDoc, { merge: true });
    batch.set(
      configCollection.doc("personality"),
      { ...personality, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    batch.set(
      configCollection.doc("model"),
      { ...safeAiDoc, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    batch.set(
      configCollection.doc("customization"),
      { ...customization, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    batch.set(
      configCollection.doc("general"),
      { ...general, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    await batch.commit();
    return { attempted: true, success: true };
  } catch (error) {
    console.error("[sync-firestore] publish failed:", error);
    return {
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : "Unknown Firestore error",
    };
  }
}
