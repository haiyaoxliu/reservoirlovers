import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession, viewerKeyFor } from "@/lib/session";

export const runtime = "nodejs";

function fail(reason: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, env.siteUrl), 303);
}

/** Log in to the view-only tier with the shared viewer password. */
export async function POST(req: NextRequest) {
  const expected = env.viewerPassword;
  if (!expected) return fail("Viewer access is not enabled");

  const form = await req.formData();
  const given = String(form.get("password") ?? "");

  // Compare digests so length differences leak nothing.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) return fail("Wrong password");

  const session = await getSession();
  session.viewer = true;
  session.viewerKey = viewerKeyFor(expected);
  await session.save();
  return NextResponse.redirect(new URL("/", env.siteUrl), 303);
}
