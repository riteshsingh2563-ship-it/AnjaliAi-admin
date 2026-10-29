import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureDatabaseSchema } from "@/db/init";
import { adminAllowlist } from "@/db/schema";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";
import {
  isFirebaseAdminConfigured,
  isAdminSessionSecretConfigured,
  isUsageIngestConfigured,
  env,
} from "@/lib/env";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import {
  getAiConfig,
  getCustomization,
  getGeneralSettings,
  getPersonalityConfig,
  resolveServerNvidiaApiKey,
} from "@/lib/config-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuthorizedAdmin();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let databaseOk = false;
  let adminCount = 0;
  try {
    await ensureDatabaseSchema();
    await db.execute(sql`select 1`);
    databaseOk = true;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminAllowlist)
      .where(eq(adminAllowlist.active, true));
    adminCount = count;
  } catch (error) {
    console.error("[integration/status] database check failed:", error);
    databaseOk = false;
  }

  let firestoreReachable: boolean | null = null;
  const admin = getFirebaseAdmin();
  if (admin) {
    try {
      await admin.firestore.collection("app_config").limit(1).get();
      firestoreReachable = true;
    } catch {
      firestoreReachable = false;
    }
  }

  let publishState = null;
  let nvidiaConfigured = Boolean(env.NVIDIA_API_KEY);
  let nvidiaEndpoint = env.NVIDIA_API_ENDPOINT;
  let nvidiaModel = env.NVIDIA_MODEL;

  if (databaseOk) {
    try {
      const [personality, ai, customization, general] = await Promise.all([
        getPersonalityConfig(),
        getAiConfig(),
        getCustomization(),
        getGeneralSettings(),
      ]);
      const resolvedKey = await resolveServerNvidiaApiKey(ai);
      nvidiaConfigured = Boolean(resolvedKey.key);
      nvidiaEndpoint = ai.apiEndpoint;
      nvidiaModel = ai.selectedModel;

      publishState = {
        personality: {
          version: personality.version,
          publishedToFirestore: personality.publishedToFirestore,
          publishedAt: personality.publishedAt,
        },
        ai: {
          version: ai.version,
          publishedToFirestore: ai.publishedToFirestore,
          publishedAt: ai.publishedAt,
        },
        customization: {
          version: customization.version,
          publishedToFirestore: customization.publishedToFirestore,
          publishedAt: customization.publishedAt,
        },
        general: {
          version: general.version,
          publishedToFirestore: general.publishedToFirestore,
          publishedAt: general.publishedAt,
        },
      };
    } catch {
      publishState = null;
    }
  }

  return NextResponse.json({
    database: { configured: Boolean(env.DATABASE_URL), ok: databaseOk },
    adminSession: { configured: isAdminSessionSecretConfigured },
    adminAllowlist: { activeAdmins: adminCount },
    firebaseClient: {
      configured: Boolean(
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
          process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
          process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      ),
      projectId: env.FIREBASE_PROJECT_ID ?? null,
    },
    firebaseAdmin: {
      configured: isFirebaseAdminConfigured,
      firestoreReachable,
      databaseId: env.FIREBASE_DATABASE_ID,
      sharedDocumentPath: "app_config/ai",
    },
    nvidiaAi: {
      configured: nvidiaConfigured,
      endpoint: nvidiaEndpoint,
      model: nvidiaModel,
    },
    storage: {
      configured:
        isFirebaseAdminConfigured && Boolean(env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    },
    usageIngest: { configured: isUsageIngestConfigured },
    publishState,
  });
}
