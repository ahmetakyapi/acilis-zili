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
  /* Ölçü ve çağıran sınıfı en sonda: tailwind-merge display çakışmasını
     (block ↔ hidden ↔ flex) sona göre çözüyor, yani liste sayfasının
     "hidden sm:flex"i buradaki "block"u doğru şekilde eziyor. */
  /* ÇERÇEVE YOK. Görselin etrafındaki kenarlık ve iç dolgu, resmi kutunun
     ortasında duran ayrı bir nesne gibi gösteriyordu; görsel kutunun kendisi
     olmalı. Kenarlık yalnızca GÖRSEL OLMAYAN yer tutucuda kalıyor — orada
     kutuyu kutu yapan tek şey o. */
  /* ZEMİN HER DALDA VAR. Görsel yüklenmezse (haber CDN'i düşer, adres
     kırılır) `<img>` boş kalıyor ve kutunun içi bembeyaz görünüyor. 64
     piksellik bir künyede bu küçük bir kusurdu; ana sayfadaki haber kartında
     görsel 16:9 ve tam genişlik, yani beyaz bir delik oluyor. Çerçevenin
     kendi zemini o durumda nötr bir yüzey bırakıyor.

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

  /* Görsel yoksa sıradaki en iyi şey ŞİRKETİN LOGOSU: haberin konusu olan
     şirketi gösteriyor, telifi zaten kullandığımız sağlayıcı profilinden
     geliyor (symbols.logo_url) ve listeyi sembol yazan gri kutulardan
     kurtarıyor. Beyaz zemin bilinçli — logoların çoğu şeffaf PNG ve koyu
     temada kendi koyu harfleriyle kayboluyor. */
  if (!src && logoUrl) {
    return (
      <span className={cn(frame, "bg-white", className)}>
        {/* `next/image` DEĞİL: uzak görsel hostlarının tamamını kapsamak
            `hostname: "**"` demek ve o da `/_next/image`i açık bir görsel
            proxy'sine çevirir. Gerekçenin tamamı dosyanın başındaki notta,
            istisnanın kaydı CLAUDE.md'de. */}
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

  /* GÖRSEL DE LOGO DA YOKSA: nötr bir okuma işareti.
     Burada bir süre SEMBOL YAZIYORDU ("MU", "INTC") ve bu iki ayrı sorun
     üretiyordu. Birincisi, sembol de bir iddiadır: haber o şirketle ilgili
     değilse — `news.symbols` bazen haberin konusunu değil çekildiği beslemeyi
     söylüyor — kutuda yanlış şirketin adı duruyordu. İkincisi, liste satır
     satır farklı görünüyordu: biri fotoğraf, biri logo, biri gri harfler.
     Nötr işaret ikisini de çözüyor; hiçbir şey iddia etmiyor ve bütün
     satırlar aynı ritimde duruyor. */
  if (!src) {
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

  return (
    <span className={cn(frame, className)}>
      {/* `next/image` DEĞİL — gerekçe dosyanın başındaki notta, istisnanın
          kaydı CLAUDE.md'de. */}
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
