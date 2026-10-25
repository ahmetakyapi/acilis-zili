import { useSyncExternalStore } from "react";
import { LINE_DEFAULT_USD, LINE_STEPS_USD } from "@/lib/broker-line";

/**
 * Aracı kurum ekranının PAYLAŞILAN İSTEMCİ DURUMU (25 Ekim).
 *
 * Üç ayrı istemci adası aynı alım tutarını okuyor: tepedeki cümle
 * (`BrokerLead`), maliyet çizgisi (`BrokerCostLine`) ve kartlar
 * (`BrokerCards`). Aralarında sunucu panelleri durduğu için tek bir istemci
 * ağacına sokmak sayfanın tamamını istemciye çekerdi; bunun yerine modül
 * düzeyinde küçük bir depo ve `useSyncExternalStore`. Sunucu çiziminde ve
 * hidrasyonda varsayılan durak (1.000 $).
 *
 * TUTAR ADRESTE DEĞİL. Kaydırıcı sürüklenirken saniyede onlarca değer
 * üretiyor; her birini `history.replaceState`e yazmak Safari'nin sınırına
 * (30 saniyede 100 çağrı, sonra SecurityError) çarpıyordu. Sıra ve
 * karşılaştırma seçimi ise birer TIK — onlar adreste (aşağıda).
 *
 * Bu modül "use client" DEĞİL: yalnız istemci bileşenleri içe aktarıyor,
 * dışa aktardığı her şey fonksiyon (CLAUDE.md istemci/sunucu sınırı).
 */

export const DEFAULT_AMOUNT_INDEX = Math.max(0, (LINE_STEPS_USD as readonly number[]).indexOf(LINE_DEFAULT_USD));

let amountIndex = DEFAULT_AMOUNT_INDEX;
const amountListeners = new Set<() => void>();

function subscribeAmount(listener: () => void) {
  amountListeners.add(listener);
  return () => {
    amountListeners.delete(listener);
  };
}

export function setAmountIndex(next: number) {
  if (next === amountIndex) return;
  amountIndex = next;
  for (const listener of amountListeners) listener();
}

export function useAmountIndex(): number {
  return useSyncExternalStore(
    subscribeAmount,
    () => amountIndex,
    () => DEFAULT_AMOUNT_INDEX,
  );
}

/* ------------------------------------------------------------ adres */

/**
 * SIRA VE KARŞILAŞTIRMA ADRESTE ve adres TEK DOĞRU KAYNAK (temanın zaman
 * çizgisiyle aynı kalıp, ThemeTimelineChart): sığ güncellemeden sonra geri
 * tuşu eski ağacı yüklüyor, prop'tan başlayan durum adresle çelişirdi.
 * Anlık görüntü `location.search` dizesi — her okumada yeni dizi üretmemek
 * için ayrıştırma bileşende.
 */
const VIEW_EVENT = "az:broker-view";

function subscribeSearch(listener: () => void) {
  window.addEventListener("popstate", listener);
  window.addEventListener(VIEW_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(VIEW_EVENT, listener);
  };
}

export function useSearchString(): string {
  return useSyncExternalStore(
    subscribeSearch,
    () => window.location.search,
    () => "",
  );
}

/**
 * Sığ güncelleme: `replaceState`, `pushState` değil — sıra ve seçim birer
 * gezinme değil. Virgül ham kalıyor (`lib/compare.ts` gerekçesi: %2C aynı
 * içeriği iki adreste yaşatıyordu). Çağıran, gezinme sürerken denetimi
 * kapatıyor (`useRouteNavigating`, CLAUDE.md "Sığ adres güncellemesi").
 */
export function writeSearch(updates: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  const search = url.search.replace(/%2C/g, ",");
  window.history.replaceState(window.history.state, "", `${url.pathname}${search}${url.hash}`);
  window.dispatchEvent(new Event(VIEW_EVENT));
}
