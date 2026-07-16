import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { getSessionUser, saveCredential } from "@/lib/passkey";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const session = await getSession();
  const expectedChallenge = session.webauthnChallenge;
  if (!expectedChallenge) {
    return NextResponse.json({ error: "no challenge in progress" }, { status: 400 });
  }

  const body = await req.json();
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: env.rpOrigins,
      expectedRPID: env.rpId,
      requireUserVerification: true,
    });
  } catch (err) {
    console.error("passkey register verify failed", err);
    return NextResponse.json({ error: "verification failed" }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "not verified" }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  const label =
    typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : null;
  await saveCredential({
    userId: user.id,
    credentialId: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports,
    label,
  });

  // Registration proves possession — count it as a fresh verification so the
  // member isn't immediately asked to authenticate right after enrolling.
  session.webauthnChallenge = undefined;
  session.passkeyAt = Date.now();
  await session.save();
  return NextResponse.json({ ok: true });
}
