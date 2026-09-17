"use client";

import { useCallback, useState } from "react";
import { Newspaper } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * Haber küçük resmi.
 *
 * Neden `next/image` değil: makale görselleri onlarca farklı haber CDN'inden
 * geliyor (benzinga, seekingalpha, chartmill, bloomberg…). `next/image` her
 * host için `remotePatterns` kaydı ister; hepsini kapsamak `hostname: "**"`
 * demek olurdu ve bu, `/_next/image` ucunu herkesin kullanabileceği bir
 * görsel proxy'sine çevirir. Optimizasyondan vazgeçip doğal `<img>` kullanmak
 * bu projede daha doğru bir denge — tek istisna burada, tek yerde.
 *
 * Görsel yoksa uydurma bir fotoğraf konmaz: sembolü taşıyan nötr bir karo
 * gelir. Böylece liste hizası bozulmaz ama okuyucu da olmayan bir görseli
 * varmış gibi görmez. Kaynakların çoğu (Yahoo) tek bir yer tutucu logo
 * yolladığı için bu durum sık — `getGenericImageUrls` onları eler.
 *
 * NEDEN İSTEMCİ BİLEŞENİ
 * ----------------------
 * Adres VAR ama görsel YÜKLENMİYORSA (CDN düşer, eski haberin görseli
 * silinir, host engellenir) `<img>` boş kalmıyor: tarayıcı kendi kırık-resim
 * simgesini çiziyor — çerçeveli, gri, sayfanın dilinden tamamen kopuk bir
 * kutu. Ölçüldü: ölü bir host verilen haber listesinde her satırda o simge
 * duruyordu. Bir dönem buna çare olarak çerçeveye zemin rengi verilmişti ama
 * zemin simgeyi gizlemiyor, yalnızca arkasını dolduruyor.
 *
 * `onError`i ancak istemci bileşeni bağlayabilir. Bileşen bu yüzden
 * `"use client"`: tek bir boolean durumu var, `<img>` etiketleri hâlâ TEK
 * dosyada (CLAUDE.md'deki `eslint-disable` istisnası bölünmüyor) ve sunucu
 * çizimi değişmiyor — istemci bileşenleri de HTML'e basılıyor.
 *
 * HİDRASYONDAN ÖNCE BOZULAN GÖRSEL DE YAKALANIYOR. React `onError`i ancak
 * bağlandıktan sonra duyar; görsel daha erken başarısız olursa olay kaçar.
 * `ref` geri çağrısı bunu kapatıyor: bağlandığı anda `complete` ve
 * `naturalWidth === 0` ise görsel çoktan düşmüş demektir.
 *
 * Sıra: görsel → şirket logosu → nötr işaret. Düşen her adres listeden
 * eleniyor ve bir sonraki dal deneniyor.
 *
 * ÖLÇÜ HER ZAMAN ÇERÇEVEDE
 * ------------------------
 * Eskiden `sizeClass` iki dalda farklı elemana gidiyordu: yer tutucuda dış
 * `<span>`'e, görselde `<img>`'ye. Görsel dalında çerçevenin hiç ölçüsü
 * olmadığı için yüksekliğini satır-içi `<img>`'den alıyordu ve altında
 * baseline boşluğu kalıyordu — kenarlık görseli sarmıyor, kutunun dibinde
 * birkaç piksellik dolgu şeridi görünüyordu. Mobilde 64px'lik bir karoda
 * bu şerit oranla çok daha belirgindi.
 *
 * Artık ölçü daima çerçevede; `<img>` çerçeveyi `block` olarak tam doldurur.
 * Baseline boşluğu kalmaz ve iki dal birebir aynı yeri kaplar.
 */
export function NewsImage({
  src,
  logoUrl,
  className,
  sizeClass = "size-20",
}: {
  src?: string | null;
  /**
   * Haberin konusu olan şirketin logosu. Yalnızca şirket BAŞLIKTA gerçekten
   * geçiyorsa gönderilir (`headlineMentions`) — `news.symbols` alanı bazen
   * haberin konusunu değil, çekildiği beslemeyi söylüyor.
   */
  logoUrl?: string | null;
  className?: string;
  sizeClass?: string;
}) {
  const [broken, setBroken] = useState<readonly string[]>([]);
  const fail = useCallback(
    (url: string) => setBroken((list) => (list.includes(url) ? list : [...list, url])),
    [],
  );
  /* Hidrasyondan önce düşen görseli yakalar; `onError` o olayı kaçırıyor. */
  const watch = useCallback(
    (url: string) => (node: HTMLImageElement | null) => {
      if (node && node.complete && node.naturalWidth === 0) fail(url);
    },
    [fail],
  );
  const usable = (url?: string | null): url is string => !!url && !broken.includes(url);

  /* Ölçü ve çağıran sınıfı en sonda: tailwind-merge display çakışmasını
     (block ↔ hidden ↔ flex) sona göre çözüyor, yani liste sayfasının
     "hidden sm:flex"i buradaki "block"u doğru şekilde eziyor. */
  /* ÇERÇEVE YOK. Görselin etrafındaki kenarlık ve iç dolgu, resmi kutunun
     ortasında duran ayrı bir nesne gibi gösteriyordu; görsel kutunun kendisi
     olmalı. Kenarlık yalnızca GÖRSEL OLMAYAN yer tutucuda kalıyor — orada
     kutuyu kutu yapan tek şey o. */
  /* ZEMİN HER DALDA VAR. Görsel inerken kutunun içi bembeyaz kalmasın diye;
     64 piksellik bir künyede küçük bir kusur ama ana sayfadaki haber
     kartında görsel 16:9 ve tam genişlik, orada beyaz bir delik oluyordu.

     ÇAĞIRANIN SINIFI EN SONDA — dalın kendi sınıflarından da sonra. Önce
     `frame` içinde, yani dalların eklediği sınıflardan ÖNCE duruyordu:
     tailwind-merge çakışmayı sona göre çözdüğü için yer tutucu dalın kendi
     `border` sınıfı, çağıranın `border-0`ını eziyordu. Ana sayfadaki haber
     kartı tam olarak o `border-0`a güveniyor ve yer tutucu, kartın içinde
     ikinci bir kutu olarak çiziliyordu. */
  const frame = cn(
    "block shrink-0 overflow-hidden rounded-md bg-surface-elevated",
    sizeClass,
  );

  if (usable(src)) {
    return (
      <span className={cn(frame, className)}>
        {/* `next/image` DEĞİL — gerekçe dosyanın başındaki notta, istisnanın
            kaydı CLAUDE.md'de. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={watch(src)}
          src={src}
          alt=""
          loading="lazy"
          onError={() => fail(src)}
          className="block size-full object-cover"
        />
      </span>
    );
  }

  /* Görsel yoksa sıradaki en iyi şey ŞİRKETİN LOGOSU: haberin konusu olan
     şirketi gösteriyor, telifi zaten kullandığımız sağlayıcı profilinden
     geliyor (symbols.logo_url) ve listeyi sembol yazan gri kutulardan
     kurtarıyor. Beyaz zemin bilinçli — logoların çoğu şeffaf PNG ve koyu
     temada kendi koyu harfleriyle kayboluyor. */
  if (usable(logoUrl)) {
    return (
      <span className={cn(frame, "bg-white", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={watch(logoUrl)}
          src={logoUrl}
          alt=""
          loading="lazy"
          onError={() => fail(logoUrl)}
          className="block size-full object-contain"
        />
      </span>
    );
  }

  /* GÖRSEL DE LOGO DA YOKSA: nötr bir okuma işareti.
     Burada bir süre SEMBOL YAZIYORDU ("MU", "INTC") ve bu iki ayrı sorun
     üretiyordu. Birincisi, sembol de bir iddiadır: haber o şirketle ilgili
     değilse — `news.symbols` bazen haberin konusunu değil çekildiği beslemeyi
     söylüyor — kutuda yanlış şirketin adı duruyordu. İkincisi, liste satır
     satır farklı görünüyordu: biri fotoğraf, biri logo, biri gri harfler.
     Nötr işaret ikisini de çözüyor; hiçbir şey iddia etmiyor ve bütün
     satırlar aynı ritimde duruyor. */
  return (
    <span
      aria-hidden
      className={cn(
        frame,
        "flex items-center justify-center border border-line bg-surface-elevated text-muted",
        className,
      )}
    >
      <Newspaper weight="duotone" className="size-1/3" />
    </span>
  );
}
