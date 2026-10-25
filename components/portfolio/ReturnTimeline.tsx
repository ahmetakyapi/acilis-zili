import { DuoLineChart, type DuoChartPoint } from "@/components/charts/DuoLineChart";
import { Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { gapVerdict, monthTicks, profilePoints } from "@/lib/return-timeline";
import { loadReturnTimeline, type TimelineQuoteKey } from "@/lib/return-timeline-data";
import { formatPercent, formatPrice } from "@/lib/utils";

/**
 * "ALIŞTAN BUGÜNE" (25 Ekim) — portföy ve aynı günlerde SPY, çift çizgi.
 *
 * İki ekranda, iki ayrıntı düzeyinde:
 * - `/portfoy` (sahibin kendi ekranı): kendi paneli, okuma kartında gün.
 * - Profil (`variant="profile"`): vitrin panelinin İÇİNDE ve yalnız sahip
 *   portföy bloğunu açtıysa. Tarih AY hassasiyetinde — gün bazında alış
 *   tarihi KVKK metninin "hiçbir durumda gösterilmez" sınıfında; istemciye
 *   gün bile gönderilmiyor, etiketler sunucuda aya indirilmiş geliyor.
 *   Noktalar ay sonları, yüzdeler sunucuda bir ondalığa yuvarlı, SPY tabanı
 *   alış ayının ilk kapanışı (`profilePoints`, `spyAnchorDay`): istemci
 *   verisinden alış günü geri hesaplanamıyor.
 *
 * TEK SERİ: iki ekran aynı `loadReturnTimeline` hesabını okur; profil
 * onun ay sonu noktalarıdır. Eksenin ilk etiketi bu yüzden iki ekranda da
 * alış ayı ("Haz 26"); haftalık seyreltmede ilk nokta haftanın sonuna
 * kayıp profilde "Tem 26" yazıyordu.
 *
 * İkisinde de TUTAR YOK: çizgi yüzde, künye yüzde.
 */

const SENTENCE_DIGITS = 1;
/** Okuma kartı ve eksen için gün dizisinden etiket. */
function dayLabel(day: string, locale: Locale, monthOnly: boolean) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: "UTC",
    ...(monthOnly ? { month: "long", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" }),
  }).format(new Date(`${day}T12:00:00Z`));
}
function axisLabel(day: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: "UTC",
    month: "short",
    year: "2-digit",
  }).format(new Date(`${day}T12:00:00Z`));
}

export async function ReturnTimeline({
  userId,
  quoteKey,
  locale,
  t,
  variant = "portfolio",
}: {
  userId: string;
  quoteKey: TimelineQuoteKey;
  locale: Locale;
  t: Dictionary;
  variant?: "portfolio" | "profile";
}) {
  const loaded = await loadReturnTimeline(userId, quoteKey);
  if (!loaded) return null;
  const L = t.personalVisuals.timeline;
  const monthOnly = variant === "profile";
  /* Profilde ay sonu noktaları, yuvarlı: gerekçe `profilePoints`. */
  const data = monthOnly ? { ...loaded, points: profilePoints(loaded.points) } : loaded;
  /* Tamamlanmış ay yoksa (bu ay alınmış) profilde tek nokta kalır: çizgi yok. */
  if (data.points.length < 2) return null;
  const days = data.points.map((p) => p.day);
  const lastIndex = data.points.length - 1;

  const points: DuoChartPoint[] = data.points.map((p, i) => ({
    label: i === lastIndex ? L.now : dayLabel(p.day, locale, monthOnly),
    a: p.portfolio,
    b: p.spy,
  }));
  const axis = monthTicks(days).map((index) => ({
    index,
    label: index === lastIndex ? L.now : axisLabel(days[index], locale),
  }));

  const last = data.points[lastIndex];
  const verdict = gapVerdict(last.portfolio, last.spy);
  const pct = (value: number) => formatPercent(value, locale, SENTENCE_DIGITS);
  const sentence = (verdict === "none" ? L.noSpy : L[verdict])
    .replace("{portfolio}", pct(last.portfolio))
    .replace("{spy}", last.spy === null ? "" : pct(last.spy))
    .replace("{gap}", last.spy === null ? "" : formatPrice(Math.abs(last.portfolio - last.spy), locale, { digits: SENTENCE_DIGITS }));

  const notes = [
    L.note,
    data.weekly ? L.weekly : null,
    data.missing > 0 ? L.missing.replace("{n}", String(data.missing)) : null,
    data.stale ? L.stale : null,
  ].filter((note): note is string => note !== null);

  const chart = (
    <DuoLineChart
      points={points}
      aName={L.portfolio}
      bName={last.spy === null && data.points.every((p) => p.spy === null) ? null : L.spy}
      axis={axis}
      title={L.chartLabel}
      locale={locale}
      labels={{ gap: L.gap, points: L.points, hint: L.hint }}
      height={variant === "profile" ? 160 : 200}
    />
  );

  if (variant === "profile") {
    return (
      <div className="flex flex-col gap-2.5">
        <h3 className="text-tiny font-semibold text-muted">{L.title}</h3>
        <p className="text-small leading-relaxed text-body">{sentence}</p>
        {chart}
        {/* Bayat kotasyon künyesi profilde de (O3): son nokta gecikmeli
            fiyatsa bunu çizginin altında söyler, /portfoy'daki gibi. */}
        {data.stale && <p className="text-tiny leading-relaxed text-muted">{L.stale}</p>}
      </div>
    );
  }

  return (
    <Panel id="alistan-bugune" className="scroll-mt-28">
      <PanelHeader title={L.title} />
      <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5">
        <p className="max-w-3xl text-read leading-relaxed text-strong">{sentence}</p>
        {chart}
      </div>
      {/* Künye panelin İÇİNDE, hairline ile (ekran düzeni 6). */}
      <div className="flex flex-col gap-1.5 border-t border-line px-4 py-3 text-small leading-relaxed text-muted sm:px-5">
        {notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </Panel>
  );
}

/** Akış sürerken yer tutucu — grafikle aynı boy, inince alttaki hiçbir şey kaymıyor. */
export function ReturnTimelineSkeleton({ title }: { title: string }) {
  return (
    <Panel aria-busy>
      <PanelHeader title={title} />
      {/* Boylar gerçek panelin ölçüsü: cümle 27, grafik 200 + eksen 14 +
          lejant 20 + iki 10'luk aralık, künye şeridi. */}
      <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-[254px] w-full" />
      </div>
      <div className="border-t border-line px-4 py-3 sm:px-5">
        <Skeleton className="h-10 w-full" />
      </div>
    </Panel>
  );
}
