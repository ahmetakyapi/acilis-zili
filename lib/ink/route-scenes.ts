import { stripLocale } from "@/lib/i18n/routing";
import type { InkSceneName } from "./scenes";

/**
 * Gezinme beklemesinde hangi kısa film oynasın — hedef ekrana göre.
 *
 * Yükleme kartı bir dönem her yerde aynı çalan zili gösteriyordu. Bekleyiş
 * nereye gidildiğini söyleyebilir: habere giderken sayfa basılıyor,
 * Mercek'e giderken büyüteç satırları tarıyor, bilançoya giderken terazi
 * dengeye geliyor. Okuyucu ekran açılmadan nereye vardığını görüyor.
 *
 * İLK EŞLEŞEN KAZANIR ve karşılaştırma dilden arınmış yolla yapılır
 * (`/en/mercek` de Mercek). Listede olmayan her yer açılış sahnesini
 * alıyor: sitenin imzası, okuyucunun ilk gördüğü zil.
 *
 * `"use client"` DEĞİL: hem gezinme göstergesi hem sayfalar okuyabilsin
 * (gerekçe CLAUDE.md → istemci ile sunucu sınırı).
 */
const ROUTE_SCENES: readonly (readonly [prefix: string, scene: InkSceneName])[] = [
  ["/haberler", "press"],
  ["/bulten", "press"],
  ["/mercek", "lens"],
  ["/rehber", "lens"],
  ["/bilancolar", "ledger"],
  ["/teknik", "chart"],
  ["/hisse", "chart"],
  ["/piyasalar", "chart"],
  ["/makro", "chart"],
  ["/karsilastir", "chart"],
  ["/sirketler", "searching"],
  ["/giris", "hello"],
  ["/kayit", "hello"],
  ["/favoriler", "hello"],
  ["/ayarlar", "hello"],
  ["/portfoy", "ledger"],
  ["/vergi", "ledger"],
  /* 14 Ekim: sahnesi hazır olup açılışa düşen hedefler eşlendi. Takvim gün
     şeridini alıyor (sitenin imzası, saat çentikleri); sözlük terim arayan
     okuyucu için büyüteç; hisse seçimi bir arama; analizlerim terazi;
     tematik listeler grafik. */
  ["/takvim", "dayStrip"],
  ["/sozluk", "lens"],
  ["/hisse-secimi", "searching"],
  ["/analizlerim", "ledger"],
  ["/tema", "chart"],
];

export function sceneForPath(pathname: string | null): InkSceneName {
  if (!pathname) return "intro";
  const path = stripLocale(pathname);
  for (const [prefix, scene] of ROUTE_SCENES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return scene;
  }
  return "intro";
}
