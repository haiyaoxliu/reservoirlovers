/**
 * Rotate (or create) SESSION_SECRET. Rotating invalidates every session cookie
 * — all members re-connect via Strava, all visitors need a fresh viewer invite.
 * Run it whenever you want to evict everyone, e.g. after dropping a legacy
 * access tier.
 *
 *   npm run secret:rotate
 *
 * Writes the new secret to .env.local (creating the entry if missing). If the
 * Vercel CLI is installed and this repo is linked, also updates the production
 * env var (a redeploy is still needed to pick it up); otherwise prints the
 * secret to paste into the Vercel dashboard.
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV_FILE = ".env.local";
const secret = randomBytes(48).toString("base64");

// --- .env.local: replace the existing line or append one. ---
let contents = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
if (/^SESSION_SECRET=/m.test(contents)) {
  contents = contents.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`);
  console.log(`Rotated SESSION_SECRET in ${ENV_FILE}.`);
} else {
  contents += `${contents.endsWith("\n") || contents === "" ? "" : "\n"}SESSION_SECRET=${secret}\n`;
  console.log(`Created SESSION_SECRET in ${ENV_FILE}.`);
}
writeFileSync(ENV_FILE, contents);

// --- Vercel production env, when the CLI is set up; manual otherwise. ---
function hasVercel(): boolean {
  try {
    execFileSync("vercel", ["--version"], { stdio: "ignore" });
    return existsSync(".vercel/project.json");
  } catch {
    return false;
  }
}

if (hasVercel()) {
  // `env rm` fails if the var doesn't exist yet — that's fine, add still runs.
  try {
    execFileSync("vercel", ["env", "rm", "SESSION_SECRET", "production", "--yes"], {
      stdio: "ignore",
    });
  } catch {}
  execFileSync("vercel", ["env", "add", "SESSION_SECRET", "production"], {
    input: secret,
    stdio: ["pipe", "inherit", "inherit"],
  });
  console.log("Updated SESSION_SECRET on Vercel (production). Redeploy to apply.");
} else {
  // Deliberately not echoing the secret — copy it out of .env.local instead of
  // leaving it in terminal scrollback.
  console.log("\nVercel CLI not set up — update production by hand:");
  console.log("  Vercel dashboard → Project → Settings → Environment Variables");
  console.log(`  Set SESSION_SECRET (production) to the new value in ${ENV_FILE}.`);
  console.log("Then redeploy. Until then, prod keeps the old secret.");
}
process.exit(0);
