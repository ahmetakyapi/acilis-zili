"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ChartBar, Sparkle } from "@phosphor-icons/react";
import { Skeleton } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { InsightText, MoveInsight } from "@/lib/stock-insights";
import { cn, formatPercent } from "@/lib/utils";
import { LOUD_VOLUME_RATIO, rangePosition, weekDigest, type RangePoint } from "@/lib/week-digest";
import { loudestSession, type WeekMove } from "./week-move";
import styles from "./WeekMove.module.css";

/**
 * Bu Hafta Neden Hareket Etti, KOMPAKT (25 Ekim, sahibinin isteği: "Bu
 * Hisseye Sor böyle kocaman olmasına gerek var mı; yanına Bu Hisse Neden
 * Hareket Etti konabilir"). Kart Bu Hisseye Sor ile tek panelin iki
 * kolonu (app/(app)/hisse/[symbol]/_panels/AskMovePanel.tsx).
 *
 * Eski tam genişlik kart (StockInsightCard, kind="move") 1280'de 595,
 * 390'da 824 piksel tutuyordu ve SAYILARI da Claude notuyla birlikte
 * istemciden geliyordu: not yoksa kart yalnız "hazırlanamadı" diyordu.
 * Şimdi sayılar sunucudan (`WeekMove`, components/stock/week-move.ts):
 * büyük değişim, S&P 500 farkı ve beş seansın gün gün şeritleri ilk karede
 * basılı (14 Kasım 2026'ya dek birikimli çizgiydi; gerekçe aşağıda). Not eskisi gibi İSTEMCİDEN ve panel görüş alanına yaklaşınca
 * isteniyor (botlar ve aşağı inmeyen okur Claude çağrısı tetiklemesin; uç
 * da botu geri çeviriyor — app/api/ai/hisse-notu). Notun metni ancak
 * penceresi sunucununkiyle aynıysa basılıyor; değilse yazılamamış sayılır.
 *
 * Maddeler katlı (`details`): özet cümlesi kartın boyunu belirliyor, üç
 * etken isteyene açılıyor. Renk yalnız yönden (up/down); şerit ortak
 * `value-lane`/`value-bar` (kulvar 5, satırın kahramanı olduğu için dolgu 12).
 */

type Labels = Dictionary["stockInsight"];
type WeekLabels = Dictionary["stockWeek"];

const tone = (value: number) => (value > 0 ? "up" : value < 0 ? "down" : "flat");
/** Hacmi 20 seans ortalamasının bu katını aşan seans işaretli (notla aynı eşik; tek kaynak lib/week-digest.ts). */
const LOUD_VOLUME = LOUD_VOLUME_RATIO;
/** Notun istendiği uzaklık: görüş alanına bu kadar kala. */
const PREFETCH_MARGIN = "400px 0px";

const nf = (locale: Locale, digits: number) =>
  new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/* ARALIK ELLE KURULUYOR (25 Ekim): `formatRange` sunucuda (Node ICU) ve
   tarayıcıda farklı boşluk basıyordu ("19 – 23" ince boşluklu / düz) ve kart
   artık sunucuda çizildiği için hidrasyon düşüyordu. Ayraç düz tire. */
function rangeLabel(from: string, to: string, locale: Locale) {
  const tag = locale === "en" ? "en-US" : "tr-TR";
  const a = new Date(`${from}T12:00:00Z`);
  const b = new Date(`${to}T12:00:00Z`);
  const full = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", timeZone: "UTC" });
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${full.format(a)} - ${full.format(b)}`;
  const month = new Intl.DateTimeFormat(tag, { month: "long", timeZone: "UTC" }).format(b);
  return locale === "en" ? `${month} ${a.getUTCDate()}-${b.getUTCDate()}` : `${a.getUTCDate()}-${b.getUTCDate()} ${month}`;
}

const weekday = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

export function WeekMoveCard({
  week,
  noteEnabled,
  locale,
  labels,
  copy,
}: {
  week: WeekMove;
  /** Claude anahtarı var mı (sunucuda `insightsConfigured`). Yoksa not alanı hiç yok. */
  noteEnabled: boolean;
  locale: Locale;
  labels: Labels;
  copy: WeekLabels;
}) {
  const { symbol } = week;
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "failed"; text?: InsightText; explained?: MoveInsight["explained"] }>({
    status: noteEnabled ? "idle" : "failed",
  });
  const points = useRef<HTMLDetailsElement>(null);
  /* ETKENLER MASAÜSTÜNDE AÇIK GELİR (24 Kasım, sahibinin isteği: "sağdaki
     panel de iyileşsin, biraz uzayabilir duruma göre"). İki kolonlu
     panelde sağ kolon sohbetin yanında kısa kalıyor, özetin altı boş
     duruyordu; etkenler haftanın asıl açıklaması. Telefonda katlı kalır
     (kart tek kolonda, açık hâli sayfayı ~200 piksel iter). Okur kapatırsa
     yeniden açılmaz: yalnız not ilk geldiğinde bir kez. */
  const done = state.status === "done";
  useEffect(() => {
    if (done && points.current && window.matchMedia("(min-width: 1024px)").matches) points.current.open = true;
  }, [done]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !noteEnabled || state.status !== "idle") return;
    const load = () => {
      setState({ status: "loading" });
      fetch(`/api/ai/hisse-notu?sembol=${encodeURIComponent(symbol)}&tur=hareket`)
        .then((response) => response.json() as Promise<{ ok: boolean; insight?: MoveInsight }>)
        .then((data) => {
          const insight = data.ok ? data.insight : undefined;
          /* Aynı pencere değilse not başka bir haftayı anlatıyor (seans
             bu arada kapandı): basılmaz, kart haftanın verisiyle kalır. */
          setState(
            insight && insight.kind === "move" && insight.to === week.to
              ? { status: "done", text: insight.text[locale], explained: insight.explained }
              : { status: "failed" },
          );
        })
        .catch(() => setState({ status: "failed" }));
    };
    if (typeof IntersectionObserver === "undefined") {
      load();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [symbol, noteEnabled, state.status, week.to, locale]);

  /* GÜN GÜN KALIN ŞERİT (14 Kasım 2026, görsel tur). Figür "sayı solda,
     birikimli çizgi sağda" idi; çizginin x ekseni kutunun sağ yarısına
     sıkışıyor, sol yarıda ~300×180 piksel boş gri zemin kalıyor, büyük sayı
     o boşlukta asılı duruyordu (canlı NVDA, 1440). Beş noktalı bir çizgi
     zaten beş sayıdan fazlasını söylemiyordu. Şimdi her seans bir satır:
     gün, sıfırdan değişime uzanan 12 piksellik şerit (yönü renginde),
     yüzde ve gürültülü seansta hacim katı. Ölçek haftanın en sert seansı;
     S&P 500'ün aynı günkü değişimi şeridin üstünde çentik. Satırlar kutunun
     tam genişliğini kullanır; not yokken de kart sayılarıyla doludur. */
  const market = week.marketSessions?.length === week.sessions.length ? week.marketSessions : null;
  const peak = Math.max(...week.sessions.map((s) => Math.abs(s.changePct)), ...(market ?? []).map((s) => Math.abs(s.changePct)), 0.5);
  /* Sıfır kulvarın ortasında; yarım kulvar = haftanın en sert seansı. */
  const half = (value: number) => (Math.abs(value) / peak) * 50;
  const stockTone = tone(week.changePct);
  const loudest = loudestSession(week.sessions);
  const gap = week.marketPct !== null ? week.changePct - week.marketPct : null;
  const gapText =
    gap === null
      ? null
      : Math.abs(gap) < 0.05
        ? labels.inlineMarket
        : (gap > 0 ? labels.aboveMarket : labels.belowMarket).replace("{pts}", nf(locale, 2).format(Math.abs(gap)));
  const text = state.text;

  return (
    <section ref={ref} className={styles.card} aria-labelledby={titleId} aria-busy={state.status === "loading" || state.status === "idle"}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {labels.moveTitle}
        </h2>
        {state.explained ? (
          <span className={styles.badge} data-explained={state.explained}>
            {labels.explained[state.explained]}
          </span>
        ) : noteEnabled ? (
          <Sparkle className={styles.icon} size={17} weight="duotone" aria-hidden />
        ) : null}
      </div>
      <p className={styles.window}>{labels.window.replace("{range}", rangeLabel(week.from, week.to, locale))}</p>

      <div className={styles.figure}>
        <div className={styles.lead}>
          <p className={styles.caption}>{labels.compare}</p>
          <p className={cn("numeral", styles.big)} data-tone={stockTone}>
            {formatPercent(week.changePct, locale, 2)}
          </p>
          {week.marketPct !== null && (
            <p className={styles.market}>
              <span>
                S&amp;P 500{" "}
                <b className="numeral" data-tone={tone(week.marketPct)}>
                  {formatPercent(week.marketPct, locale, 2)}
                </b>
              </span>
              {gapText && (
                <span className={styles.gap} data-tone={gap === null ? "flat" : tone(gap)}>
                  {gapText}
                </span>
              )}
            </p>
          )}
        </div>

        <figure className={styles.daily} aria-label={labels.pathTitle}>
          <ol className={styles.days}>
            {week.sessions.map((session, i) => {
              const dayTone = tone(session.changePct);
              const loud = (session.volumeRatio ?? 0) >= LOUD_VOLUME;
              const marketDay = market?.[i]?.changePct;
              return (
                <li key={session.date} data-loudest={i === loudest || undefined}>
                  <span className={styles.dayName}>{weekday(session.date, locale)}</span>
                  <span className={cn("value-lane", styles.lane)} data-draw="" aria-hidden>
                    {dayTone !== "flat" && (
                      <i
                        className="value-bar bar-fill"
                        data-tone={dayTone}
                        data-end={dayTone === "up" ? "end" : "start"}
                        style={
                          dayTone === "up"
                            ? { left: "50%", width: `${half(session.changePct)}%` }
                            : { right: "50%", width: `${half(session.changePct)}%` }
                        }
                      />
                    )}
                    <i className="value-notch" data-quiet="" style={{ left: "50%" }} />
                    {marketDay !== undefined && (
                      <i className={cn("value-notch", styles.marketNotch)} style={{ left: `${50 + Math.sign(marketDay) * half(marketDay)}%` }} />
                    )}
                  </span>
                  <span className={cn("numeral", styles.dayValue)} data-tone={dayTone}>
                    {formatPercent(session.changePct, locale, 1)}
                  </span>
                  {/* HACİM KISA YAZILIR (10 Kasım 2026): görünen metin simge +
                      "3,0×"; tam cümle ekran okuyucuda ve üzerine gelince.
                      14 Kasım: satırın sonunda kendi sütununda, sessiz seansta
                      sütun boş kalır (hiza bozulmaz). */}
                  <span
                    className={styles.volume}
                    title={loud ? `${labels.volumeTimes.replace("{x}", nf(locale, 1).format(session.volumeRatio!))} · ${labels.highVolume}` : undefined}
                  >
                    {loud && (
                      <>
                        <ChartBar size={12} weight="fill" aria-hidden />
                        <span aria-hidden>{`${nf(locale, 1).format(session.volumeRatio!)}×`}</span>
                        <span className="sr-only">{labels.volumeTimes.replace("{x}", nf(locale, 1).format(session.volumeRatio!))}</span>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
          {market && (
            <p className={styles.legend} aria-hidden>
              <i />
              S&amp;P 500
            </p>
          )}
        </figure>
      </div>

      {/* Claude anahtarı yoksa not alanı yok; kartı haftanın okuması doldurur. */}
      {!noteEnabled && (
        <div className={styles.note} data-state="failed">
          <WeekDigestView week={week} locale={locale} copy={copy.digest} />
        </div>
      )}
      {noteEnabled && (
        <div className={styles.note} data-state={state.status} aria-live="polite">
          {state.status === "done" && text ? (
            <>
              <p className={styles.summary}>{text.summary}</p>
              {text.points.length > 0 && (
                <details ref={points} className={styles.points}>
                  <summary>
                    {copy.points.replace("{n}", String(text.points.length))}
                    <span aria-hidden className={styles.plus}>+</span>
                  </summary>
                  <ol>
                    {text.points.map((point, index) => (
                      <li key={index}>
                        <p className={styles.pointTitle}>{point.title}</p>
                        <p className={styles.pointDetail}>{point.detail}</p>
                        {point.source && (
                          <a href={point.source.url} target="_blank" rel="noreferrer noopener" className={styles.source}>
                            {point.source.source ?? labels.source}
                            <ArrowUpRight size={12} weight="bold" aria-hidden />
                          </a>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <p className={styles.disclosure}>{labels.disclosure}</p>
            </>
          ) : state.status === "failed" ? (
            <>
              <WeekDigestView week={week} locale={locale} copy={copy.digest} />
              <p className={styles.failed}>{copy.dataOnly}</p>
            </>
          ) : (
            <>
              <p className={styles.loading}>
                <Sparkle className={styles.loadingIcon} size={14} weight="fill" aria-hidden />
                {labels.loading}
              </p>
              <Skeleton className={cn(styles.line, "w-[94%]")} />
              <Skeleton className={cn(styles.line, "w-[82%]")} />
              <Skeleton className={cn(styles.line, "w-[64%]")} />
              {/* Etkenlerin yeri (masaüstünde açık gelir): bekleme hâli de
                  gelecek notun ve notsuz okumanın boyunda (WeekMove.module.css → `.note`). */}
              <div className={styles.pendingPoints} aria-hidden>
                <Skeleton className={cn(styles.line, "w-[46%]")} />
                <Skeleton className={cn(styles.line, "w-[88%]")} />
                <Skeleton className={cn(styles.line, "w-[40%]")} />
                <Skeleton className={cn(styles.line, "w-[78%]")} />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

type DigestLabels = WeekLabels["digest"];

/**
 * HAFTANIN OKUMASI (26 Kasım 2026, sahibinin sözü: "sağ sol dengesine
 * dikkat ederek bu tasarımı iyileştirelim"). Not gelmeyince kart tek
 * cümleye düşüyor, Sor + Hafta panelinde sağ kolonun altı ~250 piksel boş
 * kalıyordu (canlı MU, 1440). Aynı beş seanstan Claude'suz üç okuma
 * (lib/week-digest.ts): beş kapanışın aralığı (kalın şerit: dip solda,
 * zirve sağda, sıfırdan kapanışa dolgu), en sert seans, yüksek hacimli
 * seans sayısı ve S&P 500'ün önünde kapatılan seans sayısı. Okuma yoksa
 * kutusu hiç basılmaz. Gün satırları zaten S&P çentiğini taşıyor; buradaki
 * sayılar o satırların özeti, yeni veri değil.
 */
function WeekDigestView({ week, locale, copy }: { week: WeekMove; locale: Locale; copy: DigestLabels }) {
  const digest = weekDigest(week);
  const { range, loudest, volume, market } = digest;
  if (!range && !loudest && !volume && !market) return null;
  const day = (date: string) => weekday(date, locale);
  const point = (p: RangePoint) => `${formatPercent(p.pct, locale, 1)} · ${p.date ? day(p.date) : copy.start}`;
  const sessions = (n: number, total: number) => copy.sessions.replace("{n}", String(n)).replace("{total}", String(total));
  let lane: { zero: number; from: number; width: number; tone: string } | null = null;
  if (range) {
    const zero = rangePosition(0, range.low.pct, range.high.pct);
    const end = rangePosition(range.close, range.low.pct, range.high.pct);
    lane = { zero, from: Math.min(zero, end), width: Math.abs(end - zero), tone: tone(range.close) };
  }
  return (
    <div className={styles.digest}>
      <p className={styles.digestTitle}>{copy.title}</p>
      {range && lane && (
        <div className={styles.range}>
          <p className={styles.rangeHead}>
            <span>{copy.range}</span>
            <span className={styles.near} data-near={range.near}>
              {copy.near[range.near]}
            </span>
          </p>
          <span className={cn("value-lane", styles.rangeLane)} data-draw="" aria-hidden>
            {lane.tone !== "flat" && lane.width > 0 && (
              <i
                className="value-bar bar-fill"
                data-tone={lane.tone}
                data-end={lane.tone === "up" ? "end" : "start"}
                style={{ left: `${lane.from}%`, width: `${lane.width}%` }}
              />
            )}
            <i className="value-notch" data-quiet="" style={{ left: `${lane.zero}%` }} />
          </span>
          <p className={styles.rangeEnds}>
            <span>
              {copy.low} <b className="numeral">{point(range.low)}</b>
            </span>
            <span>
              {copy.high} <b className="numeral">{point(range.high)}</b>
            </span>
          </p>
        </div>
      )}
      <dl className={styles.tiles}>
        {loudest && (
          <div className={styles.tile}>
            <dt>{copy.loudest}</dt>
            <dd className={cn("numeral", styles.tileValue)} data-tone={tone(loudest.changePct)}>
              {formatPercent(loudest.changePct, locale, 1)}
              <span className={styles.tileDay}>{day(loudest.date)}</span>
            </dd>
            {loudest.marketPct !== null && <dd className={styles.tileSub}>{copy.loudestMarket.replace("{pct}", formatPercent(loudest.marketPct, locale, 1))}</dd>}
          </div>
        )}
        {volume && (
          <div className={styles.tile} title={copy.volumeHint}>
            <dt>{copy.volume}</dt>
            <dd className={cn("numeral", styles.tileValue)}>{sessions(volume.loud, volume.total)}</dd>
            <dd className={styles.tileSub}>{copy.volumePeak.replace("{x}", nf(locale, 1).format(volume.peak.ratio)).replace("{day}", day(volume.peak.date))}</dd>
          </div>
        )}
        {market && (
          <div className={styles.tile}>
            <dt>{copy.market}</dt>
            <dd className={cn("numeral", styles.tileValue)}>{sessions(market.ahead, market.total)}</dd>
            <dd className={styles.tileSub}>
              {copy.marketWidest
                .replace("{pts}", `${market.widest.gapPts > 0 ? "+" : market.widest.gapPts < 0 ? "−" : ""}${nf(locale, 1).format(Math.abs(market.widest.gapPts))}`)
                .replace("{day}", day(market.widest.date))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
