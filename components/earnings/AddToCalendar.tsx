import { CalendarPlus } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/**
 * "Takvime Ekle" — bir bilanço tarihini `.ics` olarak indirir.
 *
 * Dosyayı `app/api/takvim/route.ts` üretiyor ve saati bilinmeyen açıklamayı
 * TÜM GÜN etkinliği yazıyor; gerekçesi orada.
 *
 * İKİ BOYU VAR. Geniş satırlarda (günün en büyük bilançoları) adıyla yazılı
 * bir hap; dar liste satırlarında ve mini kartlarda yalnızca ikon. Dar
 * yerlerde metin, satırın taşıdığı asıl bilgiyi — sembol, tarih, beklenti —
 * kenara itiyordu.
 *
 * `relative z-10` ŞART: bu düğmelerin bulunduğu satır ve kartlarda yüzeyi
 * kaplayan mutlak bir bağlantı var (gövdenin tamamı hisse sayfasına gidiyor).
 * Katman verilmezse dokunuş her zaman o bağlantıya düşer ve takvim inmez.
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
  /** Dar liste satırı ya da mini kart: yalnızca ikon. */
  compact?: boolean;
  className?: string;
}) {
  const href = `/api/takvim?tip=bilanco&sembol=${symbol}&tarih=${date}`;

  if (compact) {
    return (
      <a
        href={href}
        /* Erişilebilir ad sembolü TAŞIR, balon taşımaz. Ekran okuyucu
           düğmeleri bağlamından koparıp liste hâlinde okuyabiliyor; orada
           "Takvime Ekle" tek başına hangi şirket olduğunu söylemiyor. Balon
           ise zaten hangi kartın üstünde durduğu belli olan yerde açılıyor,
           sembolü tekrar etmesi onu gereksiz genişletiyordu. */
        aria-label={`${symbol} · ${label}`}
        className={cn(
          "group/cal relative z-10 -my-2 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-primary-wash hover:text-primary",
          className,
        )}
      >
        <CalendarPlus weight="duotone" size={15} aria-hidden />
        <HoverTip text={label} />
      </a>
    );
  }

  /* Adıyla yazılı sürümde balon yok: düğmenin üstünde zaten aynı kelimeler
     duruyor, balon onları bir kez daha söylerdi. */
  return (
    <a
      href={href}
      className={cn(
        "relative z-10 -my-1 inline-flex min-h-8 items-center gap-1 rounded-full border border-line px-2 py-1 text-nano font-semibold text-muted transition-colors hover:border-line-strong hover:text-primary",
        className,
      )}
    >
      <CalendarPlus weight="duotone" size={13} aria-hidden />
      {label}
    </a>
  );
}

/**
 * İpucu balonu — imleç değince ANINDA açılır.
 *
 * `title` özniteliğiydi ve iki sorunu vardı: tarayıcı onu yaklaşık bir
 * saniye bekletiyor, o sürede okuyucu ikonun ne yaptığını bilmeden
 * tıklıyordu; ikincisi sistem balonu temayı tanımıyor, karanlıkta beyaz bir
 * kutu olarak açılıyordu. Bu sürüm gecikmesiz ve sitenin katmanıyla aynı
 * yüzeyi kullanıyor.
 *
 * CSS'le çalışıyor — durum yok, `use client` yok; bileşen sunucuda kalıyor.
 *
 * SAĞA yaslı ve YUKARIDA: bu düğmelerin hepsi dar bir kutunun sağ ucunda
 * duruyor, ortalanmış bir balon sağdan taşardı. Yukarısı serbest çünkü
 * `overflow-hidden` taşıyan bir üst kutu yok — kartlar ve satırlar yalnızca
 * `rounded` + `border`.
 *
 * `hover:` varyantı Tailwind v4'te zaten `@media (hover: hover)` içinde;
 * dokunmatikte balon hiç açılmıyor, yani ekranda takılı kalmıyor.
 */
function HoverTip({ text }: { text: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-full right-0 z-30 mb-1.5 hidden whitespace-nowrap rounded-lg border border-line bg-overlay-surface px-2 py-1 text-tiny font-semibold text-strong opacity-0 shadow-(--shadow-overlay) transition-opacity duration-150 group-hover/cal:opacity-100 group-focus-visible/cal:opacity-100 sm:block"
    >
      {text}
    </span>
  );
}
