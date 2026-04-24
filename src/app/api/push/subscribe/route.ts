import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

/** POST /api/push/subscribe
 *  body: { subscription, device_id }
 *  Upserts on (user_id, device_id) so re-subscribing from the same browser
 *  just refreshes the endpoint. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const subscription = body.subscription;
  const deviceId = (body.device_id ?? "").toString().trim();
  if (!subscription || !deviceId) {
    return NextResponse.json({ error: "Missing subscription or device_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      device_id: deviceId,
      subscription,
      user_agent: req.headers.get("user-agent") ?? null,
    },
    { onConflict: "user_id,device_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/push/subscribe?device_id=<id>
 *  Removes the sub for this user + device so they stop receiving. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("device_id");
  if (!deviceId) {
    return NextResponse.json({ error: "device_id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("device_id", deviceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
