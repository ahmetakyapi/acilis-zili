import { ImageResponse } from "next/og";
import { SECTOR_FUNDS } from "@/db/seed/symbols";
import { CARD_INDEX_NAMES } from "@/lib/day-card";
import { POSTER_OG_SIZE, parsePosterDate, posterScale, type DayPoster, type PosterMove } from "@/lib/day-poster";
import { getDayPoster } from "@/lib/day-poster-data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { todayEt } from "@/lib/market-hours";
import { C, OG_CONTENT_TYPE, OgFrame, OgTitle, Tri, ogFonts } from "@/lib/og";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { formatEtDateLong, formatPercentPlain } from "@/lib/utils";

/**
 * GÜNÜN POSTERİ — paylaşım görseli, `/gun/2026-10-23/gorsel` (24 Ekim).
 *
 * Satori tuval çizemiyor; mürekkep sahnesinin AYNI VERİSİ burada düz
 * şeritlerle basılıyor: üstte genişlik çubuğu (yükselen / değişmeyen /
 * düşen, boy sayıyla), altında on bir sektör kulvarı ve dört endeks
 * kulvarı, sahneyle aynı sıra ve aynı ölçek (`posterScale`). Sağda okunan
 * künye: S&P 500, günün en güçlü ve en zayıf sektörü. Veri sayfayla tek
 * kaynaktan (`getDayPoster`).
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

const LANE_W = 600;
const LANE_H = 7;
const LANE_GAP = 6;
const PERCENT_DIGITS = 2;

function percent(value: number, locale: Locale) {
  return formatPercentPlain(value, locale, PERCENT_DIGITS);
}

function Lane({ move, scale }: { move: PosterMove; scale: number }) {
  const half = LANE_W / 2;
  const length = (Math.min(Math.abs(move.change), scale) / scale) * half;
  const up = move.change >= 0;
  return (
    <div style={{ display: "flex", position: "relative", width: LANE_W, height: LANE_H, borderRadius: 99, background: C.lineSoft }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: up ? half : half - length,
          width: Math.max(1, length),
          height: LANE_H,
          borderRadius: 99,
          background: up ? C.up : C.down,
        }}
      />
    </div>
  );
}

function Figure({ label, move, locale, big }: { label: string; move: PosterMove; locale: Locale; big?: boolean }) {
  const up = move.change > 0;
  const flat = move.change === 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ display: "flex", fontSize: 20, fontWeight: 700, color: C.muted }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: big ? 44 : 30, fontWeight: 700, color: flat ? C.strong : up ? C.up : C.down }}>
        {!flat && <Tri up={up} color={up ? C.up : C.down} />}
        {percent(move.change, locale)}
      </span>
    </div>
  );
}

function PosterCard({ poster, locale, t }: { poster: DayPoster; locale: Locale; t: Dictionary }) {
  const S = t.daySignature;
  const scale = posterScale(poster);
  const zeroLeft = LANE_W / 2;
  const sectorName = (symbol: string) => {
    const fund = SECTOR_FUNDS.find((entry) => entry.symbol === symbol);
    return fund ? (locale === "tr" ? fund.nameTr : fund.nameEn) : symbol;
  };
  const anchor = poster.indices.find((move) => move.symbol === "SPY");
  const strongest = poster.sectors[0];
  const weakest = poster.sectors[poster.sectors.length - 1];
  const b = poster.breadth;
  const total = b ? b.known : 0;

  return (
    <OgFrame eyebrow={S.poster.title}>
      <OgTitle size={46}>{formatEtDateLong(poster.date, locale)}</OgTitle>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 40 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {b && total > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ display: "flex", fontSize: 20, fontWeight: 700, color: C.body }}>
                {`${S.seal.breadth} · ${S.seal.advancing.replace("{n}", String(b.advancing))} · ${S.seal.declining.replace("{n}", String(b.declining))}`}
              </span>
              <div style={{ display: "flex", width: LANE_W, height: 10, borderRadius: 99, overflow: "hidden", background: C.lineSoft }}>
                <div style={{ width: (b.advancing / total) * LANE_W, height: 10, background: C.up }} />
                <div style={{ width: (b.unchanged / total) * LANE_W, height: 10, background: C.line }} />
                <div style={{ width: (b.declining / total) * LANE_W, height: 10, background: C.down }} />
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: LANE_GAP, position: "relative" }}>
            {poster.sectors.map((move) => (
              <Lane key={move.symbol} move={move} scale={scale} />
            ))}
            <div style={{ display: "flex", height: LANE_GAP }} />
            {poster.indices.map((move) => (
              <Lane key={move.symbol} move={move} scale={scale} />
            ))}
            <div style={{ position: "absolute", top: -4, bottom: -4, left: zeroLeft, width: 2, background: C.muted }} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, width: 380 }}>
          {anchor && <Figure label={CARD_INDEX_NAMES.SPY} move={anchor} locale={locale} big />}
          {strongest && <Figure label={sectorName(strongest.symbol)} move={strongest} locale={locale} />}
          {weakest && weakest !== strongest && <Figure label={sectorName(weakest.symbol)} move={weakest} locale={locale} />}
        </div>
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

  const { locale, t } = await getI18n();
  const image = new ImageResponse(<PosterCard poster={read.poster} locale={locale} t={t} />, {
    ...POSTER_OG_SIZE,
    fonts: await ogFonts(),
  });
  image.headers.set("Cache-Control", `public, max-age=${CACHE_SECONDS}`);
  image.headers.set("Content-Type", OG_CONTENT_TYPE);
  /* Öneksiz adreste dil çerezden okunuyor (`getI18n`): paylaşılan bir
     önbellek Türkçe görseli İngilizce tercihli okuyucuya vermesin —
     kardeşleri `bilancolar/hafta/gorsel`, `gunun-grafigi/[tarih]/gorsel`. */
  image.headers.set("Vary", "Cookie");
  return image;
}
