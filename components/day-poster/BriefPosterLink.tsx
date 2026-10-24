import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { getDayPoster } from "@/lib/day-poster-data";
import type { Dictionary } from "@/lib/i18n";

/**
 * Bülten sayısının altında o günün posteri (24 Ekim). Yalnız poster
 * GERÇEKTEN varsa: sabah bülteninin günü henüz kapanmadıysa ya da veri
 * eksikse bağlantı basılmıyor, 404'e giden bir bağlantı yok. Kendi
 * Suspense sınırında (BriefArchiveView), bülten metni onu beklemiyor.
 */
export async function BriefPosterLink({ date, t }: { date: string; t: Dictionary }) {
  const read = await getDayPoster(date);
  if (read.state !== "ok") return null;
  return (
    <p className="mt-6 border-t border-primary-faint pt-3">
      <Link
        href={`/gun/${date}`}
        className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-0"
      >
        {t.daySignature.brief.posterLink}
        <ArrowRight aria-hidden weight="bold" size={12} />
      </Link>
    </p>
  );
}
