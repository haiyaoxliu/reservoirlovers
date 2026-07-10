import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { users, webhookEvents } from "@/db/schema";
import { env } from "@/lib/env";
import { processActivity } from "@/worker/process-activity";

export const runtime = "nodejs";

/** Strava subscription validation handshake. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.stravaWebhookVerifyToken && challenge) {
    return NextResponse.json({ "hub.challenge": challenge });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

interface WebhookPayload {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  event_time: number;
  updates?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as WebhookPayload;

  // Deduplicate: unique(object_id, aspect_type, event_time). Duplicate
  // deliveries no-op. We ACK immediately and process in the background.
  const inserted = await db
    .insert(webhookEvents)
    .values({
      objectId: payload.object_id,
      objectType: payload.object_type,
      aspectType: payload.aspect_type,
      ownerId: payload.owner_id,
      eventTime: payload.event_time,
      payload: payload as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing({
      target: [webhookEvents.objectId, webhookEvents.aspectType, webhookEvents.eventTime],
    })
    .returning({ id: webhookEvents.id });

  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  const rowId = inserted[0].id;

  waitUntil(handleEvent(payload, rowId));
  return NextResponse.json({ ok: true });
}

async function handleEvent(payload: WebhookPayload, rowId: number): Promise<void> {
  try {
    if (payload.object_type === "athlete" && payload.updates?.authorized === "false") {
      // Deauthorization: drop tokens, keep history.
      await db
        .update(users)
        .set({ accessToken: null, refreshToken: null, tokenExpiresAt: null, deauthorizedAt: new Date() })
        .where(eq(users.stravaAthleteId, payload.owner_id));
    } else if (payload.object_type === "activity") {
      await processActivity(payload.object_id, payload.owner_id, payload.aspect_type);
    }
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(webhookEvents.id, rowId));
  } catch (err) {
    // Leave processedAt null so the reconciliation cron can retry.
    console.error("webhook processing failed", err);
  }
}
