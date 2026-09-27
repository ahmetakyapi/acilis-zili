import { ImageResponse } from "next/og";
import { INDEX_STRIP } from "@/db/seed/symbols";
import { getEventsBetween, getHolidays, getStatus, getUpcomingEarnings } from "@/lib/data";
import {
  CARD_EVENT_LIMIT,
  CARD_INDEX_NAMES,
  cardMoves,
  parseCardDate,
  pickKeyEvents,
  type CardEvent,
  type CardMoves,
} from "@/lib/day-card";
import { getDictionary } from "@/lib/i18n";
import {
  SESSION_BOUNDS,
  etDateTimeToUtc,
  getMarketStatus,
  todayEt,
} from "@/lib/market-hours";
import { C, Chip, OG_CONTENT_TYPE, OgFrame, OgTitle, Tri, clip, ogFonts } from "@/lib/og";
import { getQuotes } from "@/lib/providers";
import { clockOf, timePair } from "@/lib/session-clock";
import { formatEtDateCompact, formatEtDateLong, formatPercentPlain } from "@/lib/utils";

/**
 * AÇILIŞ KARTI — günün paylaşılabilir görseli.
 *
 * `/gun/2026-09-28/kart` (1200×630, sosyal ağ kartı) ve
 * `/gun/2026-09-28/kart?bicim=dikey` (1080×1350, Instagram ve telefon
 * ekranı). `/gun/bugun/kart` her gün o günün kartı.
 *
 * NEDEN `/api` ALTINDA DEĞİL: `robots.txt` `/api/`i engelliyor ve X'in
 * kart botu `robots.txt`e uyuyor; görsel orada dursaydı paylaşılan bağlantı
 * önizlemesiz görünürdü. Adres her tarih için SABİT: kart bir kez
 * paylaşıldığında aynı adres aynı günü anlatmaya devam ediyor.
 *
 * Kartta üç şey var: tarih ve o günün zil saatleri (Türkiye saatiyle,
 * o günün tarihiyle hesaplanmış), günün üç önemli olayı (makro veri ve
 * bilanço) ve endeks fonlarının hareketi. Hareket YALNIZCA hangi seansı
 * anlattığı kanıtlanabiliyorsa basılıyor; açılış öncesinde önceki kapanış
 * tarihiyle yazılıyor. Kural ve gerekçesi `lib/day-card.ts` → `cardMoves`.
 *
 * Kart TÜRKÇE: öteki OG kartlarıyla aynı sınır (gerekçe `lib/og.tsx`).
 * Renkler Satori CSS değişkeni okumadığı için `lib/og.tsx`teki sabitler.
 */

const LANDSCAPE = { width: 1200, height: 630 } as const;
const PORTRAIT = { width: 1080, height: 1350 } as const;
const PORTRAIT_PARAM = "dikey";

/* Önbellek: bugünün ve geleceğin kartı canlı veri taşıyor (fiyat, takvim
   güncellemesi) ve beş dakikada tazeleniyor; geçmiş bir günün kartı
   değişmiyor, bir gün tutuluyor. Paylaşım botları kendi önbelleklerini
   zaten günlerce tutuyor. */
const LIVE_MAX_AGE = 300;
const PAST_MAX_AGE = 86_400;

/** Yüzde basamağı — sitedeki endeks kartlarıyla aynı (iki). */
const PERCENT_DIGITS = 2;

/** Olay satırındaki başlığın karakter tavanı — Satori satır kırpmıyor. */
const EVENT_TITLE_MAX = { landscape: 46, portrait: 34 } as const;

const t = getDictionary("tr");

function eventTime(event: CardEvent, day: string): { time: string; window: boolean } {
  if (event.kind === "economic") {
    return event.timeEt
      ? { time: timePair(day, event.timeEt, "tr").primary, window: false }
      : { time: t.about.card.timeUnknown, window: true };
  }
  if (event.hour === "bmo") return { time: t.earnings.beforeOpen, window: true };
  if (event.hour === "amc") return { time: t.earnings.afterClose, window: true };
  if (event.hour === "dmh") return { time: t.earnings.duringMarket, window: true };
  return { time: t.about.card.timeUnknown, window: true };
}

function eventTitle(event: CardEvent, max: number): string {
  if (event.kind === "economic") return clip(event.title, max);
  return clip(event.name ? `${event.symbol} · ${event.name}` : event.symbol, max);
}

function movesLabel(moves: CardMoves): string {
  if (moves.basis === "session") return t.about.card.movesSession;
  if (moves.basis === "pre-market") return t.about.card.movesPre;
  if (moves.basis === "after-hours") return t.about.card.movesAfter;
  return t.about.card.movesLastClose.replace(
    "{date}",
    moves.sessionDay ? formatEtDateCompact(moves.sessionDay, "tr") : "",
  );
}

function MoveChip({ symbol, changePct, big }: { symbol: string; changePct: number; big: boolean }) {
  const up = changePct > 0;
  const flat = changePct === 0;
  const tone = flat ? "neutral" : up ? "up" : "down";
  return (
    <Chip tone={tone}>
      <span style={{ color: C.strong, fontSize: big ? 24 : 21 }}>
        {CARD_INDEX_NAMES[symbol] ?? symbol}
      </span>
      {!flat && <Tri up={up} color={up ? C.up : C.down} />}
      {/* İşaretsiz yüzde + çizilmiş üçgen: `formatPercent`in eksi işareti
          (U+2212) gömülü fontta yok, kartta kutu olarak çıkıyordu. */}
      <span style={{ fontSize: big ? 24 : 21 }}>{formatPercentPlain(changePct, "tr", PERCENT_DIGITS)}</span>
    </Chip>
  );
}

export async function GET(
  request: Request,
  context: RouteContext<"/gun/[tarih]/kart">,
) {
  const { tarih } = await context.params;
  const today = todayEt();
  const day = parseCardDate(tarih, today);
  if (!day) return new Response("Not Found", { status: 404 });

  const portrait = new URL(request.url).searchParams.get("bicim") === PORTRAIT_PARAM;
  const size = portrait ? PORTRAIT : LANDSCAPE;

  const [holidays, status, economic, earnings] = await Promise.all([
    getHolidays(),
    getStatus(),
    getEventsBetween(day, day),
    getUpcomingEarnings(day, day, CARD_EVENT_LIMIT * 2),
  ]);
  /* Kartın gününün seans künyesi — o günün ÖĞLENİNE göre: tatil mi, yarım
     gün mü, kapanış kaçta. `getMarketStatus` günü öğlen anından okuyor;
     bugünün `status`u başka bir günü anlatamaz. */
  const dayStatus = getMarketStatus(etDateTimeToUtc(day, "12:00"), holidays);
  const quotes = await getQuotes([...INDEX_STRIP], status);
  const moves = quotes.ok
    ? cardMoves(
        day,
        status,
        INDEX_STRIP.flatMap((symbol) => {
          const quote = quotes.data[symbol];
          return quote ? [{ symbol, changePct: quote.changePct, tradedAt: quote.tradedAt }] : [];
        }),
        quotes.stale === true,
      )
    : null;

  const events = pickKeyEvents(
    economic.map((event) => ({
      title: event.titleTr,
      timeEt: event.eventTimeEt,
      importance: event.importance,
    })),
    earnings.map((row) => ({
      symbol: row.symbol,
      name: row.name,
      hour: row.hour,
      marketCap: row.marketCap,
    })),
  );

  const open = timePair(day, clockOf(SESSION_BOUNDS.regularOpen), "tr");
  const close = timePair(day, clockOf(dayStatus.closeMinutes), "tr");
  const sessionLine = dayStatus.tradingToday
    ? `${t.about.embed.openAt} ${open.primary} · ${t.about.embed.closeAt} ${close.primary} ${t.about.card.trTime}${
        dayStatus.holiday?.earlyCloseEt ? ` · ${t.about.card.halfDay}` : ""
      }`
    : `${t.about.card.marketClosed} · ${
        dayStatus.holiday ? dayStatus.holiday.nameTr : t.about.card.weekend
      }`;

  const big = portrait;
  const titleMax = portrait ? EVENT_TITLE_MAX.portrait : EVENT_TITLE_MAX.landscape;

  const eventRows =
    events.length === 0 ? (
      <div style={{ display: "flex", fontSize: big ? 30 : 24, color: C.body }}>
        {t.about.card.eventsEmpty}
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: big ? 22 : 10 }}>
        {events.map((event, index) => {
          const when = eventTime(event, day);
          return (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: big ? "column" : "row",
                alignItems: big ? "flex-start" : "center",
                gap: big ? 6 : 18,
                paddingTop: index === 0 ? 0 : big ? 20 : 10,
                borderTop: index === 0 ? "none" : `1px solid ${C.lineSoft}`,
              }}
            >
              <span
                style={{
                  display: "flex",
                  /* Satori `undefined` stil değerinde düşüyor ("reading
                     'trim'"); alan yoksa hiç yazılmıyor. */
                  ...(big ? {} : { width: 190, flexShrink: 0 }),
                  fontSize: when.window ? (big ? 24 : 20) : big ? 30 : 26,
                  fontWeight: 700,
                  color: when.window ? C.primary : C.strong,
                }}
              >
                {when.window ? when.time : `${when.time} ${t.about.card.trTime}`}
              </span>
              <span style={{ display: "flex", fontSize: big ? 36 : 27, color: C.strong }}>
                {eventTitle(event, titleMax)}
              </span>
            </div>
          );
        })}
      </div>
    );

  const footer = moves ? (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <span
        style={{
          display: "flex",
          ...(big ? { width: "100%" } : {}),
          fontSize: big ? 22 : 18,
          fontWeight: 700,
          color: C.muted,
          marginRight: 6,
        }}
      >
        {movesLabel(moves)}
      </span>
      {moves.items.map((item) => (
        <MoveChip key={item.symbol} symbol={item.symbol} changePct={item.changePct} big={big} />
      ))}
    </div>
  ) : undefined;

  const image = new ImageResponse(
    (
      <OgFrame eyebrow={t.about.card.eyebrow} footer={footer}>
        <div style={{ display: "flex", flexDirection: "column", gap: big ? 14 : 6 }}>
          <OgTitle size={big ? 76 : 54}>{formatEtDateLong(day, "tr")}</OgTitle>
          <div style={{ display: "flex", fontSize: big ? 30 : 23, fontWeight: 700, color: C.primary }}>
            {sessionLine}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: big ? 40 : 14 }}>
          {eventRows}
        </div>
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );

  image.headers.set(
    "Cache-Control",
    `public, max-age=${day < today ? PAST_MAX_AGE : LIVE_MAX_AGE}`,
  );
  image.headers.set("Content-Type", OG_CONTENT_TYPE);
  return image;
}
