// Buen Tiro service worker — PWA shell + web push.

const CACHE_NAME = "buentiro-v1";
const STATIC_ASSETS = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Never intercept auth, API, or cross-origin requests
  const bypass = ["/auth/", "/api/", "/login", "/admin", "supabase.co"];
  if (bypass.some((p) => url.pathname.includes(p) || url.href.includes(p))) return;
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => cached))
  );
});

// ── Push ─────────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "Buen Tiro", body: event.data.text() };
  }
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || data.type || "buentiro",
    renotify: true,
    data: data.data || {},
  };
  event.waitUntil(self.registration.showNotification(data.title || "Buen Tiro", options));
});

// ── Notification click → open the URL in data ─────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientsList = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if (new URL(client.url).origin === self.location.origin) {
          try {
            await client.focus();
          } catch {}
          try {
            await client.navigate(url);
          } catch {}
          client.postMessage({ type: "NOTIFICATION_CLICK", url });
          return;
        }
      }
      try {
        await clients.openWindow(url);
      } catch {
        await clients.openWindow("/");
      }
    })()
  );
});
