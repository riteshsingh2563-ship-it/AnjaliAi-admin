import { NextResponse } from "next/server";
import {
  getPersonalityConfig,
  getAiConfig,
  getCustomization,
  getGeneralSettings,
} from "@/lib/config-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, read-only fallback for the published app configuration. Contains
// no secrets and no personal data — it mirrors the same non-sensitive
// configuration document published to Firestore (app_config/ai).
export async function GET() {
  try {
    const [personality, ai, customization, general] = await Promise.all([
      getPersonalityConfig(),
      getAiConfig(),
      getCustomization(),
      getGeneralSettings(),
    ]);

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
    const configurationVersion =
      personality.version + ai.version + customization.version + general.version;

    return NextResponse.json({
      characterName: resolvedName,
      displayName: customization.displayName || resolvedName,
      appName: general.appDisplayName,
      shortDescription: personality.shortDescription,
      personalityTraits: personality.personalityTraits,
      conversationTone: personality.conversationTone,
      greetingMessage: resolvedGreeting,
      welcomeMessage: customization.welcomeMessage || resolvedGreeting,
      personalityInstructions: personality.additionalInstructions,
      defaultLanguage: general.defaultLanguage,
      supportedLanguages: ai.supportedLanguages,
      responseStyle: ai.responseStyle || personality.responseStyle,
      responseLength: personality.responseLength,
      emojiEnabled: personality.emojiUsage,
      friendlySupportive: personality.friendlySupportive,
      maximumResponseLength: ai.maxOutputTokens,
      provider: ai.provider,
      apiEndpoint: ai.apiEndpoint,
      backendUrl: ai.backendUrl,
      selectedModel: ai.selectedModel,
      temperature: ai.temperature,
      aiEnabled: ai.aiEnabled,
      voiceRepliesEnabled: ai.voiceRepliesEnabled,
      proactiveMessagesEnabled: ai.proactiveMessagesEnabled,
      fallbackBehavior: ai.fallbackBehavior,
      fallbackMessage: ai.fallbackMessage,
      maintenanceMode: general.maintenanceMode,
      maintenanceMessage: general.maintenanceMessage,
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
      configurationVersion,
      // Android aliases
      companionName: resolvedName,
      companionTagline: "Your Bestie",
      onlineStatusText: general.maintenanceMode ? "Maintenance" : "Online",
      welcomeQuote: personality.shortDescription,
      defaultGreeting: resolvedGreeting,
      systemPrompt: personality.additionalInstructions,
      model: ai.selectedModel,
      maxTokens: ai.maxOutputTokens,
      announcementBanner: resolvedBanner,
    });
  } catch (error) {
    console.error("[public/app-config]", error);
    return NextResponse.json(
      { error: "Configuration is temporarily unavailable." },
      { status: 503 },
    );
  }
}
