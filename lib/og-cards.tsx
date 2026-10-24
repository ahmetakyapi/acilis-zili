import { ImageResponse } from "next/og";
import {
  C,
  Chip,
  OG_SIZE,
  OgBars,
  OgFrame,
  OgKicker,
  OgStats,
  OgTitle,
  OgTrend,
  Tri,
  clip,
  ogFonts,
  signColor,
} from "@/lib/og";
import { ogCloseSeries, ogQuoteStamp, seriesChangePct } from "@/lib/og-series";
import { getStatus, getStoryBySlug, getSymbolNames } from "@/lib/data";
import { getChartBars, getQuotes } from "@/lib/providers";
import { getDictionary, type Locale } from "@/lib/i18n";
import { parseBlocks } from "@/components/article/parse-blocks";
import { storyOgFigure } from "@/lib/story-signature";
import {
  formatMoneyCompact,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  titleCaseLabel,
} from "@/lib/utils";
import { industryLabel, sectorGroupLabel, sectorGroupOf } from "@/lib/sectors";

/* ==========================================================================
   Veri taşıyan paylaşım kartları — hisse ve Mercek yazısı (24 Ekim)

   Kartın kendisi rota dosyasındaydı; DİL PARAMETRESİYLE buraya taşındı.
   Rotalar dili hâlâ sabit veriyor (gerekçe `lib/og.tsx` başı: paylaşım
   adresi önek taşımıyor), ama kartın İngilizcesi artık bir çağrı uzakta —
   dil adrese girdiği gün rota yalnız `params.locale`i geçirecek. Bugün
   İngilizce kart yalnız ölçümde çiziliyor.

   Ortak çerçeve, renkler ve Satori sınırları `lib/og.tsx`te.
   ========================================================================== */

/**
 * Hisse kartı — fiyat, seans künyesi, son bir ayın kapanış çizgisi.
 *
 * Fiyat CANLI çekiliyor ama kart paylaşıldıktan sonra günlerce dolaşıyor;
 * bu yüzden fiyatın hemen altında HANGİ SEANSI anlattığı ve işlemin günü
 * ile saati yazılı ("24 Eki · Seans Kapanışı · 23:00 TR" — `ogQuoteStamp`).
 * Yön rengi yalnız künye bugünü anlatıyorsa: "Son Kapanış" nötr.
 *
 * Sağlayıcı yanıt vermezse fiyat bloğu, bar gelmezse grafik hiç basılmıyor —
 * yerinde iskelet bırakmak yanlış sayı göstermekten de kötü.
 */
export async function stockOgImage(symbol: string, locale: Locale) {
  const t = getDictionary(locale);
  const fonts = await ogFonts();

  const status = await getStatus();
  const [meta, quotes, bars] = await Promise.all([
    getSymbolNames([symbol]),
    getQuotes([symbol], status),
    getChartBars(symbol, "1M", status),
  ]);
  const info = meta[symbol];
  const quote = quotes.ok ? quotes.data[symbol] : undefined;
  const stamp = quote
    ? ogQuoteStamp(quote, quotes.ok ? Boolean(quotes.stale) : false, status, locale, {
        ...t.companyCard,
        lastPrice: t.market.lastPrice,
      })
    : null;
  /* Yön rengi yalnız bugünü anlatan künyede (şirket kartıyla aynı kural). */
  const dayColor = stamp?.live ? signColor(quote?.changePct) : C.body;
  const dayUp = (quote?.changePct ?? 0) >= 0;

  /* Eski seriyi çizgi olarak basmıyoruz: kendini eski ilan etmiş seri
     (`stale`) bugünün kartında "son bir ay" diyemez (Veri dürüstlüğü 2). */
  const series = bars.ok && !bars.stale ? ogCloseSeries(bars.data, quote) : [];
  const trend = series.length > 2 ? series : null;
  const trendPct = trend ? seriesChangePct(trend) : null;

  /* Sektör dile göre: sağlayıcı "Technology" gibi İngilizce alan döndürüyor,
     sitenin geri kalanı bunu `industryLabel` ile çeviriyor. */
  const sector = industryLabel(info?.industry, locale);
  const group = sectorGroupLabel(sectorGroupOf(info?.industry), locale);
  const name = info?.name ?? symbol;

  return new ImageResponse(
    (
      <OgFrame
        eyebrow={t.nav.companies}
        accent={
          quote && stamp ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <span
                style={{
                  fontSize: 58,
                  fontWeight: 700,
                  letterSpacing: "-0.04em",
                  color: C.strong,
                  lineHeight: 1,
                }}
              >
                {formatPrice(quote.price, locale, { currency: true })}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 28, fontWeight: 700, color: dayColor }}>
                <Tri up={dayUp} color={dayColor} />
                {formatPercentPlain(quote.changePct, locale, 2)}
              </div>
              {/* SEANS KÜNYESİ — kart bayatlar, künyesi bayatlamaz. */}
              <span style={{ display: "flex", fontSize: 20, fontWeight: 700, color: C.muted }}>
                {stamp.text}
              </span>
            </div>
          ) : undefined
        }
        footer={
          <>
            <Chip tone="primary">{symbol}</Chip>
            {sector && <Chip>{clip(sector, 30)}</Chip>}
            {info?.marketCap ? <Chip>{`≈ ${formatMoneyCompact(info.marketCap, locale)}`}</Chip> : null}
          </>
        }
      >
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minWidth: 0 }}>
            <OgTitle size={trend ? (name.length > 20 ? 48 : 60) : name.length > 24 ? 54 : 68}>
              {clip(name, trend ? 40 : 36)}
            </OgTitle>
            {/* Başlığın altı boş kalmasın: sektör grubu kartın ne hakkında
                olduğunu bir kelimede söylüyor. */}
            <div style={{ fontSize: 28, color: C.body, display: "flex" }}>{group}</div>
          </div>
          {trend && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <OgKicker>{t.ogCard.monthTrend}</OgKicker>
                {trendPct !== null && (
                  <span style={{ display: "flex", fontSize: 22, fontWeight: 700, color: signColor(trendPct) }}>
                    {formatPercent(trendPct, locale, 1)}
                  </span>
                )}
              </div>
              <OgTrend series={trend} />
            </div>
          )}
        </div>
      </OgFrame>
    ),
    { ...OG_SIZE, fonts },
  );
}

/** Mercek yazısının kartı — başlık ve yazının rakamları (yoksa spot). */
export async function storyOgImage(slug: string, locale: Locale) {
  const t = getDictionary(locale);
  const [story, fonts] = await Promise.all([getStoryBySlug(slug, locale), ogFonts()]);

  const title = story?.title ?? t.nav.stories;
  /* Yazı bu dilde yoksa orijinali geliyor; künyeler o metnin dilinde. */
  const textLocale = story?.locale ?? locale;
  const figure = story ? storyOgFigure(parseBlocks(story.bodyMd, textLocale)) : null;

  return new ImageResponse(
    (
      <OgFrame eyebrow={t.nav.stories}>
        <OgTitle
          size={
            figure
              ? title.length > 60 ? 42 : title.length > 36 ? 48 : 56
              : title.length > 46 ? 50 : title.length > 28 ? 60 : 70
          }
        >
          {clip(title, figure ? 96 : 88)}
        </OgTitle>
        {figure ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 6 }}>
            {figure.label && <OgKicker>{clip(figure.label, 60)}</OgKicker>}
            {figure.kind === "stats" ? (
              <OgStats
                items={figure.items.slice(0, 4).map((item) => ({
                  value: titleCaseLabel(item.value, textLocale),
                  note: titleCaseLabel(item.note, textLocale),
                }))}
              />
            ) : (
              <OgBars items={figure.items.slice(0, 3)} neutral={figure.neutral === true} />
            )}
          </div>
        ) : (
          story?.dek && (
            <div style={{ fontSize: 28, lineHeight: 1.34, color: C.body, display: "flex", maxWidth: 980 }}>
              {clip(story.dek, 150)}
            </div>
          )
        )}
      </OgFrame>
    ),
    { ...OG_SIZE, fonts },
  );
}
