import type { CSSProperties } from "react";
import { ScaleBar } from "@/components/markets/CompareScale";
import { TimingChip } from "@/components/ui/primitives";
import type { TimingTone } from "@/components/ui/primitives";
import { daysBetweenEt } from "@/lib/market-hours";
import { cn, etDateParts, formatEtDateCompact } from "@/lib/utils";
import css from "./CompanyEarnings.module.css";

/**
 * SIRADAKİ BİLANÇO ÇİZİMİ — `/bilancolar/[symbol]` (31 Ekim).
 *
 * NEDEN: panel tarihi düz metin, kalan günü ve iki beklentiyi üç gri
 * kutuda düz sayı olarak veriyordu; sahibinin sözü "çok eksik hissettiriyor,
 * çok daha görsel ve anlaşılır olmalı". Üç okuma artık çizimle:
 *
 *   · TAKVİM YAPRAĞI — /bilancolar/analizler "Yaklaşan Bilançolar"ın
 *     yaprağının büyük hâli: ay şeridi, gün, hafta günü. Saat duyurulmamış
 *     tarih TAHMİNİDİR (`when.estimated`): yaprağın kenarı kesik çizgi, şerit
 *     dolu değil soluk ve altında "Tahmini Tarih" yazılı — kesinmiş gibi
 *     basılmaz (CLAUDE.md "Veri Dürüstlüğü" 1).
 *   · ÇEYREK ÇİZGİSİ — son rapordan sıradakine geçen yol. Uçlarda iki
 *     tarih YAZILI, kalan gün büyük puntoyla yazılı; çizgi bu üç sayının
 *     kopyası (`aria-hidden` değil, tek cümleyle adlanıyor). Son rapor
 *     bilinmiyorsa çizgi HİÇ basılmaz: çeyreğin uzunluğunu uydurmak olurdu;
 *     rapor üç hafta içindeyse yerine kalan günleri sayan gün şeridi gelir.
 *   · BEKLENTİ + SON ÇEYREK — beklenti büyük, altında son çeyreğin
 *     gerçekleşeniyle yan yana iki çubuk (CompareScale dili: EPS işaretten
 *     renk alır, gelir büyüklüktür, yumuşak mavi). Son çeyrek yoksa çubuk
 *     yok, yalnız sayı.
 */

/** Gün şeridinin üst sınırı — üç hafta (gerekçe `ticks`). */
const MAX_TICK_DAYS = 21;

export type NextReportLabels = {
  daysLeft: string;
  today: string;
  daysValue: string;
  estimatedDate: string;
  lastReport: string;
  reportDay: string;
  cycleAria: string;
  epsEstimate: string;
  revenueEstimate: string;
  lastQuarter: string;
  estimateLabel: string;
};

type Figure = {
  /** Beklenti — biçimlenmiş ve ham. */
  estimate: { text: string; value: number };
  /** Son çeyreğin gerçekleşeni; yoksa çubuk basılmaz. */
  last: { text: string; value: number } | null;
};

export function NextReport({
  date,
  previousDate,
  today,
  daysLeft,
  estimated,
  timing,
  clockLine,
  eps,
  revenue,
  locale,
  labels,
}: {
  date: string;
  previousDate: string | null;
  today: string;
  daysLeft: number;
  estimated: boolean;
  timing: { label: string; tone: TimingTone } | null;
  clockLine: string | null;
  eps: Figure | null;
  revenue: Figure | null;
  locale: string;
  labels: NextReportLabels;
}) {
  const parts = etDateParts(date, locale);
  const anchor = new Date(`${date}T12:00:00Z`);
  const tag = locale === "tr" ? "tr-TR" : "en-US";
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "long", timeZone: "UTC" }).format(anchor);
  const year = new Intl.DateTimeFormat(tag, { year: "numeric", timeZone: "UTC" }).format(anchor);

  /* Çizgi: son rapordan bugüne geçen günün, iki rapor arasındaki güne oranı
     (ET takvim günü, `daysBetweenEt` — kalan gün de aynı fonksiyondan). */
  const span = previousDate ? daysBetweenEt(previousDate, date) : 0;
  const elapsed = previousDate ? daysBetweenEt(previousDate, today) : 0;
  const cycle = previousDate && span > 0 ? Math.min(1, Math.max(0, elapsed / span)) : null;
  /* Gün şeridinin çentik sayısı: bugün + kalan günler. Üç haftadan uzunsa
     çentikler okunmayacak kadar sıklaşıyor; o zaman şerit yok. */
  const ticks = daysLeft >= 1 && daysLeft <= MAX_TICK_DAYS ? daysLeft + 1 : 0;

  return (
    <div className={css.next}>
      <div className={css.leafCol}>
        <div className={css.leaf} data-estimated={estimated || undefined} data-today={daysLeft <= 0 || undefined}>
          <span className={css.leafBand}>
            {parts.month} {year}
          </span>
          <b className={cn("numeral", css.leafDay)}>{parts.day}</b>
          <span className={css.leafWeekday}>{weekday}</span>
        </div>
        {estimated && <span className={css.leafNote}>{labels.estimatedDate}</span>}
      </div>

      <div className={css.countdown}>
        <div className={css.countHead}>
          <p className={css.countLabel}>{labels.daysLeft}</p>
          <p className={cn("figure", css.countValue)}>
            {daysLeft <= 0 ? labels.today : labels.daysValue.replace("{n}", String(daysLeft))}
          </p>
          {(timing || clockLine) && (
            <div className={css.windowRow}>
              {timing && <TimingChip tone={timing.tone}>{timing.label}</TimingChip>}
              {clockLine && <span className="figure text-small text-body">{clockLine}</span>}
            </div>
          )}
        </div>

        {/* GÜN ŞERİDİ — son rapor bilinmiyorsa (takvimde geçmiş satır yok,
            ör. AAPL 31 Ekim) çeyrek çizgisi çizilemez; yakın raporda kalan
            günler tek tek sayılıyor: bir çentik bir gün, ilk çentik bugün,
            son çentik bilanço günü. Çentik sayısı yazılı sayının kendisi. */}
        {cycle === null && ticks > 0 && (
          <div
            className={css.cycle}
            role="img"
            aria-label={`${labels.daysLeft}: ${labels.daysValue.replace("{n}", String(daysLeft))}`}
          >
            <span className={css.dayTicks}>
              {Array.from({ length: ticks }, (_, index) => (
                <i
                  key={index}
                  data-at={index === 0 ? "today" : index === ticks - 1 ? "end" : undefined}
                  data-estimated={(index === ticks - 1 && estimated) || undefined}
                />
              ))}
            </span>
            <span className={css.cycleEnds}>
              <span>
                <span className={css.cycleEndLabel}>{labels.today}</span>
                <span className="figure">{formatEtDateCompact(today, locale)}</span>
              </span>
              <span>
                <span className={css.cycleEndLabel}>{labels.reportDay}</span>
                <span className="figure">{formatEtDateCompact(date, locale)}</span>
              </span>
            </span>
          </div>
        )}

        {cycle !== null && previousDate && (
          <div
            className={css.cycle}
            role="img"
            aria-label={labels.cycleAria
              .replace("{elapsed}", String(Math.max(0, elapsed)))
              .replace("{left}", String(Math.max(0, daysLeft)))}
          >
            <span className={css.cycleLane} data-motion-track>
              <span
                className={css.cycleFill}
                data-motion-draw="line"
                style={{ width: `${cycle * 100}%`, transformOrigin: "left center" }}
              />
              <span className={css.cycleStart} />
              <span className={css.cycleNow} style={{ "--at": cycle } as CSSProperties} />
              <span className={css.cycleEnd} data-estimated={estimated || undefined} />
            </span>
            <span className={css.cycleEnds}>
              <span>
                <span className={css.cycleEndLabel}>{labels.lastReport}</span>
                <span className="figure">{formatEtDateCompact(previousDate, locale)}</span>
              </span>
              <span>
                <span className={css.cycleEndLabel}>{labels.reportDay}</span>
                <span className="figure">{formatEtDateCompact(date, locale)}</span>
              </span>
            </span>
          </div>
        )}
      </div>

      {(eps || revenue) && (
        <dl className={css.expect}>
          {eps && <ExpectCell title={labels.epsEstimate} figure={eps} tone="signal" labels={labels} />}
          {revenue && <ExpectCell title={labels.revenueEstimate} figure={revenue} tone="neutral" labels={labels} />}
        </dl>
      )}
    </div>
  );
}

function ExpectCell({
  title,
  figure,
  tone,
  labels,
}: {
  title: string;
  figure: Figure;
  tone: "signal" | "neutral";
  labels: NextReportLabels;
}) {
  const { estimate, last } = figure;
  const scale = last ? Math.max(Math.abs(estimate.value), Math.abs(last.value)) || 1 : 1;
  /* İşaretli ray yalnız iki değer sıfırın iki yanındaysa (zarardan kâra);
     ikisi de eksideyse uzunluk büyüklük, renk işaretten (ScaleBar `signal`). */
  const signed = last !== null && Math.sign(estimate.value) * Math.sign(last.value) < 0;
  const row = (label: string, item: { text: string; value: number }, strong: boolean) => (
    <span className={css.expectRow} data-strong={strong || undefined}>
      <span className={css.expectRowLabel}>{label}</span>
      <ScaleBar
        ratio={item.value / scale}
        signed={signed}
        tone={tone}
        className={cn("mt-0 max-w-none", !strong && "opacity-55")}
      />
      <span className={cn("figure", css.expectRowValue)}>{item.text}</span>
    </span>
  );
  return (
    <div className={css.expectCell}>
      <dt>{title}</dt>
      <dd className={cn("figure", css.expectValue)}>{estimate.text}</dd>
      {last && (
        <dd className={css.expectBars}>
          {row(labels.estimateLabel, estimate, true)}
          {row(labels.lastQuarter, last, false)}
        </dd>
      )}
    </div>
  );
}
