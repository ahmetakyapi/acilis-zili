import { CalendarPlus } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * "Takvime Ekle" — bir bilanço tarihini `.ics` olarak indirir.
 *
 * Dosyayı `app/api/takvim/route.ts` üretiyor ve saati bilinmeyen açıklamayı
 * TÜM GÜN etkinliği yazıyor; gerekçesi orada.
 *
 * İKİ BOYU VAR. Geniş satırlarda (günün en büyük bilançoları) adıyla yazılı
 * bir hap; dar liste satırlarında yalnızca ikon. Dar satırlarda metin, satırın
 * taşıdığı asıl bilgiyi — sembol, tarih, beklenti — kenara itiyordu; ikon
 * `aria-label` ve `title` taşıdığı için ne klavye ne ekran okuyucu bir şey
 * kaybediyor.
 *
 * `relative z-10` ŞART: bu düğmelerin bulunduğu satırlarda yüzeyi kaplayan
 * mutlak bir bağlantı var (satırın tamamı hisse sayfasına gidiyor). Katman
 * verilmezse dokunuş her zaman o bağlantıya düşer ve takvim indirilmez.
 */
export function AddToCalendar({
  symbol,
  date,
  label,
  compact = false,
  className,
}: {
  symbol: string;
  date: string;
  label: string;
  /** Dar liste satırı: yalnızca ikon. */
  compact?: boolean;
  className?: string;
}) {
  const href = `/api/takvim?tip=bilanco&sembol=${symbol}&tarih=${date}`;
  const title = `${symbol} · ${label}`;

  if (compact) {
    return (
      <a
        href={href}
        title={title}
        aria-label={title}
        className={cn(
          "relative z-10 -my-2 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary-wash hover:text-primary",
          className,
        )}
      >
        <CalendarPlus weight="duotone" size={15} aria-hidden />
      </a>
    );
  }

  return (
    <a
      href={href}
      title={title}
      className={cn(
        "relative z-10 -my-1 inline-flex min-h-8 items-center gap-1 rounded-full border border-line px-2 py-1 text-[10.5px] font-semibold text-muted transition-colors hover:border-line-strong hover:text-primary",
        className,
      )}
    >
      <CalendarPlus weight="duotone" size={13} aria-hidden />
      {label}
    </a>
  );
}
