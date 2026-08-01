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
 */
export function NewsImage({
  src,
  symbol,
  className,
  sizeClass = "size-20",
}: {
  src?: string | null;
  /** Görsel yokken karoda görünen sembol. */
  symbol?: string | null;
  className?: string;
  sizeClass?: string;
}) {
  if (!src) {
    if (!symbol) return null;
    return (
      <span
        aria-hidden
        className={cn(
          // Sessiz kalır: aynı sembol arka arkaya birkaç satırda tekrar
          // edebiliyor, accent dolgu o zaman listeyi bağırır hale getiriyor.
          "flex items-center justify-center rounded-[10px] border border-line bg-surface-elevated text-[11px] font-bold tracking-[-0.02em] text-muted",
          sizeClass,
          className,
        )}
      >
        {symbol}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "block overflow-hidden rounded-[10px] border border-line bg-surface-elevated",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className={cn("object-cover", sizeClass)}
      />
    </span>
  );
}
