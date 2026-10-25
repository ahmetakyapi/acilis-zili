import { ImageResponse } from "next/og";
import { posterName, posterStoryText } from "@/components/day-poster/story";
import { POSTER_OG_SIZE, parsePosterDate, type DayPoster } from "@/lib/day-poster";
import { getDayPoster, getPosterSceneStocks } from "@/lib/day-poster-data";
import { SWARM_MODES, fitSwarm, swarmDomain, swarmExtremes, type SceneStock, type SwarmLayout } from "@/lib/day-poster-scene";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { todayEt } from "@/lib/market-hours";
import { C, OG_CONTENT_TYPE, OgFrame, OgTitle, Tri, ogFonts } from "@/lib/og";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { formatEtDateLong, formatPercentPlain } from "@/lib/utils";

/**
 * GÜNÜN POSTERİ — paylaşım görseli, `/gun/2026-10-23/gorsel` (24 Ekim;
 * 25 Ekim'de sahneyle yeniden kuruldu).
 *
 * GÖRSEL SAHNENİN DURAĞAN KOPYASI: sayfadaki gibi her hisse bir nokta,
 * sektör sektör, aynı yerleşimle (`lib/day-poster-scene.ts`; satori SVG
 * `circle` basabiliyor). Yanında günün cümlesi ve genişlik. Önceki kart on
 * bir sektör kulvarıydı; paylaşılan görselde sahnenin kendisi yoktu.
 *
 * İKİ BİÇİM: varsayılan 1200×630 (bağlantı kartı; sayfanın `og:image`i) ve
 * `?bicim=dikey` 1080×1350 (telefonda paylaşılan dikey kart, Instagram
 * gönderi oranı). Sahne kutuya `fitSwarm` ile sığıyor: yarıçaplar adım adım
 * küçülüyor, x'ler (yani değişimler) hiç oynamıyor. Etiket yok: uç hisseler
 * yanda adıyla yazılı, satırların adı solda.
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

/** Biçimlerin sahne kutusu (piksel): sektör adı sütunu + nokta alanı. */
const FORMATS = {
  wide: { mode: "og", label: 150, swarm: 500, height: 392, labelSize: 12, extremes: 2 },
  tall: { mode: "ogTall", label: 200, swarm: 690, height: 800, labelSize: 17, extremes: 3 },
} as const;
type Format = keyof typeof FORMATS;

function percent(value: number, locale: Locale) {
  return formatPercentPlain(value, locale, PERCENT_DIGITS);
}

function signed(value: number, locale: Locale) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${percent(value, locale)}`;
}

const tone = (change: number) => (change > 0 ? C.up : change < 0 ? C.down : C.muted);

/** Ölçek dışı noktanın dış halkasıyla arasındaki boşluk (sahne birimi). */
const CLIP_RING_GAP = 2.2;

/** Sahne: satır satır — adı solda, noktaları kendi SVG'sinde (sayfadaki
 *  satırın aynısı). Satırın boyu yerleşimden, ad ortada ve tek satır. */
function Scene({
  layout,
  stocks,
  names,
  format,
}: {
  layout: SwarmLayout;
  stocks: SceneStock[];
  names: (symbol: string) => string;
  format: Format;
}) {
  const f = FORMATS[format];
  const k = f.swarm / layout.width;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {layout.rows.map((row, index) => (
        <div
          key={row.sector}
          style={{
            display: "flex",
            alignItems: "center",
            height: row.height * k,
            borderTop: index === 0 ? "none" : `1px solid ${C.lineSoft}`,
          }}
        >
          <span
            style={{
              display: "flex",
              width: f.label,
              fontSize: f.labelSize,
              fontWeight: 700,
              color: C.strong,
              whiteSpace: "nowrap",
            }}
          >
            {names(row.sector)}
          </span>
          <svg width={f.swarm} height={row.height * k} viewBox={`0 0 ${layout.width} ${row.height}`}>
            <line x1={layout.zeroX} x2={layout.zeroX} y1={0} y2={row.height} stroke={C.muted} strokeWidth={1.5 / k} />
            {/* Ölçek dışı: sayfadaki gibi tam opak nokta + nötr mürekkep
                halka (PosterStage.module.css → `.clipRing`). */}
            {row.dots.map((dot) =>
              dot.clip === 0 ? (
                <circle key={dot.i} cx={dot.x} cy={dot.y} r={dot.r} fill={tone(stocks[dot.i].change)} fillOpacity={0.88} />
              ) : (
                <g key={dot.i}>
                  <circle cx={dot.x} cy={dot.y} r={dot.r} fill={tone(stocks[dot.i].change)} />
                  <circle cx={dot.x} cy={dot.y} r={dot.r + CLIP_RING_GAP} fill="none" stroke={C.strong} strokeWidth={1.5 / k} />
                </g>
              ),
            )}
          </svg>
        </div>
      ))}
    </div>
  );
}

function PosterCard({
  poster,
  stocks,
  format,
  locale,
  t,
}: {
  poster: DayPoster;
  stocks: SceneStock[];
  format: Format;
  locale: Locale;
  t: Dictionary;
}) {
  const S = t.daySignature;
  const f = FORMATS[format];
  const story = posterStoryText(poster, locale, t);
  const anchor = poster.indices.find((move) => move.symbol === "SPY");
  const b = poster.breadth;
  const names = (symbol: string) => posterName(symbol, locale);
  const layout = fitSwarm(
    {
      stocks,
      sectorOrder: poster.sectors.map((move) => move.symbol),
      mode: f.mode,
      domain: swarmDomain(stocks.map((stock) => stock.change)),
    },
    f.height / (f.swarm / SWARM_MODES[f.mode].width),
  );
  const ext = swarmExtremes(stocks, f.extremes);
  const tall = format === "tall";

  const breadth = b && (
    <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
      <span style={{ display: "flex", fontSize: tall ? 54 : 40, fontWeight: 800, letterSpacing: "-0.04em", color: C.up }}>
        {b.advancing}
      </span>
      <span style={{ display: "flex", fontSize: tall ? 24 : 18, fontWeight: 700, color: C.strong }}>{S.stage.axisUp}</span>
      <span style={{ display: "flex", width: 10 }} />
      <span style={{ display: "flex", fontSize: tall ? 54 : 40, fontWeight: 800, letterSpacing: "-0.04em", color: C.down }}>
        {b.declining}
      </span>
      <span style={{ display: "flex", fontSize: tall ? 24 : 18, fontWeight: 700, color: C.strong }}>{S.stage.axisDown}</span>
    </div>
  );
  const spy = anchor && (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ display: "flex", fontSize: tall ? 24 : 17, fontWeight: 700, color: C.muted }}>{posterName("SPY", locale)}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: tall ? 30 : 22, fontWeight: 800, color: tone(anchor.change) }}>
        {anchor.change !== 0 && <Tri up={anchor.change > 0} color={tone(anchor.change)} />}
        {percent(anchor.change, locale)}
      </span>
    </div>
  );
  /* Günün uçları iki sütun: yükselenler | düşenler. */
  const column = (list: number[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: tall ? 6 : 4 }}>
      {list.map((i) => (
        <div key={stocks[i].symbol} style={{ display: "flex", gap: 10, fontSize: tall ? 21 : 15, fontWeight: 700 }}>
          <span style={{ display: "flex", color: C.strong, width: tall ? 76 : 54 }}>{stocks[i].symbol}</span>
          <span style={{ display: "flex", color: tone(stocks[i].change) }}>{signed(stocks[i].change, locale)}</span>
        </div>
      ))}
    </div>
  );
  const extremes = (
    <div style={{ display: "flex", gap: tall ? 48 : 28 }}>
      {ext.up.length > 0 && column(ext.up)}
      {ext.down.length > 0 && column(ext.down)}
    </div>
  );

  if (tall) {
    return (
      <OgFrame eyebrow={`${S.poster.title} · ${formatEtDateLong(poster.date, locale)}`} rail={<div style={{ display: "flex" }} />}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <OgTitle size={64}>{story.title}</OgTitle>
          <span style={{ display: "flex", fontSize: 28, lineHeight: 1.3, fontWeight: 700, color: C.body }}>{story.detail}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          {breadth}
          {spy}
        </div>
        <Scene layout={layout} stocks={stocks} names={names} format={format} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          {extremes}
          <span style={{ display: "flex", fontSize: 18, color: C.muted, fontWeight: 600 }}>{S.stage.legendSize}</span>
        </div>
      </OgFrame>
    );
  }

  return (
    <OgFrame eyebrow={`${S.poster.title} · ${formatEtDateLong(poster.date, locale)}`} rail={<div style={{ display: "flex" }} />}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 340 }}>
          <OgTitle size={44}>{story.title}</OgTitle>
          <span style={{ display: "flex", fontSize: 19, lineHeight: 1.3, fontWeight: 700, color: C.body }}>{story.detail}</span>
          {breadth}
          {spy}
          {extremes}
        </div>
        <Scene layout={layout} stocks={stocks} names={names} format={format} />
      </div>
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
  const [{ locale, t }, scene] = await Promise.all([getI18n(), getPosterSceneStocks(read.poster)]);
  const image = new ImageResponse(
    <PosterCard poster={read.poster} stocks={scene.stocks} format={format} locale={locale} t={t} />,
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
