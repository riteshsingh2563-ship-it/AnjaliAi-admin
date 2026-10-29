import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
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
 * Publishes the current configuration to Cloud Firestore so the Android app
 * can read it (directly, via Firestore real-time listeners on `app_config/ai`)
 * without requiring a new APK release.
 *
 * Writes:
 *  - app_config/ai           -> unified flat document compatible with both the
 *                               dashboard schema and the Android app's
 *                               `BackendAppConfig.fromMap()`.
 *  - app_config/personality  -> full personality configuration object.
 *  - app_config/model        -> full AI/model configuration object.
 *  - app_config/customization-> full app customization object.
 *  - app_config/general      -> full general settings object.
 *
 * No-ops (and reports `attempted: false`) when Firebase Admin credentials
 * are not configured for this deployment.
 */
export async function publishConfigToFirestore(data: {
  personality: PersonalityRow;
  ai: AiConfigRow;
  customization: CustomizationRow;
  general: GeneralSettingsRow;
}): Promise<PublishResult> {
  const admin = getFirebaseAdmin();
  if (!admin) {
    return { attempted: false, success: false, error: "Firebase Admin SDK is not configured." };
  }

  try {
    const { personality, ai, customization, general } = data;

    const configurationVersion =
      personality.version + ai.version + customization.version + general.version;

    const resolvedName =
      personality.characterName.trim() || customization.displayName.trim() || "Anjali";
    const resolvedGreeting =
      personality.greetingMessage.trim() ||
      customization.welcomeMessage.trim() ||
      "Heyy! 😄\nKaise ho? Aaj ka din kaisa raha?";
    const resolvedBanner =
      customization.bannerEnabled && customization.bannerText.trim().length > 0
        ? customization.bannerText.trim()
        : "";

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
      { ...ai, updatedAt: FieldValue.serverTimestamp() },
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
