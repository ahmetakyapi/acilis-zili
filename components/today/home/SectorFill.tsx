"use client";

import { useEffect } from "react";

/**
 * SEKTÖR SIRALAMASINI TEMA KOLONUNUN BOYUNA AÇAR (28 Kasım, Görsel Tur 4 —
 * TASARIM-RAPOR #10). "Sektörler ve Temalar" bandında iki kolon yan yana
 * (≥ 640); sektör sıralaması iki uçtan üçer satır gösterip ortasını
 * katlıyor, tema kolonu (iki uç kart) ise veriye göre 20–80 piksel daha
 * uzun bitiyordu. Kural "boşluk esnetilmez, doldurulur" (`arayuz.md`):
 * katlı satırlar `FillColumn` gibi yer oldukça açılır — sıra iki uçtan
 * içeri (dördüncü, sondan dördüncü…), sektör kolonunun SON ÇOCUĞU tema
 * kolonunun son çocuğunu geçmeden. Fark bir satırdan (40 piksel) küçük
 * kalır.
 *
 * Hiçbir şey çizmez. Satıra yalnız `data-band-open` yazar (CSS
 * MarketTexture.module.css → `.rb > li[data-fold][data-band-open]`);
 * katlama anahtarı açılınca bütün satırlar zaten görünür. JS yoksa ve
 * telefonda (tek kolon) taban 3 + 3 kalır. Hepsi açıldıysa anahtar
 * gizlenir (`data-band-all`), boşa basılan "Tümünü Göster" kalmaz.
 */
export function SectorFill() {
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 640px)");
    let frame = 0;
    /* Dip DÖNÜŞÜMSÜZ ölçülür (`offsetTop + offsetHeight`, iki parçanın
       ortak konumlu atasına göre). `getBoundingClientRect` kaydırma güdümlü
       beliriş dönüşümünü de katıyor; bir parça yükselirken ölçülünce tema
       kolonu 156 piksel aşağıda görünüyor ve beş satır birden açılıyordu
       (1440'ta beş-sekiz koşudan birinde; offset ölçüsüyle 16 koşuda 0). */
    const bottomOf = (part: HTMLElement) => {
      const kids = ([...part.children] as HTMLElement[]).filter((child) => child.offsetHeight > 0);
      const last = kids[kids.length - 1];
      return last ? last.offsetTop + last.offsetHeight : 0;
    };
    const run = () => {
      frame = 0;
      const sectors = document.querySelector<HTMLElement>('[data-band-part="sectors"]');
      const themes = document.querySelector<HTMLElement>('[data-band-part="themes"]');
      if (!sectors) return;
      const folded = [...sectors.querySelectorAll<HTMLElement>("li[data-fold]")];
      for (const row of folded) delete row.dataset.bandOpen;
      delete sectors.dataset.bandAll;
      if (!themes || !wide.matches || folded.length === 0) return;
      /* Katlama stili uygulanmamışsa (katlı satır zaten görünür) ölçme:
         hepsi "sığıyor" sayılırdı. Stil uygulanınca bölüm kısalır, gözlemci
         yeniden çağırır. */
      if (folded.some((row) => row.offsetHeight > 0)) return;
      /* Yan yana mı: iki kolonun tepesi aynı hatta değilse (tek kolon) dolgu yok. */
      if (sectors.offsetParent !== themes.offsetParent || Math.abs(sectors.offsetTop - themes.offsetTop) > 4) return;
      const order: HTMLElement[] = [];
      for (let lo = 0, hi = folded.length - 1; lo <= hi; lo++, hi--) {
        order.push(folded[lo]);
        if (hi !== lo) order.push(folded[hi]);
      }
      const limit = bottomOf(themes);
      let opened = 0;
      for (const row of order) {
        row.dataset.bandOpen = "";
        if (bottomOf(sectors) > limit + 0.5) {
          delete row.dataset.bandOpen;
          break;
        }
        opened++;
      }
      if (opened === folded.length) sectors.dataset.bandAll = "";
    };
    const plan = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    const sizes = new ResizeObserver(plan);
    const band = document.getElementById("sektor-ve-tema");
    const watch = () => {
      sizes.disconnect();
      /* Parçanın kendisi değil ÇOCUKLARI izlenir: iki parça bant ızgarasının
         aynı satırında, kutuları satırın boyuna gerili; tema kartı kısalınca
         gerili kutu değişmez ve açık kalan sektör satırları satırı tutardı
         (`arayuz.md` → "gözlemci kolonu değil PANELLERİ izler"). */
      for (const part of document.querySelectorAll("[data-band-part]")) {
        for (const child of part.children) sizes.observe(child);
      }
      plan();
    };
    /* Parçalar ayrı Suspense sınırlarından akışla iniyor; inen parçayı da izle. */
    const tree = new MutationObserver(watch);
    if (band) tree.observe(band, { childList: true, subtree: true });
    wide.addEventListener("change", plan);
    /* Logolar yerleşince tema kartı boy değiştirebilir; yüklemede bir tur. */
    window.addEventListener("load", plan);
    watch();
    return () => {
      window.removeEventListener("load", plan);
      cancelAnimationFrame(frame);
      sizes.disconnect();
      tree.disconnect();
      wide.removeEventListener("change", plan);
    };
  }, []);
  return null;
}
