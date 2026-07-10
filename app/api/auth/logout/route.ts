import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL("/login", env.siteUrl), { status: 303 });
}
