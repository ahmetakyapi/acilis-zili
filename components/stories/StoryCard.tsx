import Link from "next/link";
import { StoryBrands, type CastMember } from "@/components/stories/StoryVisual";
import { Panel } from "@/components/ui/primitives";
import type { StoryIndexRow } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, formatEtDateLong } from "@/lib/utils";

/**
 * Mercek kartı — marka şeridi, künye, başlık, giriş.
 *
 * Şerit yazının KADROSUNU gösteriyor: logolar yan yana, altında semboller.
 * Tek büyük logo denendi ve yazı tek bir firmayla ilgiliymiş gibi
 * okunuyordu; bu metinler çoğu zaman bir zinciri anlatıyor. Sağdaki tek
 * rakam ilk şirketin olay gününden bugüne getirisi — arşivde sorulan soru
 * "bu ay fiyat nasıl seyretti" değil, "bu olaydan sonra ne oldu".
 *
 * ORTAK BİLEŞEN OLDU. Kart `app/(app)/mercek/page.tsx` içinde yaşıyordu ve
 * hisse sayfasındaki mercek bloğu (`components/stock/SymbolStories.tsx`) aynı
 * yazıları düz metin satırları hâlinde basıyordu — aynı içerik, iki ayrı
 * görsel dil. İkinci bir kopya yazmak yerine kart buraya taşındı; `LogoTile`
 * on iki yerden buraya toplandığında öğrenilen ders aynı: iki kopya
 * kaçınılmaz olarak ayrışır.
 */
export function StoryCard({
  story,
  cast,
  locale,
  t,
  className,
}: {
  story: StoryIndexRow;
  cast: CastMember[];
  locale: Locale;
  t: Dictionary;
  className?: string;
}) {
  const total = story.symbols?.length ?? 0;

  return (
    <Link
      href={`/mercek/${story.slug}`}
      prefetch={false}
      /* Odak halkası kartın köşesini izliyor: yarıçapsız bir bağlantıda
         halka 16 piksellik yuvarlak köşenin etrafına köşeli bir dikdörtgen
         çiziyordu. */
      className={cn("block min-w-0 rounded-(--radius-xl)", className)}
    >
      <Panel className="panel-hover flex h-full flex-col overflow-hidden">
        {cast.length > 0 ? (
          <StoryBrands
            cast={cast}
            total={total}
            locale={locale}
          />
        ) : (
          <span className="block h-1.5 bg-[linear-gradient(90deg,var(--primary-wash),var(--primary-tint))]" />
        )}

        <div className="flex flex-1 flex-col p-5">
          {/* Tarih künyenin en görünür parçası. Üçü de 11,5px ve aynı soluk
              mürekkepteyken satır tek bir gri şerit gibi okunuyordu; oysa bu
              yazılarda tarih başlıktan sonra gelen ikinci bilgi — metin bir
              OLAYI anlatıyor ve olayın ne zaman olduğu hikâyenin parçası.
              Okuma süresi geride kalıyor: o bir künye, tarih değil. */}
          <p className="numeral flex items-baseline gap-1.5 text-tiny text-muted">
            <span className="text-base font-semibold text-body">
              {formatEtDateLong(story.eventDate, locale)}
            </span>
            {story.readMinutes && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {story.readMinutes} {t.stories.readMinutes}
                </span>
              </>
            )}
            {story.locale !== locale && (
              <span className="plate ml-auto text-micro tracking-[0.09em]">
                {story.locale.toUpperCase()}
              </span>
            )}
          </p>

          {/* `lang` ŞART: çevirisi olmayan yazı orijinal diliyle gösteriliyor
              ve rozet bunu göze söylüyor. Ekran okuyucu rozeti okumuyor —
              işaretleme olmadan Türkçe manşeti İngilizce sesletiyordu. */}
          <h3
            lang={story.locale}
            className="display-ink display-ink-tight mt-1.5 w-fit text-lead font-bold leading-[1.2] tracking-[-0.025em]"
          >
            {story.title}
          </h3>
          <p
            lang={story.locale}
            className="mt-2 line-clamp-3 text-base leading-[20px] text-body"
          >
            {story.dek}
          </p>
        </div>
      </Panel>
    </Link>
  );
}
