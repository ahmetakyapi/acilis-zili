import type { Dictionary, Locale } from "@/lib/i18n";
import { verdictLabel, verdictOf } from "@/lib/analysis";
import { formatGuidanceRange } from "@/lib/earnings-report";
import {
  railPositions,
  rangePositions,
  reactionScale,
  storyCardTitle,
  surpriseText,
  type StoryCard,
  type StoryFigure,
} from "@/lib/earnings-story";
import { WEEK_OG_SIZES } from "@/lib/earnings-week-og";
import { BrandLock, C, DayRailMark, VERDICT_OG } from "@/lib/og";
import { formatEtDateCompact, formatMoneyCompact, formatPercent, formatPercentPlain, formatPrice } from "@/lib/utils";

/**
 * Hikâye kartlarının paylaşım görselleri — dikey 1080×1350 (telefonda
 * paylaşılan kare) ve yatay 1200×630 (bağlantı önizlemesi).
 *
 * HAFTALIK TAKVİMİN ALTYAPISI (`lib/earnings-week-og.tsx`): aynı ölçüler
 * (`WEEK_OG_SIZES`), aynı marka kilidi ve gün şeridi, logolar aynı yoldan
 * (`loadWeekLogos`: depodaki webp → PNG; uzak adrese gidilmiyor). Satori
 * CSS değişkeni okumuyor; renkler `lib/og.tsx` → `C` (açık tema).
 *
 * Sayılar sayfadaki kartla AYNI `StoryCard` verisinden ve aynı metin
 * yardımcılarından (`storyCardTitle`, `surpriseText`) — görselde başka,
 * sayfada başka bir yüzde yazamaz.
 */

export const STORY_OG_SIZES = WEEK_OG_SIZES;
export type StoryOgSize = keyof typeof STORY_OG_SIZES;

type Scale = { pad: number; title: number; big: number; value: number; label: number; gap: number; rail: number };

const SCALE: Record<StoryOgSize, Scale> = {
  portrait: { pad: 64, title: 66, big: 96, value: 44, label: 24, gap: 28, rail: 12 },
  landscape: { pad: 40, title: 38, big: 60, value: 28, label: 17, gap: 16, rail: 8 },
};

/**
 * Nötr veri tonu — rehberlik bandı ve ±ortalama çentiği. Sayfada
 * `--line-strong`; `C`de o ton yok ve ortak `lib/og.tsx`e dokunmamak için
 * en yakın nötr (`muted`) kullanılıyor. Mavi (`primarySoft`) veri
 * çiziminde yasak (24 Ekim denetimi).
 */
const NEUTRAL = C.muted;

const toneColor = (direction: "beat" | "miss" | "inline") =>
  direction === "beat" ? C.up : direction === "miss" ? C.down : C.body;

/** Tek çizgi — Satori'de mutlak konumlu parçalar. */
function Rail({
  scale,
  band,
  bandColor,
  ghost,
  solid,
}: {
  scale: Scale;
  band: { from: number; to: number } | null;
  bandColor: string;
  ghost: number | null;
  solid: number | null;
}) {
  const h = scale.rail;
  const dot = h * 2;
  return (
    <div style={{ display: "flex", position: "relative", width: "100%", height: dot }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: (dot - h / 2) / 2,
          height: h / 2,
          borderRadius: 99,
          background: C.lineSoft,
        }}
      />
      {band && (
        <div
          style={{
            position: "absolute",
            left: `${band.from * 100}%`,
            width: `${Math.max(1, (band.to - band.from) * 100)}%`,
            top: (dot - h) / 2,
            height: h,
            borderRadius: 99,
            background: bandColor,
          }}
        />
      )}
      {ghost !== null && (
        <div
          style={{
            position: "absolute",
            left: `${ghost * 100}%`,
            marginLeft: -dot / 2,
            top: 0,
            width: dot,
            height: dot,
            borderRadius: 99,
            border: `${Math.max(2, h / 3)}px solid ${C.muted}`,
            background: C.surface,
          }}
        />
      )}
      {solid !== null && (
        <div
          style={{
            position: "absolute",
            left: `${solid * 100}%`,
            marginLeft: -dot / 2,
            top: 0,
            width: dot,
            height: dot,
            borderRadius: 99,
            background: C.strong,
          }}
        />
      )}
    </div>
  );
}

function Pair({ scale, items }: { scale: Scale; items: { label: string; value: string }[] }) {
  return (
    <div style={{ display: "flex", gap: scale.gap * 1.5 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: scale.label, color: C.muted }}>{item.label}</span>
          <span style={{ fontSize: scale.value, fontWeight: 700, color: C.strong, letterSpacing: "-0.02em" }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Block({ scale, children }: { scale: Scale; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: scale.gap / 2,
        padding: `${scale.gap * 0.7}px ${scale.gap}px`,
        borderRadius: scale.gap * 0.8,
        background: C.page,
        border: `1px solid ${C.line}`,
      }}
    >
      {children}
    </div>
  );
}

function Label({ scale, children }: { scale: Scale; children: React.ReactNode }) {
  return <span style={{ fontSize: scale.label, fontWeight: 700, color: C.muted }}>{children}</span>;
}

function figureBlock(
  key: string,
  label: string,
  figure: StoryFigure,
  fmt: (value: number) => string,
  scale: Scale,
  locale: Locale,
  t: Dictionary,
) {
  const s = t.earningsSeason.story;
  const pos = railPositions(figure.estimate, figure.actual);
  const color = toneColor(figure.surprise.direction);
  return (
    <Block key={key} scale={scale}>
      <Label scale={scale}>{label}</Label>
      <Pair
        scale={scale}
        items={[
          { label: s.expectEstimate, value: fmt(figure.estimate) },
          { label: s.expectActual, value: fmt(figure.actual) },
        ]}
      />
      <Rail
        scale={scale}
        band={{ from: Math.min(pos.estimate, pos.actual), to: Math.max(pos.estimate, pos.actual) }}
        bandColor={color}
        ghost={pos.estimate}
        solid={pos.actual}
      />
      <span style={{ fontSize: scale.label + 2, fontWeight: 700, color }}>
        {surpriseText(figure, locale, t.earningsSeason)}
      </span>
    </Block>
  );
}

function Body({
  card,
  scale,
  size,
  currency,
  locale,
  t,
}: {
  card: StoryCard;
  scale: Scale;
  size: StoryOgSize;
  currency: string | true;
  locale: Locale;
  t: Dictionary;
}) {
  const s = t.earningsSeason.story;
  if (card.kind === "beklenti") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: scale.gap }}>
        {card.eps &&
          figureBlock("eps", s.expectEps, card.eps, (v) => formatPrice(v, locale, { currency }), scale, locale, t)}
        {card.revenue &&
          figureBlock(
            "revenue",
            s.expectRevenue,
            card.revenue,
            (v) => formatMoneyCompact(v, locale, typeof currency === "string" ? currency : null),
            scale,
            locale,
            t,
          )}
        {card.recorded && (
          <Block scale={scale}>
            <Label scale={scale}>{s.expectEps}</Label>
            <span style={{ fontSize: scale.big, fontWeight: 700, color: C.strong, letterSpacing: "-0.04em" }}>
              {formatPrice(card.recorded.eps, locale, { currency })}
            </span>
            <span
              style={{
                fontSize: scale.label + 4,
                fontWeight: 700,
                color: card.recorded.surprisePct >= 0 ? C.up : C.down,
              }}
            >
              {s.expectSurprise.replace("{pct}", formatPercent(card.recorded.surprisePct, locale, 1))}
            </span>
          </Block>
        )}
      </div>
    );
  }
  if (card.kind === "rehberlik") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: scale.gap }}>
        {card.rows.map((row) => {
          const pos = rangePositions(row.low, row.high, row.consensus);
          const unit = row.unit ?? undefined;
          return (
            <Block key={row.label} scale={scale}>
              <Label scale={scale}>{row.label}</Label>
              <Pair
                scale={scale}
                items={[
                  { label: s.guidanceRange, value: formatGuidanceRange(row.low, row.high, unit, locale) },
                  ...(row.consensus !== null
                    ? [{ label: s.guidanceConsensus, value: formatGuidanceRange(row.consensus, row.consensus, unit, locale) }]
                    : []),
                ]}
              />
              <Rail
                scale={scale}
                band={{ from: pos.low, to: pos.high }}
                bandColor={NEUTRAL}
                ghost={null}
                solid={pos.consensus}
              />
            </Block>
          );
        })}
      </div>
    );
  }
  if (card.kind === "tepki") {
    const { movePct, average, timing, history } = card.reaction;
    const up = movePct >= 0;
    /* Sayfadaki kartla aynı kural ve ölçek (`reactionScale`): tek başına
       çubuk yok; karşılaştırma önceki raporların satırları. İşaret metnin
       içinde (`formatPercent`, "+%15,8") — ayrı ▲ üçgeni 12 piksel kalıp
       taban çizgisine düşüyordu ve sayfada yoktu (24 Ekim denetimi). */
    const rs = reactionScale(movePct, history, average?.avg ?? null);
    const rows = history.length > 0 ? [{ date: null as string | null, movePct }, ...history] : [];
    /* Yatay görselde (630 px) satır tavanı: bu rapor + en çok üç önceki.
       Ölçüldü (NVDA 2Ç FY2027, 24 Ekim): ilk blok 145 px, iki satırlı
       geçmiş bloğu 115 px, satır başına ~35 px; dört satırla gövde ~350 px
       ve marka/künye satırları arasındaki ~400 px'e sığıyor. Dikeyde tavan
       yok (`STORY_REACTION_HISTORY` zaten dört). */
    const shownRows = size === "landscape" ? rows.slice(0, 4) : rows;
    const lane = scale.label * 1.6;
    const bar = scale.rail;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: scale.gap }}>
        <Block scale={scale}>
          <Label scale={scale}>{s.reactionMove}</Label>
          <span style={{ fontSize: scale.big, fontWeight: 700, color: up ? C.up : C.down, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
            {formatPercent(movePct, locale, 1)}
          </span>
          <span style={{ fontSize: scale.label, color: C.muted }}>{timing === "bmo" ? s.reactionBmo : s.reactionAmc}</span>
        </Block>
        {shownRows.length > 0 && (
          <Block scale={scale}>
            <Label scale={scale}>
              {average
                ? `${s.reactionAverage} ±${formatPercentPlain(average.avg, locale, 1)}`
                : s.reactionHistory}
            </Label>
            {shownRows.map((row) => {
              const ratio = row.movePct / rs.peak;
              const color = row.movePct >= 0 ? C.up : C.down;
              const own = row.date === null;
              return (
                <div key={row.date ?? "own"} style={{ display: "flex", alignItems: "center", gap: scale.gap / 2 }}>
                  <span style={{ display: "flex", width: scale.label * 5, fontSize: scale.label, fontWeight: own ? 700 : 400, color: own ? C.strong : C.muted }}>
                    {row.date === null ? s.reactionThis : formatEtDateCompact(row.date, locale)}
                  </span>
                  <div style={{ display: "flex", position: "relative", flex: 1, height: lane }}>
                    <div style={{ position: "absolute", left: 0, right: 0, top: (lane - bar) / 2, height: bar, borderRadius: 99, background: C.lineSoft }} />
                    {rs.guide !== null &&
                      [50 - rs.guide * 50, 50 + rs.guide * 50].map((at) => (
                        <div key={at} style={{ position: "absolute", left: `${at}%`, top: 0, width: 2, height: lane, background: NEUTRAL, opacity: 0.5 }} />
                      ))}
                    <div
                      style={{
                        position: "absolute",
                        top: (lane - bar) / 2,
                        height: bar,
                        borderRadius: 99,
                        background: color,
                        ...(row.movePct >= 0 ? { left: "50%", width: `${ratio * 50}%` } : { right: "50%", width: `${-ratio * 50}%` }),
                      }}
                    />
                    <div style={{ position: "absolute", left: "50%", top: 0, width: 2, height: lane, background: C.muted }} />
                  </div>
                  <span style={{ display: "flex", justifyContent: "flex-end", width: scale.label * 4.2, fontSize: scale.label, fontWeight: 700, color }}>
                    {formatPercent(row.movePct, locale, 1)}
                  </span>
                </div>
              );
            })}
          </Block>
        )}
      </div>
    );
  }
  if (card.kind === "ozet") {
    return (
      <div
        style={{
          display: "flex",
          fontSize: scale.value * 1.15,
          fontWeight: 700,
          lineHeight: 1.3,
          letterSpacing: "-0.02em",
          color: C.strong,
        }}
      >
        {card.text}
      </div>
    );
  }
  const verdict = verdictOf(card.verdict);
  /* Görüş üçlüsü (`VERDICT_OG`): halka çizim tonu, kelime metin tonu. TUT
     burada MAVİ basılıyordu; mavi sitede etkileşim, görüş rengi değil. */
  const tone = VERDICT_OG[verdict];
  const ring = scale.big * 2.4;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: scale.gap * 1.5 }}>
      <div
        style={{
          width: ring,
          height: ring,
          borderRadius: 999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: `${Math.round(ring / 14)}px solid ${tone.ink}`,
          background: C.surface,
        }}
      >
        <span style={{ fontSize: scale.big, fontWeight: 700, color: C.strong, lineHeight: 1, letterSpacing: "-0.04em" }}>
          {card.score}
        </span>
        <span style={{ fontSize: scale.label, color: C.muted }}>{s.scoreOf}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Label scale={scale}>{s.verdict}</Label>
        <span style={{ fontSize: scale.big * 0.8, fontWeight: 700, color: tone.fg, letterSpacing: "-0.03em" }}>
          {verdictLabel(verdict, t)}
        </span>
      </div>
    </div>
  );
}

export function StoryOgCard({
  card,
  index,
  total,
  company,
  symbol,
  periodLabel,
  logo,
  currency,
  size,
  locale,
  t,
}: {
  card: StoryCard;
  index: number;
  total: number;
  company: string;
  symbol: string;
  periodLabel: string;
  logo: string | undefined;
  currency: string | true;
  size: StoryOgSize;
  locale: Locale;
  t: Dictionary;
}) {
  const s = t.earningsSeason.story;
  const scale = SCALE[size];
  const portrait = size === "portrait";
  const logoSize = portrait ? 64 : 40;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: scale.gap,
        padding: `${scale.pad}px ${scale.pad}px ${scale.pad * 0.8}px`,
        background: C.surface,
        fontFamily: "Schibsted",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <BrandLock label={s.link} />
        <span style={{ fontSize: scale.label + 2, fontWeight: 700, color: C.muted }}>
          {s.position.replace("{n}", String(index + 1)).replace("{total}", String(total))}
        </span>
      </div>
      {/* DİKEYDE alt alta, YATAYDA yan yana: 630 piksellik yükseklik kimlik,
          başlık ve iki ölçü bloğunu üst üste taşımıyor (ölçüldü — bkz.
          rota başındaki not); kimlik solda, gövde sağda. */}
      <div
        style={{
          display: "flex",
          flexDirection: portrait ? "column" : "row",
          flex: 1,
          gap: portrait ? scale.gap * 1.4 : scale.gap * 2,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: scale.gap,
            width: portrait ? "100%" : 380,
            flexShrink: 0,
            justifyContent: portrait ? "flex-start" : "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: scale.gap / 2 }}>
            {logo && (
              <div
                style={{
                  display: "flex",
                  width: logoSize,
                  height: logoSize,
                  borderRadius: logoSize * 0.28,
                  border: `1px solid ${C.line}`,
                  /* Zemin görseli — gerekçe `lib/earnings-week-og.tsx` → Entry. */
                  backgroundImage: `url(${logo})`,
                  backgroundSize: `${logoSize}px ${logoSize}px`,
                  backgroundRepeat: "no-repeat",
                }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: scale.label + 6, fontWeight: 700, color: C.strong }}>{company}</span>
              <span style={{ fontSize: scale.label, color: C.muted }}>
                {symbol} · {periodLabel}
              </span>
            </div>
          </div>
          <span
            style={{
              fontSize: scale.title,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              color: C.primary,
            }}
          >
            {storyCardTitle(card, s)}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", minWidth: 0 }}>
          <Body card={card} scale={scale} size={size} currency={currency} locale={locale} t={t} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: scale.gap / 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: scale.label, color: C.muted }}>
          <span>{s.footer}</span>
          <span style={{ fontWeight: 700, color: C.body }}>aciliszili.com</span>
        </div>
        <DayRailMark />
      </div>
    </div>
  );
}
