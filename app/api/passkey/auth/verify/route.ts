import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import {
  credentialTransports,
  getSessionUser,
  listCredentials,
  touchCredential,
} from "@/lib/passkey";

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
  const creds = await listCredentials(user.id);
  const row = creds.find((c) => c.credentialId === body.response?.id);
  if (!row) {
    return NextResponse.json({ error: "unknown credential" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: env.rpOrigins,
      expectedRPID: env.rpId,
      requireUserVerification: true,
      credential: {
        id: row.credentialId,
        publicKey: isoBase64URL.toBuffer(row.publicKey),
        counter: Number(row.counter),
        transports: credentialTransports(row),
      },
    });
  } catch (err) {
    console.error("passkey auth verify failed", err);
    return NextResponse.json({ error: "verification failed" }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "not verified" }, { status: 400 });
  }

  await touchCredential(row.credentialId, verification.authenticationInfo.newCounter);
  session.webauthnChallenge = undefined;
  session.passkeyAt = Date.now();
  await session.save();
  return NextResponse.json({ ok: true });
}
