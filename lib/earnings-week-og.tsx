import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Dictionary, Locale } from "@/lib/i18n";
import { LOCAL_LOGOS, LOGO_FILE_OVERRIDES } from "@/lib/logo-manifest";
import { BrandLock, C, DayRailMark } from "@/lib/og";
import {
  allocateSlots,
  dayLabel,
  weekRangeLabel,
  type WeekCandidate,
  type WeekDay,
} from "@/lib/earnings-week";
import type { EarningsWeek } from "@/lib/earnings-week-data";

/**
 * Haftalık Bilanço Takvimi'nin iki paylaşım görseli — yatay (1200×630,
 * bağlantı önizlemesi) ve dikey (1080×1350, telefonda paylaşılan kare).
 *
 * Çerçeve `lib/og.tsx`in dili: aynı zemin, aynı marka kilidi, aynı gün
 * şeridi. `OgFrame` burada KULLANILMIYOR: iç dolgusu (40 + 52) beş günlük
 * bir ızgaraya 1.000 piksel bırakıyordu ve sütun başına iki şirket
 * sığıyordu. Parçalar aynı, iskelet bu içeriğe göre.
 *
 * TELEFONDA OKUNUR OLAN DİKEY. Yatay kart 390 piksellik ekranda 0,3
 * ölçeğe iniyor ve 20 piksellik sembol 6 piksele düşüyor; o kart bir
 * önizleme. Dikey kartta sembol 30 piksel, telefonda ~11.
 */

export const WEEK_OG_SIZES = {
  landscape: { width: 1200, height: 630 },
  portrait: { width: 1080, height: 1350 },
} as const;
export type WeekOgSize = keyof typeof WEEK_OG_SIZES;

/**
 * YATAY: günün karo bütçesi, dolu şerit sayısına göre. Sütunun lanes için
 * kalan yüksekliği 344 piksel (ölçüldü); şerit başlığı 24, karo 38, "+N"
 * satırı 24 piksel tutuyor. Üç şeritli bir gün beş karo, iki şeritli altı,
 * tek şeritli yedi — her şeritte "+N" satırına yer kalarak.
 */
const LANDSCAPE_DAY_BUDGET: Record<number, number> = { 1: 7, 2: 6, 3: 5 };

/**
 * DİKEY: şerit TEK SATIR, başlığı solunda. Satırın karo alanı 600 piksel
 * ve bir karo (40 piksel logo + sembol + ara) ~140 tutuyor: dört karo ve
 * "+N". Şerit başlığı karoların üstünde durduğunda üç şeritli bir gün 244
 * piksel istiyordu ve bilanço sezonunda kart altından taşıyordu (19 Ekim
 * 2026 haftası); yan yana dizilince gün en fazla 152.
 */
const PORTRAIT_LANE_CAP = 4;

/* ---------------------------------------------------------------------------
   Logolar
   --------------------------------------------------------------------------- */

/**
 * Logolar DEPODAN ve PNG'ye çevrilerek.
 *
 * `public/logos/` webp tutuyor (gerekçe `lib/logos.ts`) ve Satori webp
 * çizemiyor: denendi, `u2 is not iterable` ile düşüyor. Dönüşüm
 * `sharp`la — Next'in kendi isteğe bağlı bağımlılığı, görsel
 * iyileştiricinin kullandığı modül. Paket bu projede ayrıca kurulmuyor;
 * bulunamazsa ya da bir dosya çevrilemezse o şirket LOGOSUZ, yalnızca
 * sembolüyle çizilir. Kart hiçbir durumda düşmez.
 *
 * Uzak adrese (Finnhub) GİDİLMİYOR: her kart çiziminde onlarca dış istek
 * olurdu ve biri yavaşladığında kartın tamamı beklerdi. Yerel dosyası
 * olmayan sembol metinle yazılıyor.
 *
 * Süreç ömrünce önbellekli: aynı logo ikinci kartta yeniden çevrilmez.
 */
const logoCache = new Map<string, string | null>();

type SharpFactory = (input: Buffer) => { png: () => { toBuffer: () => Promise<Buffer> } };

async function loadSharp(): Promise<SharpFactory | null> {
  try {
    const mod = (await import("sharp")) as unknown as { default: SharpFactory };
    return mod.default;
  } catch {
    return null;
  }
}

export async function loadWeekLogos(symbols: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const todo = symbols.filter((symbol) => LOCAL_LOGOS.has(symbol) && !logoCache.has(symbol));
  if (todo.length > 0) {
    const sharp = await loadSharp();
    await Promise.all(
      todo.map(async (symbol) => {
        if (!sharp) {
          logoCache.set(symbol, null);
          return;
        }
        try {
          const file = join(
            process.cwd(),
            "public",
            "logos",
            `${LOGO_FILE_OVERRIDES.get(symbol) ?? symbol}.webp`,
          );
          const png = await sharp(await readFile(file)).png().toBuffer();
          logoCache.set(symbol, `data:image/png;base64,${png.toString("base64")}`);
        } catch {
          logoCache.set(symbol, null);
        }
      }),
    );
  }
  for (const symbol of symbols) {
    const uri = logoCache.get(symbol);
    if (uri) out.set(symbol, uri);
  }
  return out;
}

/* ---------------------------------------------------------------------------
   Parçalar
   --------------------------------------------------------------------------- */

type Scale = {
  logo: number;
  ticker: number;
  lane: number;
  gap: number;
};

const SCALE: Record<WeekOgSize, Scale> = {
  landscape: { logo: 30, ticker: 20, lane: 14, gap: 8 },
  portrait: { logo: 40, ticker: 27, lane: 20, gap: 10 },
};

function Entry({
  row,
  logo,
  scale,
}: {
  row: WeekCandidate;
  logo: string | undefined;
  scale: Scale;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: scale.gap }}>
      {logo && (
        <div
          style={{
            display: "flex",
            width: scale.logo,
            height: scale.logo,
            borderRadius: scale.logo * 0.28,
            overflow: "hidden",
            backgroundColor: C.surface,
            border: `1px solid ${C.line}`,
            /* `<img>` DEĞİL ZEMİN GÖRSELİ: `@next/next/no-img-element`
               kuralı Satori ağacını da tarıyor ve depo yeni bir
               `eslint-disable` kabul etmiyor (CLAUDE.md). Satori
               `background-image: url(data:…)` çiziyor; sonuç aynı. */
            backgroundImage: `url(${logo})`,
            backgroundSize: `${scale.logo}px ${scale.logo}px`,
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
      <span
        style={{
          fontSize: scale.ticker,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: C.strong,
          lineHeight: 1,
        }}
      >
        {row.symbol}
      </span>
    </div>
  );
}

function Lane({
  time,
  window,
  tone,
  rows,
  cap,
  logos,
  size,
  t,
}: {
  /** "~15:00" — belirsiz şeritte yok. */
  time: string | null;
  window: string;
  tone: "pre" | "post" | "neutral";
  rows: WeekCandidate[];
  cap: number;
  logos: Map<string, string>;
  size: WeekOgSize;
  t: Dictionary;
}) {
  const scale = SCALE[size];
  const shown = rows.slice(0, cap);
  const more = rows.length - shown.length;
  const color = tone === "pre" ? C.up : tone === "post" ? C.primary : C.body;
  const portrait = size === "portrait";
  const label = portrait ? (
    <div style={{ display: "flex", flexDirection: "column", width: 150, flexShrink: 0, gap: 2 }}>
      {time && (
        <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.05 }}>{time}</span>
      )}
      <span style={{ fontSize: time ? 16 : 18, fontWeight: 700, color, lineHeight: 1.1 }}>{window}</span>
    </div>
  ) : (
    <span style={{ fontSize: scale.lane, fontWeight: 700, color, lineHeight: 1.1 }}>
      {time ? `${time} ${window}` : window}
    </span>
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: portrait ? "row" : "column",
        alignItems: portrait ? "center" : "stretch",
        gap: portrait ? 16 : scale.gap,
      }}
    >
      {label}
      <div
        style={{
          display: "flex",
          flexDirection: portrait ? "row" : "column",
          alignItems: portrait ? "center" : "flex-start",
          gap: portrait ? 18 : 8,
        }}
      >
        {shown.map((row) => (
          <Entry key={row.symbol} row={row} logo={logos.get(row.symbol)} scale={scale} />
        ))}
        {more > 0 && (
          <span style={{ fontSize: scale.ticker * 0.8, fontWeight: 700, color: C.muted, lineHeight: 1 }}>
            {t.earningsExtra.week.ogMore.replace("{count}", String(more))}
          </span>
        )}
      </div>
    </div>
  );
}

function lanesOf(day: WeekDay, t: Dictionary) {
  const w = t.earningsExtra.week;
  return [
    { key: "bmo", tone: "pre" as const, rows: day.bmo, time: `~${day.bmoClock.primary}`, window: w.beforeOpen },
    { key: "amc", tone: "post" as const, rows: day.amc, time: `~${day.amcClock.primary}`, window: w.afterClose },
    { key: "other", tone: "neutral" as const, rows: day.other, time: null, window: w.otherTime },
  ].filter((lane) => lane.rows.length > 0);
}

function DayBody({
  day,
  logos,
  size,
  t,
}: {
  day: WeekDay;
  logos: Map<string, string>;
  size: WeekOgSize;
  t: Dictionary;
}) {
  const w = t.earningsExtra.week;
  const muted = { fontSize: SCALE[size].lane + 2, color: C.muted, display: "flex" } as const;
  if (day.closed) return <span style={muted}>{w.marketClosed}</span>;
  const lanes = lanesOf(day, t);
  if (lanes.length === 0) return <span style={muted}>{w.emptyDay}</span>;
  const caps =
    size === "portrait"
      ? lanes.map(() => PORTRAIT_LANE_CAP)
      : allocateSlots(
          lanes.map((lane) => lane.rows.length),
          LANDSCAPE_DAY_BUDGET[lanes.length] ?? LANDSCAPE_DAY_BUDGET[3]!,
        );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: size === "portrait" ? 10 : 14 }}>
      {lanes.map((lane, index) => (
        <Lane
          key={lane.key}
          time={lane.time}
          window={lane.window}
          tone={lane.tone}
          rows={lane.rows}
          cap={caps[index] ?? 1}
          logos={logos}
          size={size}
          t={t}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Kartlar
   --------------------------------------------------------------------------- */

export function WeekOgCard({
  week,
  logos,
  size,
  locale,
  t,
}: {
  week: EarningsWeek;
  logos: Map<string, string>;
  size: WeekOgSize;
  locale: Locale;
  t: Dictionary;
}) {
  const w = t.earningsExtra.week;
  const range = weekRangeLabel(week.monday, locale);
  const portrait = size === "portrait";

  const header = (
    <div
      style={{
        display: "flex",
        flexDirection: portrait ? "column" : "row",
        alignItems: portrait ? "flex-start" : "center",
        justifyContent: "space-between",
        gap: portrait ? 28 : 16,
      }}
    >
      <BrandLock label={w.eyebrow} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: portrait ? "flex-start" : "flex-end",
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: portrait ? 58 : 30,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            color: C.strong,
            lineHeight: 1.05,
          }}
        >
          {w.title}
        </span>
        <span style={{ fontSize: portrait ? 34 : 22, fontWeight: 700, color: C.primary }}>{range}</span>
      </div>
    </div>
  );

  const footer = (
    <div style={{ display: "flex", flexDirection: "column", gap: portrait ? 16 : 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: portrait ? 22 : 15,
          color: C.muted,
        }}
      >
        <span>{w.ogFooter}</span>
        <span style={{ fontWeight: 700, color: C.body }}>aciliszili.com</span>
      </div>
      <DayRailMark />
    </div>
  );

  const days = week.days.map((day) => {
    const label = dayLabel(day.date, locale);
    return portrait ? (
      /* DİKEY: gün bir SATIR — solda gün, sağda şeritler. */
      <div
        key={day.date}
        style={{
          display: "flex",
          gap: 28,
          padding: "20px 0",
          borderTop: `1px solid ${C.line}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 160, flexShrink: 0, gap: 4 }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: C.strong, letterSpacing: "-0.02em" }}>
            {label.weekday}
          </span>
          <span style={{ fontSize: 24, color: C.muted }}>{label.day}</span>
        </div>
        <div style={{ display: "flex", flex: 1 }}>
          <DayBody day={day} logos={logos} size={size} t={t} />
        </div>
      </div>
    ) : (
      /* YATAY: gün bir SÜTUN. */
      <div
        key={day.date}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          gap: 14,
          padding: "16px 16px",
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 18,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: C.strong }}>{label.weekday}</span>
          <span style={{ fontSize: 15, color: C.muted }}>{label.day}</span>
        </div>
        <DayBody day={day} logos={logos} size={size} t={t} />
      </div>
    );
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: portrait ? 28 : 18,
        background: portrait ? C.surface : C.page,
        padding: portrait ? "56px 56px 48px" : "32px 36px 28px",
        fontFamily: "Schibsted",
      }}
    >
      {header}
      <div
        style={{
          display: "flex",
          flexDirection: portrait ? "column" : "row",
          flex: 1,
          gap: portrait ? 0 : 12,
        }}
      >
        {days}
      </div>
      {footer}
    </div>
  );
}
