import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DayPosterView } from "@/components/day-poster/DayPosterView";
import { posterStoryText } from "@/components/day-poster/story";
import { getHolidays } from "@/lib/data";
import { POSTER_OG_SIZE, parsePosterDate } from "@/lib/day-poster";
import { getDayPoster, getLatestPosterDate, getPosterSceneStocks } from "@/lib/day-poster-data";
import { getDictionary, getI18n, getLocale } from "@/lib/i18n";
import { LOCALES } from "@/lib/i18n/config";
import { nextTradingDay, todayEt } from "@/lib/market-hours";
import { missingMetadata, ogLocale } from "@/lib/page-meta";
import { absoluteUrl, pageAlternates } from "@/lib/site";
import { formatEtDateLong } from "@/lib/utils";

/**
 * GÜNÜN POSTERİ — `/gun/2026-10-23` (24 Ekim). Gövde ve gerekçeler
 * `components/day-poster/DayPosterView.tsx`, veri `lib/day-poster-data.ts`.
 *
 * ADRES AÇILIŞ KARTININ KARDEŞİ: `/gun/[tarih]/kart` o günün sabah kartı
 * (`app/gun/[tarih]/kart/route.tsx`, öneksiz ağaçta), bu sayfa aynı günün
 * kapanış posteri. Tarih ET seans günü, ISO biçimi.
 *
 * 404 ÜÇ DURUMDA: tarih geçersiz ya da pencere dışında
 * (`parsePosterDate`), o gün seans yok ya da henüz tamamlanmadı, veri
 * eksik (on bir sektörün hepsi yok). Sağlayıcı DÜŞTÜYSE 404 değil, hata
 * sınırı: "okunamadı" ile "yok" ayrı (lib/data.ts → "TEK KAYDIN
 * SAYFASINDA YUTMA YOK"). Segmentte `loading.tsx` yok (yumuşak 404,
 * `app/(app)/layout.tsx`).
 */

function posterPath(date: string) {
  return `/gun/${date}`;
}

export async function generateMetadata(props: PageProps<"/gun/[tarih]">): Promise<Metadata> {
  const { tarih } = await props.params;
  const locale = await getLocale();
  const date = parsePosterDate(tarih, todayEt());
  if (!date) return missingMetadata(locale);
  const read = await getDayPoster(date);
  if (read.state !== "ok") return missingMetadata(locale);
  const t = getDictionary(locale);
  const L = t.daySignature.poster;
  const label = formatEtDateLong(date, locale);
  const image = absoluteUrl(`${posterPath(date)}/gorsel`, locale);
  return {
    title: L.metaTitle.replace("{date}", label),
    /* Açıklama günün cümlesiyle: arama sonucunda ve paylaşım kartında
       tarih değil, o gün ne olduğu okunuyor. */
    description: L.metaDescription
      .replace("{date}", label)
      .replace("{sentence}", posterStoryText(read.poster, locale, t).sentence),
    alternates: pageAlternates(posterPath(date), locale),
    /* Paylaşım kartı posterin kendi görseli (`gorsel/route.tsx`). `openGraph`
       kökle derin birleşmiyor; marka satırı elle (bkz. `articleOpenGraph`). */
    openGraph: {
      type: "website",
      siteName: t.brand.name,
      locale: ogLocale(locale),
      alternateLocale: LOCALES.filter((l) => l !== locale).map(ogLocale),
      images: [{ url: image, ...POSTER_OG_SIZE, alt: L.metaTitle.replace("{date}", label) }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function DayPosterPage(props: PageProps<"/gun/[tarih]">) {
  const { tarih } = await props.params;
  const today = todayEt();
  const date = parsePosterDate(tarih, today);
  if (!date) notFound();

  const { locale, t } = await getI18n();
  const read = await getDayPoster(date);
  if (read.state === "error") throw new Error(`Günün posteri okunamadı: ${date}`);
  if (read.state === "missing") notFound();

  const { poster, fetchedAt } = read;
  const [holidays, latest, scene] = await Promise.all([getHolidays(), getLatestPosterDate(), getPosterSceneStocks(poster)]);
  /* Önceki seans pencerenin içindeyse; sonraki yalnızca tamamlanmışsa. */
  const prevHref = parsePosterDate(poster.prevDate, today) ? posterPath(poster.prevDate) : null;
  const nextDate = date < latest ? nextTradingDay(date, holidays) : null;
  const nextHref = nextDate && nextDate <= latest ? posterPath(nextDate) : null;

  return (
    <DayPosterView
      poster={poster}
      scene={scene}
      fetchedAt={fetchedAt}
      prevHref={prevHref}
      nextHref={nextHref}
      locale={locale}
      t={t}
    />
  );
}
