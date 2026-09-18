"use client";

import { useCallback, useState } from "react";
import Image from "next/image";

/**
 * Logo karosunun GÖRSEL dalı.
 *
 * NEDEN AYRI BİR İSTEMCİ BİLEŞENİ
 * -------------------------------
 * Adres var ama görsel yüklenmiyorsa `<img>` boş kalmıyor: tarayıcı kendi
 * kırık-görsel simgesini çiziyor. iOS Safari'de bu, mavi zeminli bir soru
 * işareti; sayfanın dilinden tamamen kopuk, üstelik "bu şirketin logosu
 * YOK" gibi okunuyor — oysa dosya yerinde duruyor, yalnızca o isteği
 * tarayıcı tamamlayamamış. Ölçüldü (canlı site, telefon): endeks bileşenleri
 * tablosunda altmış logonun bir kısmı her açılışta FARKLI bir alt kümede
 * kırık görünüyordu, dosyaların hepsi 200 dönerken.
 *
 * `onError`i ancak istemci bileşeni bağlayabilir; haber görselinde de aynı
 * karar verilmişti (`components/news/NewsImage.tsx`, "NEDEN İSTEMCİ
 * BİLEŞENİ"). Buradaki fark, düşüşün yedeğinin SUNUCUDA çizilmesi: harf
 * karosu `fallback` olarak geliyor, yani bu bileşenin kendi biçimi yok ve
 * karo iki dalda birebir aynı kutuyu kaplıyor. Bedeli ölçüldü —
 * /piyasalar'ın altmış logolu tablosunda sayfa 415,4 KB'den 423,2 KB'ye
 * çıkıyor (+%1,9 ham, sıkıştırılmışta +%1,6).
 *
 * HİDRASYONDAN ÖNCE DÜŞEN GÖRSEL DE YAKALANIYOR. React `onError`i ancak
 * bağlandıktan sonra duyar; `ref` geri çağrısı bağlandığı anda `complete` ve
 * `naturalWidth === 0` ise görselin çoktan düştüğünü anlıyor.
 */
export function LogoImage({
  src,
  px,
  boxClass,
  fallback,
}: {
  src: string;
  px: number;
  boxClass: string;
  /** Görsel düşerse çizilecek harf karosu — sunucuda üretiliyor. */
  fallback: React.ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const watch = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth === 0) setBroken(true);
  }, []);

  if (broken) return <>{fallback}</>;

  return (
    /* Zemin BEYAZ: logoların çoğu şeffaf PNG ve koyu mürekkeple çizilmiş —
       koyu temada zeminsiz bırakılırsa görünmüyorlar. */
    <span className={boxClass}>
      <Image
        ref={watch}
        onError={() => setBroken(true)}
        src={src}
        alt=""
        width={px}
        height={px}
        className="size-full object-contain"
      />
    </span>
  );
}
