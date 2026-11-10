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
 * kavramı yok ve listeler tabanda kalır (parçalar `display:contents`,
 * telefon sırası DOM sırası — 10 Kasım gecesi).
 */
export function FillColumn() {
  useEffect(() => {
    const genis = window.matchMedia("(min-width: 1024px)");
    let kare = 0;

    /* KOLON PARÇALI (10 Kasım gecesi). Ana sayfanın DOM'u telefon
       sırasında ve masaüstünde her kolon İKİ parça (`[data-col]` iki kez;
       yerleşim TodayExperience.module.css → "KAYDIRMALI İKİ KOLON"). Kolonun
       dibi, o kolonun parçalarından EN AŞAĞIDA biten son çocuğun dibi. Bir
       ölçü daha eklendi: aynı kolonun iki parçası arasındaki fazladan
       boşluk. Izgara farkı normalde kısa kolonun dibinde bırakıyor; yalnız
       sol-bugün sağ-bugünden uzun kalırsa sağın alt parçası geç başlıyor ve
       fark parçaların ARASINDA açılıyor (CSS'teki not). Hedef iki ölçünün
       TOPLAMI: |dip farkı| + parça arası boşluk. */
    const kolonlar = () => [...document.querySelectorAll<HTMLElement>("[data-col]")];
    const sonDip = (parca: Element) => {
      let son = parca.lastElementChild;
      while (son && son.getBoundingClientRect().height === 0) son = son.previousElementSibling;
      return son ? son.getBoundingClientRect().bottom : null;
    };
    const maliyet = () => {
      const dipler = new Map<string, number>();
      const sonParca = new Map<string, HTMLElement>();
      let ara = 0;
      for (const parca of kolonlar()) {
        const ad = parca.dataset.col ?? "";
        const dip = sonDip(parca);
        if (dip === null) continue;
        const onceki = sonParca.get(ad);
        const oncekiDip = onceki ? sonDip(onceki) : null;
        if (oncekiDip !== null && parca.parentElement) {
          /* Parça arası: bu parçanın tepesi ile öncekinin son çocuğunun
             dibi arasındaki mesafenin ızgara satır aralığından fazlası. */
          const aralik = parseFloat(getComputedStyle(parca.parentElement).rowGap) || 0;
          ara += Math.max(0, parca.getBoundingClientRect().top - oncekiDip - aralik);
        }
        sonParca.set(ad, parca);
        dipler.set(ad, Math.max(dipler.get(ad) ?? 0, dip));
      }
      const ana = dipler.get("main");
      const yan = dipler.get("side");
      if (ana === undefined || yan === undefined) return null;
      return Math.abs(ana - yan) + ara;
    };

    const uygula = () => {
      if (kolonlar().length === 0) return;

      const yedek = [...document.querySelectorAll<HTMLElement>("[data-fill]")];
      if (yedek.length === 0) return;

      /* Ölçüm her zaman TABAN DURUMDAN yapılıyor: açık satırlar önce
         kapanıyor, yoksa ikinci koşumda boşluk zaten dolu görünür ve sonuç
         çağrıdan çağrıya kayardı. Hepsi tek bir kare içinde olduğu için
         ekranda titreme olmuyor. */
      for (const satir of yedek) satir.hidden = true;
      if (!genis.matches) return;

      /* EN YAKIN DİP (10 Kasım, ikinci tur). Döngü bir dönem yalnız SIĞAN
         satırı açıyordu ve kalan fark bir satır boyuna kadar çıkabiliyordu
         (gerçek sayfa + sahte sağlayıcı, 1440: ana kolon 5.600, yan 5.657 —
         fark 57, sıradaki analiz satırı 62; açılınca fark 5). Kural:
         sıradaki satır farkı KÜÇÜLTÜYORSA açılır.
         İKİ YÖNE YAKINSAMA (10 Kasım, üçüncü tur). "En yakın dip" yalnız
         belgedeki ilk gizli satırı ve yalnız bir kez deniyordu; bir satır
         farkı öteki yöne çevirince orada kalıyordu (1440: 27 piksel, oysa
         yan kolondaki 42 piksellik grafik satırı farkı 15'e indiriyordu).
         Her turda kolonlar yeniden ölçülür, HER listenin ilk gizli satırı
         aday olur ve farkı en çok küçülten açılır; fark küçülmüyorsa durur.
         Liste içinde sıra atlanmaz (aday hep listenin ilk gizlisi); her tur
         farkı kesin küçülttüğü için salınmaz. O turun ölçümü (kolon dipleri
         farkı, iki tema aynı): 1600: 31 · 1440: 27 → 14 · 1280: 5 · 1024: 14.
         10 KASIM GECESİ: "kısa kolon" sorusu kalktı. Kolonlar parçalı ve
         hedef dip farkı + parça arası boşluk (yukarıda); satır hangi
         kolonda olursa olsun aday ve toplamı en çok küçülten açılır: sol
         kolon kısaysa analizlerin ve merceğin, sağ kolon kısaysa
         hareketlerin, grafiğin, takvimin ve favorilerin satırları. Tur
         tavanı yedek satır sayısı. */
      for (let tur = 0; tur < yedek.length; tur++) {
        const simdi = maliyet();
        if (simdi === null || simdi <= 0) break;
        const gorulen = new Set<Element | null>();
        let enIyi: HTMLElement | null = null;
        let enIyiDeger = simdi;
        for (const satir of yedek) {
          if (!satir.hidden || !satir.closest("[data-col]")) continue;
          if (gorulen.has(satir.parentElement)) continue;
          gorulen.add(satir.parentElement);
          satir.hidden = false;
          const deger = satir.getBoundingClientRect().height > 0 ? maliyet() : null;
          satir.hidden = true;
          if (deger !== null && deger < enIyiDeger - 0.5) {
            enIyi = satir;
            enIyiDeger = deger;
          }
        }
        if (!enIyi) break;
        enIyi.hidden = false;
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
    const parcalar = kolonlar();

    const boyGozlemcisi = new ResizeObserver(planla);
    const bagla = () => {
      boyGozlemcisi.disconnect();
      for (const parca of parcalar) {
        for (const panel of parca.children) boyGozlemcisi.observe(panel);
      }
      planla();
    };
    bagla();

    const agacGozlemcisi = new MutationObserver(bagla);
    for (const parca of parcalar) {
      agacGozlemcisi.observe(parca, { childList: true });
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
