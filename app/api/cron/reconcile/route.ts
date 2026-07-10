import { NextRequest, NextResponse } from "next/server";
import { reconcileAll, retryErrored } from "@/worker/reconcile";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily reconciliation (Vercel Cron). Catches missed webhooks over the last few
 * days and retries errored activities. Protected by CRON_SECRET — Vercel Cron
 * sends `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const since = Math.floor(Date.now() / 1000) - 3 * 24 * 3600; // last 3 days
  const result = await reconcileAll({ after: since, maxPages: 2 });
  const retried = await retryErrored();

  return NextResponse.json({ ...result, retried });
}
