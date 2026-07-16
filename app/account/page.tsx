import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/index";
import { users } from "@/db/schema";
import { getSession, isFreshPasskey } from "@/lib/session";
import { deleteCredential, getSessionUser, listCredentials } from "@/lib/passkey";
import { reconcileOne, type ReconcileResult } from "@/worker/reconcile";
import { RateLimitError } from "@/strava/client";
import { PasskeyEnroll } from "../PasskeyEnroll";
import { PasskeyGate } from "../PasskeyGate";
import { PasskeyList } from "../PasskeyList";
import { SelfBackfill } from "./SelfBackfill";

export const dynamic = "force-dynamic";
// Self-backfill calls the Strava API in a loop; give it the full window.
export const maxDuration = 60;

const BACKFILL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** A live connected member for the current session, else bounce to login. */
async function requireMember() {
  const user = await getSessionUser();
  if (!user || user.deauthorizedAt) redirect("/login");
  return user;
}

/** Member session AND a recent passkey verification. The UI only surfaces these
 *  actions once verified, so a failure here means a direct POST without a fresh
 *  passkey — reject it. Satisfies "manage passkeys only behind both factors." */
async function requireVerifiedMember() {
  const user = await requireMember();
  const session = await getSession();
  if (!isFreshPasskey(session)) {
    throw new Error("Passkey verification required.");
  }
  return user;
}

/** Remove one of the member's own passkeys. Refuses the last one — that would
 *  drop them back to first-time setup and re-lock the board. */
async function removePasskeyAction(id: number): Promise<string> {
  "use server";
  const user = await requireVerifiedMember();
  const creds = await listCredentials(user.id);
  if (creds.length <= 1) {
    return "That's your only passkey — add another before removing it, or you'll be back to first-time setup.";
  }
  const target = creds.find((c) => c.id === id);
  const removed = await deleteCredential(user.id, id);
  if (removed === 0) {
    return "That passkey was already removed.";
  }
  revalidatePath("/account");
  return `Removed “${target?.label ?? "Passkey"}”.`;
}

function summarize(r: ReconcileResult): string {
  const parts = [
    `${r.activitiesSeen} activities seen`,
    `${r.processed} (re)processed`,
  ];
  const followUp = r.rateLimited
    ? " — Strava rate limit hit, try again in ~15 min."
    : r.outOfTime
      ? " — out of time for one run; run again tomorrow to continue."
      : ".";
  return parts.join(", ") + followUp;
}

/** Once-a-day full-history reconcile of the member's own runs. The cooldown is
 *  enforced here (source of truth); the button also disables client-side. */
async function selfBackfillAction(): Promise<string> {
  "use server";
  const user = await requireVerifiedMember();
  const last = user.lastBackfillAt ? user.lastBackfillAt.getTime() : 0;
  if (Date.now() - last < BACKFILL_COOLDOWN_MS) {
    const hours = Math.ceil((last + BACKFILL_COOLDOWN_MS - Date.now()) / (60 * 60 * 1000));
    return `Already backfilled today — try again in ~${hours}h.`;
  }
  if (!user.accessToken || !user.refreshToken) {
    return "Your Strava connection is missing — reconnect from the leaderboard.";
  }
  // Stamp the timestamp up front so a slow/looping run can't be spammed by
  // repeated clicks racing the cooldown check.
  await db.update(users).set({ lastBackfillAt: new Date() }).where(eq(users.id, user.id));
  try {
    const result = await reconcileOne(user, {
      maxPages: 100,
      // Leave ~15s of the 60s limit for token refreshes and serialization.
      deadlineMs: Date.now() + 45_000,
    });
    revalidatePath("/");
    return summarize(result);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return "Strava rate limit hit — try again in ~15 min.";
    }
    console.error(`self-backfill failed for user ${user.id}`, err);
    return "Backfill failed — try again later.";
  }
}

export default async function AccountPage() {
  const user = await requireMember();

  // Same three-state passkey pattern as /admin: no passkey → bootstrap enroll;
  // passkey but not fresh → verify; fresh → management.
  const credentials = await listCredentials(user.id);
  const session = await getSession();
  if (credentials.length === 0) {
    return (
      <PasskeyEnroll
        bootstrap
        title="Protect your account"
        description="Register a passkey (Touch ID, Face ID, or a security key) to unlock the full board and manage your account. You'll confirm it on each visit."
      />
    );
  }
  if (!isFreshPasskey(session)) {
    return (
      <PasskeyGate
        title="Account verification"
        description="Confirm it's you with your passkey to manage your account."
      />
    );
  }

  return (
    <div className="container">
      <a
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          margin: "8px 0 16px",
          padding: "6px 12px",
          fontSize: 13,
          color: "var(--muted)",
          border: "1px solid var(--border-btn)",
          borderRadius: 8,
          textDecoration: "none",
        }}
      >
        ← Leaderboard
      </a>

      <h1 style={{ fontSize: 22, margin: "8px 0 20px" }}>Account</h1>

      <h2 style={{ fontSize: 16, margin: "8px 0 12px" }}>Maintenance</h2>
      <div style={{ marginBottom: 28 }}>
        <SelfBackfill
          lastBackfillAt={user.lastBackfillAt?.toISOString() ?? null}
          run={selfBackfillAction}
        />
      </div>

      <h2 style={{ fontSize: 16, margin: "8px 0 8px" }}>Passkeys</h2>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>
        Required to open the full board and this page. Register a spare on another
        device so a lost one doesn&apos;t lock you out.
      </p>
      <PasskeyList
        passkeys={credentials.map((c) => ({
          id: c.id,
          label: c.label ?? "Passkey",
          meta: c.lastUsedAt
            ? `last used ${c.lastUsedAt.toISOString().slice(0, 10)}`
            : `added ${c.createdAt.toISOString().slice(0, 10)}`,
        }))}
        removePasskey={removePasskeyAction}
      />
      <PasskeyEnroll />
    </div>
  );
}
