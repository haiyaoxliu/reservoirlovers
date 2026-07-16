import { desc, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/index";
import { invites, users } from "@/db/schema";
import { env } from "@/lib/env";
import { getSession, isFreshPasskey } from "@/lib/session";
import { deleteCredential, listCredentials } from "@/lib/passkey";
import { MAX_SLOTS, countCommittedSlots, createInvite, releaseInvite } from "@/lib/invite";
import { reconcileAll, reconcileOne, type ReconcileResult } from "@/worker/reconcile";
import { RateLimitError, deauthorize } from "@/strava/client";
import { getValidAccessToken } from "@/strava/tokens";
import { ExternalLinkIcon } from "../ExternalLinkIcon";
import { CopyButton } from "../CopyButton";
import { AdminTools } from "./AdminTools";
import { NewInvite } from "./NewInvite";
import { PasskeyGate } from "./PasskeyGate";
import { PasskeyEnroll } from "./PasskeyEnroll";
import { PasskeyList } from "./PasskeyList";

export const dynamic = "force-dynamic";
// Server actions on this page (refresh/backfill) call the Strava API in a
// loop; give them the full function window.
export const maxDuration = 60;

async function requireAdmin() {
  const session = await getSession();
  if (!session.athleteId) redirect("/login");
  const user = await db.query.users.findFirst({
    where: eq(users.stravaAthleteId, session.athleteId),
  });
  if (!user || user.isAdmin !== 1) redirect("/");
  return user;
}

/** Server-action guard: Strava-admin AND a recent passkey verification. The UI
 *  only surfaces these actions once verified, so a failure here means a direct
 *  POST without a fresh passkey — reject it. */
async function requireVerifiedAdmin() {
  const user = await requireAdmin();
  const session = await getSession();
  if (!isFreshPasskey(session)) {
    throw new Error("Admin passkey verification required.");
  }
  return user;
}

async function createInviteAction(): Promise<string | null> {
  "use server";
  const admin = await requireVerifiedAdmin();
  const code = await createInvite(admin.id);
  if (!code) {
    return `At the ${MAX_SLOTS}-athlete cap — remove a member or use an open invite before creating another.`;
  }
  revalidatePath("/admin");
  return null;
}

function summarize(r: ReconcileResult, withProfiles: boolean): string {
  const parts = [
    `${r.usersScanned} member${r.usersScanned === 1 ? "" : "s"}`,
    ...(withProfiles ? [`${r.profilesRefreshed} profiles refreshed`] : []),
    `${r.activitiesSeen} activities seen`,
    `${r.processed} (re)processed`,
  ];
  const followUp = r.rateLimited
    ? " — Strava rate limit hit, run again in ~15 min to continue."
    : r.outOfTime
      ? " — out of time for one run, click again to continue."
      : ".";
  return parts.join(", ") + followUp;
}

/** Leave ~15s of the 60s function limit for token refreshes, the in-flight
 *  activity, and response serialization — Vercel killing the action mid-run
 *  loses the summary and surfaces as a raw error in the browser. */
const actionDeadline = () => Date.now() + 45_000;

async function refreshAllAction(): Promise<string> {
  "use server";
  await requireVerifiedAdmin();
  try {
    const result = await reconcileAll({
      refreshProfiles: true,
      maxPages: 3,
      after: Math.floor(Date.now() / 1000) - 30 * 24 * 3600,
      deadlineMs: actionDeadline(),
    });
    return summarize(result, true);
  } catch (err) {
    console.error("admin refresh-all failed", err);
    return "Refresh failed — check the server logs.";
  }
}

async function backfillAllAction(): Promise<string> {
  "use server";
  await requireVerifiedAdmin();
  try {
    const result = await reconcileAll({ maxPages: 100, deadlineMs: actionDeadline() });
    return summarize(result, false);
  } catch (err) {
    console.error("admin backfill failed", err);
    return "Backfill failed — check the server logs.";
  }
}

async function backfillUserAction(athleteId: number): Promise<string> {
  "use server";
  await requireVerifiedAdmin();
  const user = await db.query.users.findFirst({
    where: eq(users.stravaAthleteId, athleteId),
  });
  if (!user || user.deauthorizedAt || !user.accessToken || !user.refreshToken) {
    return "That member has no connected Strava account.";
  }
  try {
    const result = await reconcileOne(user, { maxPages: 100, deadlineMs: actionDeadline() });
    return summarize(result, false);
  } catch (err) {
    // Unlike reconcileAll, the single-user variant propagates rate limits.
    if (err instanceof RateLimitError) {
      return "Strava rate limit hit — run again in ~15 min to continue.";
    }
    console.error(`admin backfill failed for athlete ${athleteId}`, err);
    return "Backfill failed — check the server logs.";
  }
}

/** Disconnect a member: revoke on Strava (freeing a slot against the
 *  10-athlete cap), drop the stored tokens, mark them deauthorized, and free
 *  the invite they redeemed so it can be handed to someone new. Their
 *  activities and loop history stay put — the leaderboard greys the row and
 *  shows the disconnect date. */
async function removeMemberAction(athleteId: number): Promise<string> {
  "use server";
  await requireVerifiedAdmin();
  const user = await db.query.users.findFirst({
    where: eq(users.stravaAthleteId, athleteId),
  });
  if (!user || user.deauthorizedAt) {
    return "That member is already disconnected.";
  }
  // Best-effort revoke on Strava's side — that's what actually frees the slot.
  // A dead token (already revoked) throws here; the slot is free either way,
  // so we still mark the member disconnected but flag the uncertainty.
  let revokeConfirmed = true;
  if (user.accessToken && user.refreshToken) {
    try {
      await deauthorize(await getValidAccessToken(user));
    } catch (err) {
      console.error(`admin remove: Strava revoke failed for athlete ${athleteId}`, err);
      revokeConfirmed = false;
    }
  }
  await db
    .update(users)
    .set({
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      deauthorizedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  // Reopen the invite they used so it can be reshared for the freed slot.
  await releaseInvite(athleteId);
  revalidatePath("/admin");
  revalidatePath("/");
  return revokeConfirmed
    ? `${user.displayName} disconnected — a Strava slot is freed, their invite reopens, and their history stays on the board.`
    : `${user.displayName} marked disconnected and their invite reopened, but Strava didn't confirm the revoke. If the slot isn't freed, they may need to remove the app from their Strava settings.`;
}

/** Remove one of the admin's own passkeys. Refuses to delete the last one —
 *  that would silently drop /admin back to Strava-only bootstrap enrollment, so
 *  we make the admin register a replacement first. */
async function removePasskeyAction(id: number): Promise<string> {
  "use server";
  const admin = await requireVerifiedAdmin();
  const creds = await listCredentials(admin.id);
  if (creds.length <= 1) {
    return "That's your only passkey — add another before removing it, or you'll be back to first-time setup.";
  }
  const target = creds.find((c) => c.id === id);
  const removed = await deleteCredential(admin.id, id);
  if (removed === 0) {
    return "That passkey was already removed.";
  }
  revalidatePath("/admin");
  return `Removed “${target?.label ?? "Passkey"}”.`;
}

export default async function AdminPage() {
  const admin = await requireAdmin();

  // Passkey second factor. No passkey yet → bootstrap enrollment (Strava-admin
  // session is the trust anchor). Passkey exists but not recently verified →
  // gate; no admin data is fetched or sent to the browser until it passes.
  const credentials = await listCredentials(admin.id);
  const session = await getSession();
  if (credentials.length === 0) {
    return <PasskeyEnroll bootstrap />;
  }
  if (!isFreshPasskey(session)) {
    return <PasskeyGate />;
  }

  const members = await db
    .select({ athleteId: users.stravaAthleteId, name: users.displayName })
    .from(users)
    .where(isNull(users.deauthorizedAt))
    .orderBy(users.displayName);
  const committedSlots = await countCommittedSlots();
  // Attach the Strava account that redeemed each invite.
  const rows = await db
    .select({
      code: invites.code,
      usedByAthleteId: invites.usedByAthleteId,
      usedByName: users.displayName,
    })
    .from(invites)
    .leftJoin(users, eq(users.stravaAthleteId, invites.usedByAthleteId))
    .orderBy(desc(invites.createdAt))
    .limit(50);
  // Members who connected without redeeming an invite (e.g. the admin who set
  // the app up). They still occupy a Strava slot, so surface them alongside the
  // invite links — otherwise the list undercounts the real committed total.
  const redeemed = new Set(rows.filter((r) => r.usedByAthleteId).map((r) => r.usedByAthleteId));
  const directSlots = members.filter((m) => !redeemed.has(m.athleteId));

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

      <h1 style={{ fontSize: 22, margin: "8px 0 20px" }}>Maintenance</h1>
      <AdminTools
        refreshAll={refreshAllAction}
        backfillAll={backfillAllAction}
        backfillUser={backfillUserAction}
        removeMember={removeMemberAction}
        members={members}
      />

      <h1 style={{ fontSize: 22, margin: "8px 0 20px" }}>Invites</h1>

      <NewInvite
        committedSlots={committedSlots}
        maxSlots={MAX_SLOTS}
        create={createInviteAction}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {directSlots.map((m) => (
          <div
            key={`direct-${m.athleteId}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 12px",
              opacity: 0.6,
            }}
          >
            <span
              style={{
                fontSize: 13,
                flex: 1,
                minWidth: 0,
                color: "var(--muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Connected directly — no invite link
            </span>
            <a
              href={`https://www.strava.com/athletes/${m.athleteId}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                color: "var(--text)",
                fontSize: 13,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {m.name}
              <ExternalLinkIcon size={11} />
            </a>
            <span style={{ fontSize: 12, color: "#ff6b6b", flexShrink: 0 }}>used</span>
          </div>
        ))}
        {rows.map((inv) => {
          const url = `${env.siteUrl}/invite/${inv.code}`;
          const used = Boolean(inv.usedByAthleteId);
          return (
            <div
              key={inv.code}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
                opacity: used ? 0.6 : 1,
              }}
            >
              {/* Truncates on narrow screens; the copy button carries the
                  full link */}
              <code
                style={{
                  fontSize: 13,
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {url}
              </code>
              {used ? (
                <a
                  href={`https://www.strava.com/athletes/${inv.usedByAthleteId}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    color: "var(--text)",
                    fontSize: 13,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {inv.usedByName ?? `Athlete ${inv.usedByAthleteId}`}
                  <ExternalLinkIcon size={11} />
                </a>
              ) : (
                <CopyButton text={url} />
              )}
              <span
                style={{
                  fontSize: 12,
                  color: used ? "#ff6b6b" : "var(--gold)",
                  flexShrink: 0,
                }}
              >
                {used ? "used" : "open"}
              </span>
            </div>
          );
        })}
        {rows.length === 0 && directSlots.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No invites yet.</p>
        ) : null}
      </div>

      <h1 style={{ fontSize: 22, margin: "32px 0 8px" }}>Passkeys</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 16px" }}>
        Required to open this page. Register a spare on another device so a lost
        one doesn&apos;t lock you out.
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
