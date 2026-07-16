import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { consumeVisitorInvite } from "@/lib/invite";

export const runtime = "nodejs";

function fail(reason: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(reason)}`, env.siteUrl),
    303,
  );
}

/** Redeem a one-time visitor invite into a view-only session. The code arrives
 *  from the invite landing page's form; consuming it is atomic, so a second
 *  click (or a shared link) is rejected. */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const code = String(form.get("code") ?? "");
  if (!code || !(await consumeVisitorInvite(code))) {
    return fail("This viewing link is invalid or has already been used");
  }
  const session = await getSession();
  session.viewer = true;
  await session.save();
  return NextResponse.redirect(new URL("/", env.siteUrl), 303);
}
