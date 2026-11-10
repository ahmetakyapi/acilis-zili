"use client";

import { useEffect, useLayoutEffect } from "react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import { EASE_BRAND } from "@/lib/motion";

/**
 * Sıralama değişince satırlar eski yerinden yenisine KAYAR (10 Kasım 2026).
 *
 * NEDEN: Endeks Bileşenleri tablosunda başlığa basınca altmış satır bir
 * karede yer değiştiriyordu; okuyucu izlediği şirketi kaybediyor, "ne
 * değişti" sorusunu listeyi baştan okuyarak cevaplıyordu. Kayma aynı
 * satırın nereye gittiğini gösteriyor (FLIP: önce ölç, sonra ters çevir,
 * oynat).
 *
 * NASIL: tablo SUNUCUDA, son hâliyle basılıyor ve bu yaprak onu yeniden
 * çizmiyor. Sıralama bağlantısına basıldığı an satırların tablo gövdesine
 * göre konumu modül düzeyinde saklanır (Suspense anahtarı değiştiği için
 * eski satırlar DOM'dan kalkıyor; `ref` ile taşınamaz). Yeni tablo bağlanınca
 * her satır `data-row` anahtarıyla eşlenir ve yalnız `translate` oynatılır
 * (kompozitör; yerleşim tetiklenmez). `MotionExperience`in satır opaklığıyla
 * çakışmaz — ayrı özellik. `components/motion/Morph.tsx` logo UÇUŞU içindir
 * (sayfalar arası tek öğe); satır FLIP'i katalogda yoktu.
 *
 * SINIRLAR: kayıt 8 saniyede eskir (yavaş ağda alakasız bir bağlanışta
 * oynamasın); kayma ±`MAX_TRAVEL` pikselle sınırlı — listenin dibinden
 * tepesine çıkan satır 2.700 piksel uçmaz, yakından gelir; önceki sayfada
 * olmayan satır yalnız yerinde belirir. Hareketi azaltana hiçbir şey
 * oynamaz. Sekme değişince (`token`) kayıt geçersiz: başka endeksin
 * satırları aynı sembolü taşısa da bu bir sıralama değil.
 */
const MAX_TRAVEL = 184;
const STALE_MS = 8000;

let memory: { scope: string; token: string; at: number; tops: Map<string, number> } | null = null;

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function rowsOf(scope: string) {
  const body = document.getElementById(scope)?.querySelector("tbody");
  if (!body) return null;
  const top = body.getBoundingClientRect().top;
  const rows = Array.from(body.querySelectorAll<HTMLElement>("tr[data-row]"));
  return { body, top, rows };
}

export function RowFlip({ scope, token, order }: {
  scope: string;
  /** Aynı kümenin kimliği (endeks sekmesi) — değişirse kayıt geçersiz. */
  token: string;
  /** Sıranın imzası (sütun + yön + derinlik): değişince oynatma yeniden
      dener. Sayfada Suspense anahtarı tabloyu yeniden bağlıyor; aynı ağaç
      yerinde güncellenirse (önizleme, ileride anahtarsız akış) de çalışsın. */
  order: string;
}) {
  const reduced = useMotionPreference();

  /* Kayıt: sıralama başlığına basış (yakalama evresi — gezinme başlamadan). */
  useEffect(() => {
    const root = document.getElementById(scope);
    if (!root || reduced) return;
    const record = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest("thead a")) return;
      const found = rowsOf(scope);
      if (!found) return;
      const tops = new Map<string, number>();
      for (const row of found.rows) {
        /* Katlı (display:none) satırın kutusu yok; kaydı da yok. */
        if (row.offsetParent === null) continue;
        tops.set(row.dataset.row!, row.getBoundingClientRect().top - found.top);
      }
      memory = { scope, token, at: performance.now(), tops };
    };
    root.addEventListener("click", record, true);
    return () => root.removeEventListener("click", record, true);
  }, [scope, token, reduced]);

  /* Oynatma: yeni tablo bağlandığında, boyamadan önce. */
  useIsoLayoutEffect(() => {
    const kept = memory;
    memory = null;
    if (!kept || reduced || kept.scope !== scope || kept.token !== token) return;
    if (performance.now() - kept.at > STALE_MS) return;
    const found = rowsOf(scope);
    if (!found) return;
    const moves: { row: HTMLElement; delta: number }[] = [];
    for (const row of found.rows) {
      if (row.offsetParent === null) continue;
      const before = kept.tops.get(row.dataset.row!);
      if (before === undefined) continue;
      const delta = before - (row.getBoundingClientRect().top - found.top);
      if (Math.abs(delta) >= 1) moves.push({ row, delta: Math.max(-MAX_TRAVEL, Math.min(MAX_TRAVEL, delta)) });
    }
    /* Temizlik yok: animasyon dolgusuz ve kendiliğinden biter; iptal etmek
       geliştirmedeki çift bağlanışta (Strict Mode) kaymayı hiç oynatmazdı. */
    for (const { row, delta } of moves) {
      row.animate([{ translate: `0 ${delta}px` }, { translate: "0 0" }], { duration: 520, easing: EASE_BRAND });
    }
  }, [scope, token, order, reduced]);

  return null;
}

/**
 * Satırın tamamı, içindeki bağlantıya götürür (10 Kasım 2026).
 *
 * NEDEN: bileşen tablosunda bağlantı yalnız Şirket hücresindeydi; okur
 * yüzdeye ya da fiyata bastığında hiçbir şey olmuyordu. CSS ile germe
 * (`a::after { inset:0 }`) burada çalışmıyor: Şirket hücresi 1280'in
 * altında yapışkan (`position:sticky`), yani sözde öğenin kapsayıcısı satır
 * değil o hücre; taşırmak da kabın kaydırma genişliğini büyütürdü.
 *
 * NASIL: gerçek bağlantı yerinde kalır (klavye, orta tık, ekran okuyucu,
 * şirket kartı ona bağlı). Bu yaprak satırın GERİ KALANINA yapılan birincil
 * tıklamayı o bağlantıya aynı değiştirici tuşlarla iletir; yönlendirmeyi
 * yine `Link` yapar (dil öneki, istemci gezinmesi). Metin seçilirken ve
 * satırdaki başka bir etkileşimli öğede hiçbir şey yapmaz. JS yoksa Şirket
 * hücresi eskisi gibi bağlantıdır.
 */
export function RowTap({ scope }: { scope: string }) {
  useEffect(() => {
    const root = document.getElementById(scope);
    if (!root) return;
    const open = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return;
      const row = event.target.closest("tbody tr[data-row]");
      if (!row || event.target.closest("a, button, input, label")) return;
      if (window.getSelection()?.toString()) return;
      row.querySelector<HTMLAnchorElement>("a[href]")?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        }),
      );
    };
    root.addEventListener("click", open);
    return () => root.removeEventListener("click", open);
  }, [scope]);
  return null;
}
