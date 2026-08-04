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
  symbol,
  logoUrl,
  className,
  sizeClass = "size-20",
}: {
  src?: string | null;
  /** Görsel yokken karoda görünen sembol. */
  symbol?: string | null;
  /** Haberin geçtiği şirketin logosu — görsel yoksa sembolün yerine geçer. */
  logoUrl?: string | null;
  className?: string;
  sizeClass?: string;
}) {
  /* Ölçü ve çağıran sınıfı en sonda: tailwind-merge display çakışmasını
     (block ↔ hidden ↔ flex) sona göre çözüyor, yani liste sayfasının
     "hidden sm:flex"i buradaki "block"u doğru şekilde eziyor. */
  /* ÇERÇEVE YOK. Görselin etrafındaki kenarlık ve iç dolgu, resmi kutunun
     ortasında duran ayrı bir nesne gibi gösteriyordu; görsel kutunun kendisi
     olmalı. Kenarlık yalnızca GÖRSEL OLMAYAN yer tutucuda kalıyor — orada
     kutuyu kutu yapan tek şey o. */
  const frame = cn(
    "block shrink-0 overflow-hidden rounded-[10px]",
    sizeClass,
    className,
  );

  /* Görsel yoksa sıradaki en iyi şey ŞİRKETİN LOGOSU: haberin konusu olan
     şirketi gösteriyor, telifi zaten kullandığımız sağlayıcı profilinden
     geliyor (symbols.logo_url) ve listeyi sembol yazan gri kutulardan
     kurtarıyor. Beyaz zemin bilinçli — logoların çoğu şeffaf PNG ve koyu
     temada kendi koyu harfleriyle kayboluyor. */
  if (!src && logoUrl) {
    return (
      <span className={cn(frame, "bg-white")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          loading="lazy"
          className="block size-full object-contain"
        />
      </span>
    );
  }

  if (!src) {
    if (!symbol) return null;
    return (
      <span
        aria-hidden
        className={cn(
          frame,
          // Sessiz kalır: aynı sembol arka arkaya birkaç satırda tekrar
          // edebiliyor, accent dolgu o zaman listeyi bağırır hale getiriyor.
          "flex items-center justify-center border border-line bg-surface-elevated text-[11px] font-bold tracking-[-0.02em] text-muted",
        )}
      >
        {symbol}
      </span>
    );
  }

  return (
    <span className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className="block size-full object-cover"
      />
    </span>
  );
}
