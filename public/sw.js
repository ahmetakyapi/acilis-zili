/*
 * Açılış Zili — service worker. YALNIZCA BİLDİRİM.
 *
 * Önbellek yok, `fetch` dinleyicisi yok: çevrimdışı çalışma ya da ağ isteği
 * araya girme bu dosyanın işi değil. Site bir veri sitesi ve bayat bir
 * önbellekten fiyat göstermek veri dürüstlüğü kuralını çiğnerdi. Kayıt da
 * yalnızca okuyucu Ayarlar'da "Bildirimleri Aç"a bastığında yapılıyor
 * (components/notifications/PushSettings.tsx); bildirim istemeyen okuyucunun
 * tarayıcısında bu dosya hiç çalışmıyor.
 *
 * Yük lib/push.ts → PushPayload: { title, body, url, tag }.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Açılış Zili", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Açılış Zili";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-maskable-192.png",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: typeof data.url === "string" ? data.url : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  /* Yalnızca aynı kökenin yolu: yük sunucumuzdan geliyor ama bir yol
     beklenirken tam bir adres gelirse başka siteye gidilmesin. */
  const raw = (event.notification.data && event.notification.data.url) || "/";
  const path = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if (win.url === target && "focus" in win) return win.focus();
      }
      for (const win of windows) {
        if ("navigate" in win && "focus" in win) return win.navigate(target).then((w) => (w ? w.focus() : undefined));
      }
      return self.clients.openWindow(target);
    }),
  );
});
