"use client";

import { useEffect, useRef } from "react";

/**
 * Kısa kalan kolonu, elindeki YEDEK SATIRLARLA doldurur.
 *
 * NEDEN: ana sayfa iki kolon ve ikisinin boyu içeriğe göre değişiyor —
 * bültenin uzunluğu, o gün kaç şirketin bilanço açıkladığı, kaç mercek
 * yazısı olduğu. Kolonlardan biri her zaman ötekinden kısa kalıyor ve altta
 * bir boşluk bırakıyor. Bir süre bu, iki kolona `justify-between` koyularak
 * çözülmüştü ama o çözüm boşluğu yok etmiyor, PANEL ARALARINA dağıtıyordu:
 * aralık kendi ölçüsü olmaktan çıkıp öteki kolonun boyuna bağlanıyor, sağ
 * kolon kısayken oradaki boşluklar 20 pikselden 92'ye çıkıyordu.
 *
 * Doğru çözüm boşluğu esnetmek değil DOLDURMAK: favoriler listesi zaten
 * kırpılmış bir liste ve kaç satır göstereceği bir tasarım tercihi.
 * Sunucu beşi görünür, beşi gizli olmak üzere on satır basıyor; burası
 * kaçının sığdığını ölçüp o kadarını açıyor.
 *
 * ÖLÇÜ KOLONUN KUTUSU DEĞİL, İÇERİĞİN DİBİ. Izgara satırı iki kolonu aynı
 * yüksekliğe geriyor, yani `kolon.getBoundingClientRect().bottom` ikisinde
 * de aynı sayıyı veriyor ve boşluk her zaman sıfır çıkıyordu. Son çocuğun
 * dibi ise gerçekten içeriğin bittiği yer; satır açtıkça yalnızca yan kolonun
 * dibi iniyor, ana kolonunki yerinde kalıyor ve hesap kendi kendini
 * dengeliyor.
 *
 * JAVASCRIPT KAPALIYKEN BEŞ SATIR. Yedek satırlar `hidden` ile basılıyor,
 * yani sunucu çıktısı beş satırlık ve hiçbir şey zıplamıyor; açılan satırlar
 * zaten BOŞ olan alana iniyor.
 *
 * Yalnızca iki kolonlu düzende (1024px üstü) çalışır; dar ekranda kolon
 * kavramı yok ve liste beş satırda kalır.
 */
export function FillColumn({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const kap = ref.current;
    if (!kap) return;

    const genis = window.matchMedia("(min-width: 1024px)");
    let kare = 0;

    const uygula = () => {
      const yedek = [...kap.querySelectorAll<HTMLElement>("[data-fill]")];
      if (yedek.length === 0) return;

      /* Ölçüm her zaman TABAN DURUMDAN yapılıyor: açık satırlar önce
         kapanıyor, yoksa ikinci koşumda boşluk zaten dolu görünür ve sonuç
         çağrıdan çağrıya kayardı. Hepsi tek bir kare içinde olduğu için
         ekranda titreme olmuyor. */
      for (const satir of yedek) satir.hidden = true;
      if (!genis.matches) return;

      const ana = document.querySelector('[data-col="main"]')?.lastElementChild;
      const yan = document.querySelector('[data-col="side"]')?.lastElementChild;
      if (!ana || !yan) return;

      const ornek = kap.querySelector<HTMLElement>("[data-fill-row]");
      const satirYuksekligi = ornek?.getBoundingClientRect().height ?? 0;
      if (satirYuksekligi <= 0) return;

      let bosluk =
        ana.getBoundingClientRect().bottom - yan.getBoundingClientRect().bottom;
      for (const satir of yedek) {
        if (bosluk < satirYuksekligi) break;
        satir.hidden = false;
        bosluk -= satirYuksekligi;
      }
    };

    const planla = () => {
      cancelAnimationFrame(kare);
      kare = requestAnimationFrame(uygula);
    };

    planla();
    /* Ana kolonun boyu sonradan da değişiyor: logolar iniyor, yazı tipi
       yükleniyor, akışla gelen paneller yerine oturuyor. */
    const gozlemci = new ResizeObserver(planla);
    const anaKolon = document.querySelector('[data-col="main"]');
    if (anaKolon) gozlemci.observe(anaKolon);
    genis.addEventListener("change", planla);

    return () => {
      cancelAnimationFrame(kare);
      gozlemci.disconnect();
      genis.removeEventListener("change", planla);
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
