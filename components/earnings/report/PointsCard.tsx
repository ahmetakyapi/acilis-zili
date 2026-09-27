import { CalendarBlank, TrendUp, Warning } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/motion/PremiumMotion";
import { RichText } from "@/components/earnings/RichText";
import type { AutoLinker } from "@/lib/autolink";
import styles from "@/components/earnings/EarningsReport.module.css";
import { splitLeadingDate } from "@/lib/earnings-report";
import { cn } from "@/lib/utils";

/**
 * Güçlü Yönler / Riskler / Beklenen Gelişmeler.
 *
 * Üçü de aynı biçimde altı maddelik bir liste ve düz metin olarak yan yana
 * durduklarında hangisinin ne olduğu ancak başlık okununca anlaşılıyordu.
 * Artık her kart başlıkta bir ikon karosu ve madde sayısı taşıyor, madde
 * numaraları da çıplak rakam değil kendi tonundaki küçük kareler — göz
 * karta bakar bakmaz "bu iyi taraf / bu risk" diyor.
 */
export function PointsCard({
  title,
  points,
  tone,
  footer,
  linker,
}: {
  title: string;
  points: string[];
  tone: "up" | "down" | "primary";
  /** Kartın dibine yapışan satır — Beklenen Gelişmeler'de sonraki bilanço. */
  footer?: React.ReactNode;
  /** Sayfanın tek bağlayıcısı — gerekçe `RichText`te. */
  linker: AutoLinker;
}) {
  if (points.length === 0) return null;

  const Icon = tone === "up" ? TrendUp : tone === "down" ? Warning : CalendarBlank;
  /* Mavi ton hem başlıkta hem 8 piksellik sıra numaralarında kullanılıyor ve
     ikisi de `--primary-wash` zemininde duruyor: `--primary` orada 4,26'ya
     iniyor (ölçüldü, gereken 4,5). Mürekkep tonu aynı aileden ve 5,4. */
  const accent =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-primary-ink";

  return (
    <Reveal className={styles.pointReveal}>
    {/* Kart zemini modülde (`.pointsCard`) — düz; ton yalnızca başlıkta
        ve ikon karosunda. Burada yazılı `bg-up-wash/40` gibi yardımcılar
        modülce eziliyordu, kaldırıldı. */}
    <section className={cn(styles.pointsCard, "flex min-w-0 flex-col rounded-xl border p-4")}>
      <div className="mb-3 flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            tone === "up" && "bg-up-wash",
            tone === "down" && "bg-down-wash",
            tone === "primary" && "bg-primary-wash",
            accent,
          )}
        >
          <Icon weight="duotone" size={15} />
        </span>
        {/* h3 DEĞİL h2. Güçlü Yönler / Riskler / Beklenen Gelişmeler,
            sayfada "Özet" ve "Detaylı Değerlendirme" ile aynı düzeyde duran
            üç panel; h3 yazılınca başlıklarda gezinen okuyucuya bir üsttekinin
            ALT BÖLÜMÜ gibi görünüyorlardı. Punto artık da aynı düzeyde
            (panel başlığı, modülde).
            DÜZ MÜREKKEP: başlığın rengi yönü söylüyor (`text-up`,
            `text-down`) ve genel `main h2` degradesi dolguyu saydam yapıp
            onu siliyordu (ölçüldü: rgba(0,0,0,0)). */}
        <h2 data-ink="plain" className={cn("text-base font-bold tracking-[-0.01em]", accent)}>
          {title}
        </h2>
        <span className="figure ml-auto text-tiny font-bold text-muted">
          {points.length}
        </span>
      </div>

      {tone === "primary" ? (
        /* ZAMAN ÇİZGİSİ. Maddeler "Aralık 2026: …" diye tarihle başlıyor;
           tarih metinden ayrılıp çizginin üstünde kalın ve mavi yazılıyor.
           Kart iki komşusundan (altışar madde) kısa kalıyordu ve 1440'ta
           103, 1024'te 169, 768'de 219 piksel boşluk bırakıyordu; alttaki
           sonraki bilanço satırı `mt-auto` ile kartın dibine iniyor. */
        <ol className={styles.timeline}>
          {points.map((point, index) => {
            const dated = splitLeadingDate(point);
            return (
              <li key={index} className="text-small leading-[18px] text-body [text-wrap:pretty]">
                {dated && (
                  <span className="mb-0.5 block text-tiny font-bold text-primary-ink">
                    {dated.date}
                  </span>
                )}
                <RichText text={dated ? dated.text : point} linker={linker} />
              </li>
            );
          })}
        </ol>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {points.map((point, index) => (
            <li
              key={index}
              className="flex gap-2.5 text-small leading-[18px] text-body [text-wrap:pretty]"
            >
              <span
                aria-hidden
                className={cn(
                  "figure mt-px flex size-5 shrink-0 items-center justify-center rounded-xs text-nano font-bold leading-none",
                  tone === "up" && "bg-up-wash",
                  tone === "down" && "bg-down-wash",
                  accent,
                )}
              >
                {index + 1}
              </span>
              <span>
                <RichText text={point} linker={linker} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {footer && <div className={styles.timelineFooter}>{footer}</div>}
    </section>
    </Reveal>
  );
}
