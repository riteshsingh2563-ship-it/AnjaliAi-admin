import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedAdmin, UnauthorizedError } from "@/lib/admin-auth";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { recordAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS, ALLOWED_IMAGE_TYPES, MAX_AVATAR_UPLOAD_BYTES } from "@/lib/constants";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = await requireAuthorizedAdmin();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fbAdmin = getFirebaseAdmin();
  if (!fbAdmin) {
    return NextResponse.json(
      {
        error:
          "Firebase Storage is not configured for this deployment. Paste a direct image URL instead, or configure FIREBASE_SERVICE_ACCOUNT_KEY and NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET to enable uploads.",
      },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type "${file.type}". Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Maximum size is ${MAX_AVATAR_UPLOAD_BYTES / 1024 / 1024}MB.` },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.type.split("/")[1] ?? "png";
    const path = `app_config/avatars/${randomUUID()}.${extension}`;
    const bucket = fbAdmin.storage.bucket();
    const storageFile = bucket.file(path);

    await storageFile.save(buffer, {
      contentType: file.type,
      metadata: { cacheControl: "public, max-age=31536000" },
    });
    await storageFile.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;

    await recordAuditLog({
      adminEmail: admin.email,
      actionType: AUDIT_ACTIONS.AVATAR_UPLOAD,
      metadata: { path, size: file.size, contentType: file.type },
      result: "success",
    });

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("[avatar upload]", error);
    await recordAuditLog({
      adminEmail: admin.email,
      actionType: AUDIT_ACTIONS.AVATAR_UPLOAD,
      metadata: { error: String(error) },
      result: "failure",
    });
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
