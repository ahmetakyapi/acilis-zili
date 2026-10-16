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
      /* Android rozeti yalnız ALFA kanalından çizer: opak renkli ikon durum
         çubuğunda düz beyaz kare oluyordu. Rozet saydam zeminde beyaz zil
         (scripts/build-favicon.mjs). */
      badge: "/badge-96.png",
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
      /* `navigate` bu worker'ın denetlemediği sekmede REDDEDİLİR (sert
         yenilenmiş sekme, "Sayfadan Ayrıl?" sorusuna "Kal" denmesi). Ret
         zinciri koparıyordu: bildirim kapanmış, hiçbir pencere açılmamış —
         tık boşa gidiyordu. Her başarısızlıkta yeni pencere. */
      for (const win of windows) {
        if ("navigate" in win && "focus" in win) {
          return win
            .navigate(target)
            .then((w) => (w ? w.focus() : self.clients.openWindow(target)))
            .catch(() => self.clients.openWindow(target));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

/*
 * ABONELİK YENİLENDİ (16 Ekim). Tarayıcı aboneliği kendisi yenileyebiliyor
 * (süre dolumu, anahtar dönüşü — Firefox yapıyor). Dinleyici yokken sunucu
 * eski adrese göndermeye devam ediyor, 410 alıp satırı siliyor ve okuyucu
 * Ayarlar "Açık" derken sessizce bildirimsiz kalıyordu. Yeni abonelik aynı
 * genel anahtarla alınır ve sunucuya bildirilir (app/api/push/yenile).
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription || null;
      let fresh = event.newSubscription || null;
      const key = old && old.options ? old.options.applicationServerKey : null;
      if (!fresh && key) {
        fresh = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }
      if (!fresh) return;
      await fetch("/api/push/yenile", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ old: old ? old.endpoint : null, subscription: fresh.toJSON() }),
      });
    })().catch(() => undefined),
  );
});
