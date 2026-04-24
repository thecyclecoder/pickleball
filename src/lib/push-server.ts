import { createAdminClient } from "./supabase/admin";

// web-push has no types
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require("web-push") as {
  setVapidDetails: (subject: string, pub: string, priv: string) => void;
  sendNotification: (sub: unknown, payload: string) => Promise<unknown>;
};

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails("mailto:dylanralston@gmail.com", pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string; // deep-link opened on notification click
  tag?: string;
  data?: Record<string, unknown>;
};

/** Send a push to every subscription for a list of user IDs. Best-effort —
 *  logs delivery failures and prunes dead subs (HTTP 404/410), but never
 *  throws to the caller. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };
  try {
    configure();
  } catch (e) {
    console.error("[push] VAPID not configured:", e);
    return { sent: 0, failed: 0 };
  }

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, subscription")
    .in("user_id", userIds);

  if (!subs?.length) return { sent: 0, failed: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    data: { ...(payload.data ?? {}), url: payload.url ?? "/" },
  });

  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(s.subscription, body))
  );

  let sent = 0;
  let failed = 0;
  const deadIds: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sent++;
      return;
    }
    failed++;
    const err = r.reason as { statusCode?: number; message?: string };
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      deadIds.push(subs[i].id);
    } else {
      console.error("[push] delivery failed:", err?.message ?? err);
    }
  });

  if (deadIds.length) {
    await admin.from("push_subscriptions").delete().in("id", deadIds);
  }
  return { sent, failed };
}
