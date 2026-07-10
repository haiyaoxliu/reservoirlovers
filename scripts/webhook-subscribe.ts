/**
 * Manage the single Strava push-subscription for this app.
 *   npm run webhook:subscribe            # create (uses SITE_URL/api/strava/webhook)
 *   npm run webhook:subscribe -- list    # view current subscription
 *   npm run webhook:subscribe -- delete <id>
 *
 * Strava calls the callback with a GET validation handshake immediately, so the
 * app must already be deployed and reachable at SITE_URL before subscribing.
 */
export {};

const clientId = process.env.STRAVA_CLIENT_ID;
const clientSecret = process.env.STRAVA_CLIENT_SECRET;
const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
const siteUrl = process.env.SITE_URL;
if (!clientId || !clientSecret || !verifyToken) {
  throw new Error("Set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN");
}

const BASE = "https://www.strava.com/api/v3/push_subscriptions";
const auth = `client_id=${clientId}&client_secret=${clientSecret}`;
const cmd = process.argv[2] ?? "create";

if (cmd === "list") {
  const res = await fetch(`${BASE}?${auth}`);
  console.log(JSON.stringify(await res.json(), null, 2));
} else if (cmd === "delete") {
  const id = process.argv[3];
  if (!id) throw new Error("usage: webhook:subscribe -- delete <id>");
  const res = await fetch(`${BASE}/${id}?${auth}`, { method: "DELETE" });
  console.log(res.status === 204 ? `Deleted ${id}` : `Failed: ${res.status} ${await res.text()}`);
} else {
  if (!siteUrl) throw new Error("Set SITE_URL to your deployed https origin");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: `${siteUrl}/api/strava/webhook`,
    verify_token: verifyToken,
  });
  const res = await fetch(BASE, { method: "POST", body });
  const json = await res.json();
  if (!res.ok) throw new Error(`Subscribe failed: ${res.status} ${JSON.stringify(json)}`);
  console.log("Subscribed:", JSON.stringify(json, null, 2));
}
