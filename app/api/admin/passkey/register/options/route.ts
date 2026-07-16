import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { env } from "@/lib/env";
import { getSession, isFreshPasskey } from "@/lib/session";
import { credentialTransports, getAdminUser, listCredentials } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const creds = await listCredentials(admin.id);
  const session = await getSession();
  // First passkey bootstraps from the Strava-admin session alone. Adding a
  // further one requires an already-verified session, so a stolen cookie can't
  // silently enroll its own authenticator.
  if (creds.length > 0 && !isFreshPasskey(session)) {
    return NextResponse.json({ error: "verification required" }, { status: 403 });
  }

  const options = await generateRegistrationOptions({
    rpName: env.rpName,
    rpID: env.rpId,
    userName: admin.displayName,
    userID: new TextEncoder().encode(String(admin.id)),
    attestationType: "none",
    excludeCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: credentialTransports(c),
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });

  session.webauthnChallenge = options.challenge;
  await session.save();
  return NextResponse.json(options);
}
