"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Seans sınırında sayfayı kendiliğinden tazeler. Hiçbir şey çizmez.
 *
 * SORUN: geri sayım sıfıra inince orada KİLİTLENİYORDU — "0 sa 00 dk" yazıp
 * kalıyor, yeni güne ancak okuyucu sayfayı elle yenileyince geçiyordu. Sebep
 * basit: hedef anı sunucu basıyor, istemci yalnızca aradaki farkı sayıyor.
 * Fark sıfırlandığında yeni hedefi kimse sormuyordu. Aynı donma geri sayımla
 * sınırlı da değildi; seans rozeti, gün şeridindeki "şimdi" imi ve şeritteki
 * fiyatlar da açık kalan sekmede eskiyordu.
 *
 * ÇÖZÜM: sınır anında `router.refresh()`. Sunucu bileşenleri yeniden koşar,
 * yeni hedef ve yeni rozet aynı tazelemede gelir. Hedef `nextTransition`:
 * seans anlatısının değişeceği İLK an (04:00 / 09:30 / kapanış / gece), yani
 * geri sayımın kendi hedefinden hiçbir zaman geç değil.
 *
 * ÜÇ AYRINTI, üçü de bilinçli:
 *
 * 1. BEKLEME PARÇALANIR. Hafta sonu hedef 60 saat ötede olabiliyor; tek bir
 *    uzun `setTimeout` arka plan sekmesinde kısılıyor ve makine uyuyup
 *    uyandığında kaçırılıyor. En fazla 30 saniyelik adımlarla yürünüyor.
 *
 * 2. GİZLİ SEKME TAZELENMEZ. Terk edilmiş sekmeler için sunucuyu çalıştırmanın
 *    faydası yok; okuyucu geri döndüğünde `visibilitychange` zaten tazeliyor.
 *
 * 3. GERİ ÇEKİLME. Sunucu saati istemciden birkaç saniye geride olduğunda
 *    tazeleme AYNI hedefi geri döndürür ve döngü kurulurdu. Her başarısız
 *    turda bekleme ikiye katlanıyor (15 sn → 5 dk tavan); sunucu sınırı
 *    geçtiği anda yeni hedef gelir ve sayaç kendiliğinden sıfırlanır.
 */

/** İlk yeniden deneme aralığı ve tavanı. */
const RETRY_BASE_MS = 15_000;
const RETRY_CAP_MS = 300_000;
/** Uzun beklemenin tek adımı — daha uzun zamanlayıcılara güvenilmiyor. */
const STEP_MS = 30_000;

export function SessionRefresh({ atIso }: { atIso: string }) {
  const router = useRouter();
  const atMs = new Date(atIso).getTime();

  useEffect(() => {
    if (!Number.isFinite(atMs)) return;

    let timer = 0;
    let attempt = 0;

    const tick = () => {
      const remaining = atMs - Date.now();
      if (remaining > 0) {
        timer = window.setTimeout(tick, Math.min(remaining + 1_000, STEP_MS));
        return;
      }
      if (document.visibilityState === "hidden") {
        timer = window.setTimeout(tick, STEP_MS);
        return;
      }
      router.refresh();
      attempt += 1;
      timer = window.setTimeout(
        tick,
        Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_CAP_MS),
      );
    };

    tick();
    return () => window.clearTimeout(timer);
  }, [atMs, router]);

  /* Sekmeye dönüş: zamanlayıcı ne kadar kısılmış olursa olsun, geçmiş bir
     sınırla karşılaşan okuyucu eski ekranı görmez. */
  useEffect(() => {
    if (!Number.isFinite(atMs)) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() >= atMs) {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [atMs, router]);

  return null;
}
