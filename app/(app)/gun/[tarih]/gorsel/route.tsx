import { ImageResponse } from "next/og";
import { posterName, posterStoryText } from "@/components/day-poster/story";
import { POSTER_ANCHOR, POSTER_OG_SIZE, parsePosterDate, type DayPoster } from "@/lib/day-poster";
import { getDayPoster, getPosterSkyline, type PosterSkyline } from "@/lib/day-poster-data";
import { loadWeekLogos } from "@/lib/earnings-week-og";
import { SKY_MODES, buildingPath, skylineLayout, type SkyLayout, type SkyStock } from "@/lib/day-skyline";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { todayEt } from "@/lib/market-hours";
import { C, OG_CONTENT_TYPE, OgFrame, OgTitle, Tri, ogFonts } from "@/lib/og";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { formatEtDateLong, formatPercentPlain } from "@/lib/utils";

/**
 * GÜNÜN POSTERİ — paylaşım görseli, `/gun/2026-10-23/gorsel` (24 Ekim;
 * 25 Ekim'de siluetle yeniden kuruldu).
 *
 * GÖRSEL SİLUETİN DURAĞAN KOPYASI: sayfadaki gibi Nasdaq 100'ün yüz
 * şirketi birer bina, aynı yerleşimle (`lib/day-skyline.ts`, `og` ve
 * `ogTall` düzenleri); büyük şirketlerin ve günün uçlarının çatısında
 * logo, sembol ve yüzde. Üstünde günün cümlesi, Nasdaq 100'ün değişimi
 * ve genişlik; altında mahalle adları.
 *
 * ETİKETLER SVG'NİN DIŞINDA, HTML. Satori SVG'yi resme çevirirken içindeki
 * `<text>`e yazı tipi vermiyor; binalar SVG, etiket ve mahalle adları aynı
 * ölçekle (`k`) üstüne konan kutular. Logolar depodaki webp'lerin PNG
 * veri adresi (`loadWeekLogos`; satori webp çözmüyor).
 *
 * İKİ BİÇİM: varsayılan 1200×630 (bağlantı kartı; sayfanın `og:image`i) ve
 * `?bicim=dikey` 1080×1350 (telefonda paylaşılan dikey kart, Instagram
 * gönderi oranı). Siluet kutuya oranıyla sığıyor: en dar boyut seçiliyor
 * (`k`), şekil hiç bozulmuyor.
 *
 * Route Handler, dosya tabanlı `opengraph-image` değil: dili adresin
 * önekinden okuyabilsin diye (gerekçe `bilancolar/hafta/gorsel/route.tsx`;
 * sayfa `og:image`i bu adrese kendisi veriyor). `robots.txt` `/api/`i
 * engellediği için `/api` altında değil (`app/gun/[tarih]/kart`).
 */

/** Geçmiş bir seansın görseli değişmiyor: bir gün. */
const CACHE_SECONDS = 86_400;
/** Oran sınırı — kardeşi `/gun/[tarih]/kart` ile aynı gerekçe ve değer. */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

/** Dikey kart — 4:5. */
const TALL_SIZE = { width: 1080, height: 1350 } as const;

const PERCENT_DIGITS = 2;

/** Biçimlerin siluet kutusu (piksel) ve yazı ölçüleri. Kutu kartın iç
 *  alanından: 1200 − 2×40 çerçeve − 2×52 dolgu = 1016; yükseklik başlık ve
 *  mahalle adlarından artan. */
const FORMATS = {
  wide: { mode: "og", boxW: 1016, boxH: 236, district: 15, gap: 8 },
  tall: { mode: "ogTall", boxW: 896, boxH: 760, district: 20, gap: 14 },
} as const;
type Format = keyof typeof FORMATS;

/** Satori renkleri — açık tema (`C`), su `--primary-tint` karşılığı. */
const INK = { up: C.up, down: C.down, flat: C.muted, horizon: "#c9d2dc", water: C.primaryTint };
/** Bağ çizgisinin çatıdaki noktası (sahne birimi) — sayfadaki gibi
 *  (`SkyMarks`): etiket binasından kaydıysa bağ ve nokta görünür. */
const LEADER_DOT = 2.4;
/** Mahalle tabelasının yüksekliği (piksel, ad + değer). */
const DISTRICT_ROW = { wide: 40, tall: 54 } as const;

function percent(value: number, locale: Locale) {
  return formatPercentPlain(value, locale, PERCENT_DIGITS);
}

function signed(value: number, locale: Locale) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${percent(value, locale)}`;
}

const tone = (change: number) => (change > 0 ? C.up : change < 0 ? C.down : C.muted);

/** Siluet: sıra sıra — binalar SVG, etiketler ve mahalle adları üstünde. */
function Scene({
  layout,
  stocks,
  names,
  logos,
  format,
  locale,
}: {
  layout: SkyLayout;
  stocks: SkyStock[];
  names: (key: string) => string;
  logos: Map<string, string>;
  format: Format;
  locale: Locale;
}) {
  const f = FORMATS[format];
  const mode = SKY_MODES[layout.mode];
  const total = layout.rows.reduce((acc, row) => acc + row.bottom - row.top, 0);
  const districtH = DISTRICT_ROW[format] * layout.rows.length;
  const k = Math.min(f.boxW / layout.width, (f.boxH - districtH - f.gap * (layout.rows.length - 1)) / total);
  const w = layout.width * k;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: f.gap }}>
      {layout.rows.map((row, r) => {
        const h = (row.bottom - row.top) * k;
        return (
          <div key={r} style={{ display: "flex", flexDirection: "column", width: w }}>
            <div style={{ display: "flex", position: "relative", width: w, height: h }}>
              <svg width={w} height={h} viewBox={`0 ${row.top} ${layout.width} ${row.bottom - row.top}`}>
                <rect x={0} y={0} width={layout.width} height={row.downH} fill={INK.water} />
                {row.buildings.map((b) => (
                  <path
                    key={b.i}
                    d={buildingPath(b)}
                    fill={b.dir === 1 ? INK.up : b.dir === -1 ? INK.down : INK.flat}
                    fillOpacity={b.dir === -1 ? 0.84 : 1}
                  />
                ))}
                <line x1={0} x2={layout.width} y1={0} y2={0} stroke={INK.horizon} strokeWidth={1.4 / k} />
                {row.labels.flatMap((label) =>
                  label.leader
                    ? [
                        <line
                          key={`l${label.i}`}
                          x1={label.leader.x1}
                          y1={label.leader.y1}
                          x2={label.leader.x2}
                          y2={label.leader.y2}
                          stroke={C.muted}
                          strokeWidth={1.2 / k}
                        />,
                        <circle key={`d${label.i}`} cx={label.leader.x1} cy={label.leader.y1} r={LEADER_DOT} fill={C.muted} />,
                      ]
                    : [],
                )}
              </svg>
              {row.labels.map((label) => {
                const stock = stocks[label.i];
                const logo = logos.get(stock.symbol);
                const size = mode.logo * k;
                return (
                  <div
                    key={label.i}
                    style={{
                      position: "absolute",
                      left: label.x * k,
                      top: (label.y - row.top) * k,
                      width: label.w * k,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      fontSize: mode.font * k,
                      lineHeight: 1.15,
                      fontWeight: 700,
                    }}
                  >
                    {logo ? (
                      /* `<img>` değil zemin görseli — gerekçe
                         `lib/earnings-week-og.tsx` (lint kuralı Satori
                         ağacını da tarıyor). */
                      <div
                        style={{
                          display: "flex",
                          width: size,
                          height: size,
                          borderRadius: size,
                          overflow: "hidden",
                          backgroundColor: C.surface,
                          border: `1px solid ${C.line}`,
                          backgroundImage: `url(${logo})`,
                          backgroundSize: `${size}px ${size}px`,
                          backgroundRepeat: "no-repeat",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: size,
                          height: size,
                          borderRadius: size,
                          background: C.lineSoft,
                          color: C.muted,
                          fontSize: size * 0.38,
                        }}
                      >
                        {stock.symbol.slice(0, 2)}
                      </div>
                    )}
                    <span style={{ display: "flex", marginTop: 2, color: C.strong }}>{stock.symbol}</span>
                    <span style={{ display: "flex", color: tone(stock.change) }}>{signed(stock.change, locale)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", position: "relative", width: w, height: DISTRICT_ROW[format] }}>
              {row.districts.map((span) => (
                <div
                  key={span.key}
                  style={{
                    position: "absolute",
                    left: span.x0 * k,
                    width: (span.x1 - span.x0) * k,
                    top: 6,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    borderTop: `1px solid ${INK.horizon}`,
                    paddingTop: 4,
                    fontSize: f.district,
                    lineHeight: 1.15,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ display: "flex", color: C.strong, textAlign: "center" }}>{names(span.key)}</span>
                  <span style={{ display: "flex", color: tone(span.change) }}>{signed(span.change, locale)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PosterCard({
  poster,
  skyline,
  logos,
  format,
  locale,
  t,
}: {
  poster: DayPoster;
  skyline: PosterSkyline;
  logos: Map<string, string>;
  format: Format;
  locale: Locale;
  t: Dictionary;
}) {
  const S = t.daySignature;
  const f = FORMATS[format];
  const story = posterStoryText(poster, skyline.districts, locale, t);
  const anchor = poster.indices.find((move) => move.symbol === POSTER_ANCHOR);
  const b = poster.breadth;
  const names = (key: string) => posterName(key, locale);
  const layout = skylineLayout({ stocks: skyline.stocks, districts: skyline.districts, mode: f.mode });
  const tall = format === "tall";

  const figures = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: tall ? "flex-start" : "flex-end", gap: 6 }}>
      {anchor && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "flex", fontSize: tall ? 26 : 18, fontWeight: 700, color: C.strong }}>{S.skyline.figIndex}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: tall ? 44 : 34, fontWeight: 800, letterSpacing: "-0.04em", color: tone(anchor.change) }}>
            {anchor.change !== 0 && <Tri up={anchor.change > 0} color={tone(anchor.change)} />}
            {percent(anchor.change, locale)}
          </span>
        </div>
      )}
      {b && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: tall ? 24 : 18, fontWeight: 700 }}>
          <span style={{ display: "flex", color: C.up }}>{S.seal.advancing.replace("{n}", String(b.advancing))}</span>
          <span style={{ display: "flex", color: C.down }}>{S.seal.declining.replace("{n}", String(b.declining))}</span>
        </div>
      )}
    </div>
  );
  const legend = (
    <span style={{ display: "flex", fontSize: tall ? 18 : 14, color: C.muted, fontWeight: 600 }}>
      {`${S.skyline.legendWidth} · ${S.skyline.legendHeight}`}
    </span>
  );
  const scene = <Scene layout={layout} stocks={skyline.stocks} names={names} logos={logos} format={format} locale={locale} />;

  if (tall) {
    return (
      <OgFrame eyebrow={`${S.poster.title} · ${formatEtDateLong(poster.date, locale)}`} rail={legend}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <OgTitle size={64}>{story.title}</OgTitle>
          <span style={{ display: "flex", fontSize: 28, lineHeight: 1.3, fontWeight: 700, color: C.body }}>{story.detail}</span>
        </div>
        {figures}
        {scene}
      </OgFrame>
    );
  }

  return (
    <OgFrame eyebrow={`${S.poster.title} · ${formatEtDateLong(poster.date, locale)}`} rail={<div style={{ display: "flex" }} />}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 640 }}>
          <OgTitle size={42}>{story.title}</OgTitle>
          <span style={{ display: "flex", fontSize: 19, lineHeight: 1.3, fontWeight: 700, color: C.body }}>{story.detail}</span>
        </div>
        {figures}
      </div>
      {scene}
    </OgFrame>
  );
}

export async function GET(request: Request, context: RouteContext<"/gun/[tarih]/gorsel">) {
  const gate = rateLimit(clientKey(request, "gun-gorsel"), RATE_LIMIT, RATE_WINDOW_MS);
  if (!gate.allowed) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(gate.retryAfter) } });
  }
  const { tarih } = await context.params;
  const date = parsePosterDate(tarih, todayEt());
  if (!date) return new Response("Not Found", { status: 404 });
  const read = await getDayPoster(date);
  if (read.state === "missing") return new Response("Not Found", { status: 404 });
  if (read.state === "error") return new Response(null, { status: 503 });

  const format: Format = new URL(request.url).searchParams.get("bicim") === "dikey" ? "tall" : "wide";
  const [{ locale, t }, skyline] = await Promise.all([getI18n(), getPosterSkyline(read.poster)]);
  /* Logolar yalnız etiketli binalar için (en çok ~10). */
  const layout = skylineLayout({ stocks: skyline.stocks, districts: skyline.districts, mode: FORMATS[format].mode });
  const logos = await loadWeekLogos(layout.rows.flatMap((row) => row.labels.map((label) => skyline.stocks[label.i].symbol)));
  const image = new ImageResponse(
    <PosterCard poster={read.poster} skyline={skyline} logos={logos} format={format} locale={locale} t={t} />,
    { ...(format === "tall" ? TALL_SIZE : POSTER_OG_SIZE), fonts: await ogFonts() },
  );
  image.headers.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
  image.headers.set("Content-Type", OG_CONTENT_TYPE);
  /* Öneksiz adreste dil çerezden okunuyor (`getI18n`): paylaşılan bir
     önbellek Türkçe görseli İngilizce tercihli okuyucuya vermesin —
     kardeşleri `bilancolar/hafta/gorsel`, `gunun-grafigi/[tarih]/gorsel`. */
  image.headers.set("Vary", "Cookie");
  return image;
}
