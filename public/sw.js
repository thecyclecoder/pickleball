// Buen Tiro service worker — PWA shell + web push.
//
// Caching policy: HTML navigations are NEVER handled by the SW, so UI
// deploys reach users on the next page load. Only icons + manifest are
// pre-cached (small, stable). Next.js ships content-hashed JS/CSS
// bundles whose filenames change on every deploy, so browser-level
// caching handles those automatically.
//
// Bump CACHE_NAME when STATIC_ASSETS changes so stale entries get
// purged on the next activate.

const CACHE_NAME = "buentiro-v2";
const STATIC_ASSETS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

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
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept auth, API, admin, login, or cross-origin
  const bypass = ["/auth/", "/api/", "/login", "/admin", "supabase.co"];
  if (bypass.some((p) => url.pathname.includes(p) || url.href.includes(p))) return;
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // HTML always goes to the network. No stale pages after a UI deploy.
  const accept = request.headers.get("accept") || "";
  if (request.mode === "navigate" || accept.includes("text/html")) return;

  // Cache-first for the handful of pre-cached assets; otherwise go to
  // the network and fall back to cache only if offline.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
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
