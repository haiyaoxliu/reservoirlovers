import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/index";
import { invites, users } from "@/db/schema";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { createInvite } from "@/lib/invite";
import { ExternalLinkIcon } from "../ExternalLinkIcon";
import { CopyButton } from "../CopyButton";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session.athleteId) redirect("/login");
  const user = await db.query.users.findFirst({
    where: eq(users.stravaAthleteId, session.athleteId),
  });
  if (!user || user.isAdmin !== 1) redirect("/");
  return user;
}

async function createInviteAction() {
  "use server";
  const admin = await requireAdmin();
  await createInvite(admin.id);
  revalidatePath("/admin");
}

export default async function AdminPage() {
  await requireAdmin();
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

  return (
    <div className="container">
      <h1 style={{ fontSize: 22, margin: "8px 0 20px" }}>Invites</h1>

      <form action={createInviteAction} style={{ marginBottom: 24 }}>
        <button
          type="submit"
          style={{
            background: "var(--accent)",
            color: "#04121f",
            fontWeight: 600,
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            cursor: "pointer",
          }}
        >
          New invite
        </button>
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
        {rows.length === 0 ? <p style={{ color: "var(--muted)" }}>No invites yet.</p> : null}
      </div>
    </div>
  );
}
