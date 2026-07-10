import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/index";
import { invites, users } from "@/db/schema";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { createInvite } from "@/lib/invite";

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

async function createInviteAction(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const note = (formData.get("note") as string | null)?.slice(0, 80) || undefined;
  await createInvite(admin.id, note);
  revalidatePath("/admin");
}

export default async function AdminPage() {
  await requireAdmin();
  const rows = await db.select().from(invites).orderBy(desc(invites.createdAt)).limit(50);

  return (
    <div className="container">
      <h1 style={{ fontSize: 22, margin: "8px 0 20px" }}>Invites</h1>

      <form action={createInviteAction} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          name="note"
          placeholder="Who's this for? (optional, shown on their invite page)"
          style={{
            flex: 1,
            background: "var(--panel)",
            border: "1px solid #232a36",
            borderRadius: 8,
            color: "var(--text)",
            padding: "8px 12px",
          }}
        />
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
                gap: 12,
                background: "var(--panel)",
                border: "1px solid #232a36",
                borderRadius: 8,
                padding: "10px 14px",
                opacity: used ? 0.5 : 1,
              }}
            >
              <code style={{ fontSize: 14 }}>{url}</code>
              <span style={{ flex: 1 }} />
              {inv.note ? <span style={{ color: "var(--muted)", fontSize: 13 }}>{inv.note}</span> : null}
              <span style={{ fontSize: 12, color: used ? "#ff6b6b" : "var(--gold)" }}>
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
