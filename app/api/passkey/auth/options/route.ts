import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { credentialTransports, getSessionUser, listCredentials } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const creds = await listCredentials(user.id);
  if (creds.length === 0) {
    return NextResponse.json({ error: "no passkey enrolled" }, { status: 400 });
  }

  const options = await generateAuthenticationOptions({
    rpID: env.rpId,
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: credentialTransports(c),
    })),
    userVerification: "required",
  });

  const session = await getSession();
  session.webauthnChallenge = options.challenge;
  await session.save();
  return NextResponse.json(options);
}
