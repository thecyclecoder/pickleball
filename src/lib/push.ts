// Client-side push subscription helpers. Each (user, device) pair gets
// its own row on the server, so a user can opt in separately on desktop
// and phone. The device id is a random UUID stored once in localStorage.

const DEVICE_ID_KEY = "buentiro_push_device_id_v1";

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

export type PushStatus =
  | "loading"
  | "subscribed"
  | "not_subscribed"
  | "denied"
  | "not_supported";

export async function getPushSubscriptionStatus(): Promise<PushStatus> {
  if (typeof window === "undefined") return "not_supported";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "not_supported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? "subscribed" : "not_subscribed";
  } catch {
    return "not_subscribed";
  }
}

export async function subscribeToPush(): Promise<{ success: boolean; reason?: string }> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { success: false, reason: "not_supported" };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { success: false, reason: "denied" };

  const reg = await navigator.serviceWorker.ready;
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return { success: false, reason: "no_vapid_key" };

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      subscription,
      device_id: getOrCreateDeviceId(),
    }),
  });
  return { success: res.ok };
}

export async function unsubscribeFromPush(): Promise<{ success: boolean; reason?: string }> {
  if (!("serviceWorker" in navigator)) return { success: false, reason: "not_supported" };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await fetch(`/api/push/subscribe?device_id=${encodeURIComponent(getOrCreateDeviceId())}`, {
      method: "DELETE",
    });
    return { success: true };
  } catch {
    return { success: false, reason: "error" };
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
