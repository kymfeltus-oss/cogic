/* COGIC LIVE — production service worker (Web Push + notification click). */
/* eslint-disable no-restricted-globals */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function safePath(url) {
  if (typeof url !== "string" || !url.startsWith("/")) return "/updates";
  if (url.startsWith("//") || url.includes("://") || url.includes("..")) return "/updates";
  const allowedExact = ["/live", "/updates", "/program", "/replays", "/my-convocation"];
  if (allowedExact.includes(url)) return url;
  if (url.startsWith("/replays/") && url.length < 120) return url;
  return "/updates";
}

self.addEventListener("push", (event) => {
  let payload = {
    title: "COGIC LIVE",
    body: "You have a new update.",
    url: "/updates",
    tag: "cogic-live",
  };

  try {
    if (event.data) {
      const data = event.data.json();
      payload = {
        title: typeof data.title === "string" ? data.title : payload.title,
        body: typeof data.body === "string" ? data.body : payload.body,
        url: safePath(typeof data.url === "string" ? data.url : payload.url),
        tag: typeof data.tag === "string" ? data.tag : payload.tag,
      };
    }
  } catch {
    try {
      const text = event.data ? event.data.text() : "";
      if (text) payload.body = text.slice(0, 180);
    } catch {
      // keep defaults
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/branding/cogic-seal.png",
      badge: "/branding/cogic-seal.png",
      tag: payload.tag,
      data: { url: payload.url },
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safePath(event.notification?.data?.url || "/updates");

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(target);
            return;
          }
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
