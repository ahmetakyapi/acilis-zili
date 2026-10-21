import { ImageResponse } from "next/og";
import { getI18n } from "@/lib/i18n";
import { ogFonts } from "@/lib/og";
import { todayEt } from "@/lib/market-hours";
import { defaultWeekStart, parseWeekParam } from "@/lib/earnings-week";
import { getEarningsWeek } from "@/lib/earnings-week-data";
import { loadWeekLogos, WEEK_OG_SIZES, WeekOgCard, type WeekOgSize } from "@/lib/earnings-week-og";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Haftalık Bilanço Takvimi görseli — `?boyut=yatay|dikey&hafta=YYYY-MM-DD`.
 *
 * DOSYA TABANLI `opengraph-image` DEĞİL, ROUTE HANDLER. O kural sorgu
 * parametresi görmüyor: kart hangi haftayı çizeceğini bilemezdi ve
 * `?hafta=` ile paylaşılan her adres varsayılan haftanın görselini
 * taşırdı. Burada hafta adresten okunuyor; sayfa `og:image`i bu adrese
 * kendisi veriyor.
 *
 * DİL İSTEKTEN. `lib/og.tsx`in "kart rotaları dili istekten okumuyor"
 * notu dosya tabanlı rotalar için: onların adresini Next öneksiz üretiyor.
 * Bu adresi sayfa kendisi kuruyor ve dili önekte taşıyor
 * (`/en/bilancolar/hafta/gorsel`), proxy de başlığı ekliyor — yani burada
 * `getI18n()` gerçekten `en` dönebiliyor.
 */

/** Bir saat — takvim günde bir tazeleniyor, kartı her istekte çizmeye gerek yok. */
const CACHE_SECONDS = 3600;

function sizeOf(value: string | null): WeekOgSize {
  return value === "dikey" ? "portrait" : "landscape";
}

export async function GET(request: Request) {
  /* ORAN SINIRI (20 Ekim). Uç herkese açık ve her istek bir veritabanı
     okuması, logo dönüşümü ve Satori/resvg çizimi; `?hafta=` her geçerli
     tarihi kabul ettiği için yüz binlerce ayrı adres var ve her biri
     önbellek ıskası (`Cache-Control: public` kökte işe yaramıyor: Caddy
     önbelleklemiyor). Tek döngü tek Node sürecini çizime kilitleyebiliyordu.
     Kardeşi `/gun/[tarih]/kart` aynı gerekçeyle sınırlı (15 Ekim); sayfanın
     her görüntülenmesi İKİ görsel istediği için (yatay + dikey) sınır onun
     30'unun üstünde: haftalar arasında gezinen okuyucuya bol. */
  const gate = rateLimit(clientKey(request, "hafta-gorsel"), 40, 60_000);
  if (!gate.allowed) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(gate.retryAfter) } });
  }

  const url = new URL(request.url);
  const size = sizeOf(url.searchParams.get("boyut"));
  const monday = parseWeekParam(url.searchParams.get("hafta")) ?? defaultWeekStart(todayEt());

  const { locale, t } = await getI18n();
  const week = await getEarningsWeek(monday, locale);
  const symbols = week.days.flatMap((day) => [...day.bmo, ...day.amc, ...day.other]).map((row) => row.symbol);
  const [logos, fonts] = await Promise.all([loadWeekLogos(symbols), ogFonts()]);

  return new ImageResponse(
    <WeekOgCard week={week} logos={logos} size={size} locale={locale} t={t} />,
    {
      ...WEEK_OG_SIZES[size],
      fonts,
      headers: {
        "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
        /* Öneksiz adreste dil çerezden okunabiliyor: paylaşılan bir önbellek
           Türkçe kartı İngilizce tercihli okuyucuya vermesin. */
        Vary: "Cookie",
      },
    },
  );
}
