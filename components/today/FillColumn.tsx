"use client";

import { useEffect } from "react";

/**
 * Kısa kalan kolonu, elindeki YEDEK SATIRLARLA doldurur.
 *
 * NEDEN: ana sayfa iki kolon ve ikisinin boyu içeriğe göre değişiyor —
 * bültenin uzunluğu, o gün kaç şirketin bilanço açıkladığı, kaç mercek
 * yazısı olduğu, takvimde olay olup olmadığı. Kolonlardan biri her zaman
 * ötekinden kısa kalıyor ve altta bir boşluk bırakıyor. Bir süre bu, iki
 * kolona `justify-between` koyularak çözülmüştü ama o çözüm boşluğu yok
 * etmiyor, PANEL ARALARINA dağıtıyordu: aralık kendi ölçüsü olmaktan çıkıp
 * öteki kolonun boyuna bağlanıyor, sağ kolon kısayken oradaki boşluklar 20
 * pikselden 92'ye çıkıyordu.
 *
 * Doğru çözüm boşluğu esnetmek değil DOLDURMAK: kırpılmış listeler zaten
 * kırpılmış ve kaç satır gösterecekleri bir tasarım tercihi. Sunucu tavan
 * kadar satır basıyor, fazlası `hidden` geliyor ve burası kaçının sığdığını
 * ölçüp o kadarını açıyor.
 *
 * İKİ YÖNLÜ. Bu denetim bir dönem yalnızca SAĞ kolonu dolduruyordu, çünkü
 * kısa kalanın hep o olduğu varsayılmıştı. Ölçüldüğünde tersi çıktı: bilanço
 * açıklayan şirket olmayan ve takvimde olay bulunmayan bir günde SOL kolon
 * 1440 pikselde 127 piksel kısa kalıyordu ve o boşluğu kapatacak hiçbir şey
 * yoktu. Artık hangi kolonun kısa olduğu ÖLÇÜLÜYOR ve yedek satırlar yalnızca
 * ona açılıyor; hangi listenin hangi kolonda olduğunu satırın kendi
 * `[data-col]` atası söylüyor.
 *
 * ÖLÇÜ KOLONUN KUTUSU DEĞİL, İÇERİĞİN DİBİ. Izgara satırı iki kolonu aynı
 * yüksekliğe geriyor, yani `kolon.getBoundingClientRect().bottom` ikisinde
 * de aynı sayıyı veriyor ve fark her zaman sıfır çıkıyordu. Son çocuğun dibi
 * ise gerçekten içeriğin bittiği yer.
 *
 * SATIR BOYU AÇARAK ÖLÇÜLÜYOR. `hidden` bir satırın yüksekliği sıfırdır, o
 * yüzden önceden `[data-fill-row]` diye görünür bir örnek satır
 * işaretleniyordu. Artık gerek yok: satır açılıyor, boyu okunuyor, sığmazsa
 * yeniden kapatılıyor. Hem işaretleme derdi kalkıyor hem de satırları eşit
 * boyda olmayan listeler doğru ölçülüyor — `getBoundingClientRect()` zaten
 * düzeni senkron hesaplatıyor ve satır sayısı tek haneli.
 *
 * JAVASCRIPT KAPALIYKEN TABAN SATIR SAYISI KALIR. Yedekler `hidden` ile
 * basılıyor, yani sunucu çıktısı taban listedir ve hiçbir şey zıplamıyor;
 * açılan satırlar zaten BOŞ olan alana iner.
 *
 * Yalnızca iki kolonlu düzende (1024px üstü) çalışır; dar ekranda kolon
 * kavramı yok ve listeler tabanda kalır.
 */
export function FillColumn() {
  useEffect(() => {
    const genis = window.matchMedia("(min-width: 1024px)");
    let kare = 0;

    const uygula = () => {
      const ana = document.querySelector('[data-col="main"]');
      const yan = document.querySelector('[data-col="side"]');
      if (!ana || !yan) return;

      const yedek = [...document.querySelectorAll<HTMLElement>("[data-fill]")];
      if (yedek.length === 0) return;

      /* Ölçüm her zaman TABAN DURUMDAN yapılıyor: açık satırlar önce
         kapanıyor, yoksa ikinci koşumda boşluk zaten dolu görünür ve sonuç
         çağrıdan çağrıya kayardı. Hepsi tek bir kare içinde olduğu için
         ekranda titreme olmuyor. */
      for (const satir of yedek) satir.hidden = true;
      if (!genis.matches) return;

      const dip = (kolon: Element) => {
        const son = kolon.lastElementChild;
        return son ? son.getBoundingClientRect().bottom : 0;
      };
      const anaDip = dip(ana);
      const yanDip = dip(yan);
      if (anaDip === 0 || yanDip === 0) return;

      const kisa = anaDip < yanDip ? "main" : "side";
      let bosluk = Math.abs(anaDip - yanDip);

      for (const satir of yedek) {
        if (bosluk <= 0) break;
        if (satir.closest("[data-col]")?.getAttribute("data-col") !== kisa) {
          continue;
        }
        satir.hidden = false;
        const boy = satir.getBoundingClientRect().height;
        if (boy <= 0 || boy > bosluk) {
          satir.hidden = true;
          continue;
        }
        bosluk -= boy;
      }
    };

    const planla = () => {
      cancelAnimationFrame(kare);
      kare = requestAnimationFrame(uygula);
    };

    planla();

    /* GÖZLEMCİ KOLONLARI DEĞİL PANELLERİ İZLİYOR.
       Bir dönem `observe(kolon)` yazıyordu ve sessizce çalışmıyordu: ızgara
       satırı iki kolonu AYNI yüksekliğe geriyor, yani kolonun kendi kutusu
       uzun kolonun boyuna kilitli. Kısa kolonun içindeki bir panel akışla
       gelip büyüdüğünde hiçbir kolon kutusu değişmiyor, gözlemci hiç
       ateşlenmiyor ve doldurma ilk karedeki (paneller henüz inmemiş) ölçüye
       göre karar verip orada kalıyordu — ölçüldü, aynı sayfa aynı genişlikte
       bazen doluyor bazen dolmuyordu.
       Panellerin kendi kutuları ise gerçekten değişiyor. Akışla YENİ panel
       eklendiğinde de listeyi tazelemek gerekiyor; onu `MutationObserver`
       söylüyor. */
    const kolonlar = [
      document.querySelector('[data-col="main"]'),
      document.querySelector('[data-col="side"]'),
    ].filter((k): k is Element => k !== null);

    const boyGozlemcisi = new ResizeObserver(planla);
    const bagla = () => {
      boyGozlemcisi.disconnect();
      for (const kolon of kolonlar) {
        for (const panel of kolon.children) boyGozlemcisi.observe(panel);
      }
      planla();
    };
    bagla();

    const agacGozlemcisi = new MutationObserver(bagla);
    for (const kolon of kolonlar) {
      agacGozlemcisi.observe(kolon, { childList: true });
    }
    genis.addEventListener("change", planla);

    return () => {
      cancelAnimationFrame(kare);
      boyGozlemcisi.disconnect();
      agacGozlemcisi.disconnect();
      genis.removeEventListener("change", planla);
    };
  }, []);

  return null;
}
