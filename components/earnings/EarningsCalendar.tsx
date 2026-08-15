import Link from "next/link";
import {
  TimingChip,
  type TimingTone,
  LogoTile,
} from "@/components/ui/primitives";
import { AnalysisBadge } from "@/components/earnings/AnalysisBadge";
import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import { AlsoReporting } from "@/components/earnings/AlsoReporting";
import type { AnalysisBadge as AnalysisBadgeData, SymbolMeta } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { isSpotlight } from "@/lib/spotlight";
import { cn, formatCompact, formatEtDateLong, formatPrice, plural } from "@/lib/utils";
import type { EarningsRow } from "@/lib/schema";

/**
 * Bilanço takvimi — mockup 4d. Dikkat hiyerarşisi üç katmanlıdır:
 *   1. Gün içinde piyasa değeri en büyük iki şirket tam genişlik hero satırı
 *   2. Sonraki büyükler, satırı tam dolduran esnek mini kart ızgarasında
 *   3. Kalan yüzlerce sembol varsayılan KAPALI bir açılır bölümde —
 *      kalabalık ilk bakışta görünmez, isteyen açar (native <details>).
 *
 * Sayfadan bileşene taşındı çünkü aynı takvim iki yerde gösteriliyor:
 * `/bilancolar` tümünü, `/bilancolar/takip` yalnızca favorileri. İkisinin
 * ayrı kopyası olsaydı biri düzeltilip öteki unutulurdu.
 */

const HERO_MIN_CAP = 100e9;
const HERO_COUNT = 2;
const MID_COUNT = 6;

export function timingOf(
  hour: string | null,
  t: Dictionary,
): { label: string; short: string; tone: TimingTone } {
  if (hour === "bmo")
    return {
      label: t.earnings.beforeOpen,
      short: t.earnings.beforeOpen,
      tone: "pre",
    };
  if (hour === "amc")
    return {
      label: t.earnings.afterClose,
      short: t.earnings.afterClose,
      tone: "post",
    };
  if (hour === "dmh")
    return {
      label: t.earnings.duringMarket,
      short: t.earnings.duringMarket,
      tone: "neutral",
    };
  return {
    label: t.earnings.timeUnknown,
    short: t.earnings.timeUnknown,
    tone: "neutral",
  };
}

/**
 * Kartın sayıları — her biri kendi etiketiyle.
 *
 * Eskiden sağdaki büyük sayı çıplak duruyordu ve altındaki tek satırlık
 * künye ("Gelir Beklentisi · EPS Beklentisi 0,35") neyin ne olduğunu ilk
 * bakışta söylemiyordu. Artık başlık sayının ÜSTÜNDE, kalan ölçüler de
 * etiket–değer çiftleri hâlinde okunuyor.
 *
 * Manşet sayı gelir beklentisidir; o yoksa EPS beklentisi öne çıkar —
 * kartın en büyük yerinde bir "—" görmek bilgi taşımıyordu.
 */
type Figure = { label: string; value: string };

function cardFigures(
  row: EarningsRow,
  meta: SymbolMeta | undefined,
  locale: Locale,
  t: Dictionary,
  short: boolean,
): { headline: Figure | null; rest: Figure[] } {
  const revenue =
    row.revenueEstimate !== null && row.revenueEstimate !== undefined
      ? {
          label: short ? t.earnings.revenueShort : t.earnings.revenueEstimate,
          value: `${formatCompact(row.revenueEstimate, locale)} $`,
        }
      : null;
  const eps =
    row.epsEstimate !== null && row.epsEstimate !== undefined
      ? {
          label: short ? "EPS" : t.earnings.epsEstimate,
          value: formatPrice(row.epsEstimate, locale, { currency: true }),
        }
      : null;
  // Gün içindeki sıralama zaten piyasa değerine göre; sayı da görünsün.
  const cap = meta?.marketCap
    ? {
        label: short ? t.earnings.marketCapShort : t.market.marketCap,
        value: `${formatCompact(meta.marketCap, locale)} $`,
      }
    : null;

  const headline = revenue ?? eps;
  const rest = [revenue, eps, cap].filter(
    (figure): figure is Figure => figure !== null && figure !== headline,
  );
  return { headline, rest };
}

export type CalendarProps = {
  rows: EarningsRow[];
  meta: Record<string, SymbolMeta>;
  watchSet: Set<string>;
  /** `SEMBOL:TARİH` → yayımlanmış analiz. Boşsa hiçbir rozet basılmaz. */
  badges: Record<string, AnalysisBadgeData>;
  today: string;
  locale: Locale;
  t: Dictionary;
};

export function EarningsCalendar({
  rows,
  meta,
  watchSet,
  badges,
  today,
  locale,
  t,
}: CalendarProps) {
  const byDay = new Map<string, EarningsRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.reportDate) ?? [];
    list.push(row);
    byDay.set(row.reportDate, list);
  }

  return (
    <>
      {[...byDay.entries()].map(([date, dayRows]) => (
        <DaySection
          key={date}
          date={date}
          isToday={date === today}
          rows={dayRows}
          meta={meta}
          watchSet={watchSet}
          badges={badges}
          locale={locale}
          t={t}
        />
      ))}
    </>
  );
}

function DaySection({
  date,
  isToday,
  rows,
  meta,
  watchSet,
  badges,
  locale,
  t,
}: {
  date: string;
  isToday: boolean;
  rows: EarningsRow[];
  meta: Record<string, SymbolMeta>;
  watchSet: Set<string>;
  badges: Record<string, AnalysisBadgeData>;
  locale: Locale;
  t: Dictionary;
}) {
  /* Adla seçilmiş şirketler görünür katmanı piyasa değerine bakmadan hak
     eder. Üç katmanın tamamı `marketCap`e göre diziliyordu ve bu ölçü bu
     ekranda yanlış cevap veriyordu: CRWV'nin çeyreği aynı gün açıklayan pek
     çok 200 milyar dolarlık şirketinkinden daha çok konuşuluyor. Daha kötüsü,
     profili henüz gelmemiş bir şirket (ONDS) `marketCap` null olduğu için
     `known` filtresine hiç giremiyor ve varsayılan KAPALI bölümde
     kayboluyordu — takvimde adı geçmiyor gibi görünmesinin sebebi buydu.
     Bu yüzden filtre profile değil SEMBOLE bakıyor. Liste: lib/spotlight.ts */
  const spotlight = rows
    .filter((row) => isSpotlight(row.symbol))
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    );
  const spotlightSet = new Set(spotlight.map((row) => row.symbol));

  const known = rows
    .filter((row) => meta[row.symbol]?.marketCap && !spotlightSet.has(row.symbol))
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    );

  /* Hero satırı günün devlerine ayrılmış durumda kalıyor: adla seçilenler
     ikinci katmana giriyor, orada da tamamı görünür. */
  const heroes = known
    .filter((row) => (meta[row.symbol]?.marketCap ?? 0) >= HERO_MIN_CAP)
    .slice(0, HERO_COUNT);
  const heroSet = new Set(heroes.map((row) => row.symbol));

  const mid = [
    ...spotlight,
    ...known.filter((row) => !heroSet.has(row.symbol)),
  ].slice(0, MID_COUNT);
  const midSet = new Set(mid.map((row) => row.symbol));

  const rest = rows.filter(
    (row) => !heroSet.has(row.symbol) && !midSet.has(row.symbol),
  );
  const bmo = rest.filter((row) => row.hour === "bmo");
  const amc = rest.filter((row) => row.hour === "amc");
  const other = rest.filter((row) => row.hour !== "bmo" && row.hour !== "amc");

  const badgeOf = (row: EarningsRow) => badges[`${row.symbol}:${row.reportDate}`];

  return (
    <section aria-label={date}>
      {/* ---- Gün başlığı ----
          YAPIŞKAN VE KURALLI. Takvim beş gün alt alta akıyordu ve günleri
          birbirinden ayıran tek şey 19px'lik bir tarihti; kartların kendi
          başlıkları ondan pek küçük olmadığı için sayfa tek bir kart
          denizi gibi okunuyordu. Kalın kural bölümü açıyor, tarih kartların
          üstüne çıkıyor ve o günün kartları arasında ilerlerken tarih
          ekranın üstünde asılı kalıyor.

          Rehber sayfasındaki bölüm başlığıyla AYNI dil — iki uzun liste
          sayfası aynı şekilde bölünüyor. `top-16` uygulamanın yapışkan
          çubuğunun bir tık altında; gerekçesi orada anlatılı. */}
      <div className="sticky top-(--app-bar-h) z-10 mb-4 bg-page pt-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 border-t-2 border-strong pb-3 pt-3">
          <h2 className="text-title font-bold tracking-[-0.03em] text-strong">
            {formatEtDateLong(date, locale)}
          </h2>
          <span className="figure text-small text-muted">
            {rows.length}{" "}
            {plural(rows.length, t.earnings.companyOne, t.earnings.companyMany)}
          </span>
          {isToday && (
            <span className="rounded-full bg-down-wash px-[9px] py-[3px] text-nano font-bold tracking-[0.05em] text-down">
              {t.earnings.today.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
            </span>
          )}
        </div>
      </div>

      {/* ---- Katman 1: hero satırları ---- */}
      <div className="flex flex-col gap-2.5">
        {heroes.map((row) => {
          const m = meta[row.symbol];
          const timing = timingOf(row.hour, t);
          const { headline, rest } = cardFigures(row, m, locale, t, false);
          const badge = badgeOf(row);
          return (
            /* Kart bir <a> DEĞİL, içinde yüzeyi kaplayan bir <a> taşıyan
               kutu: analiz rozeti kendi bağlantısını taşıyor ve iç içe
               bağlantı geçersiz HTML. Görünüm birebir aynı kalıyor. */
            <div
              key={row.id}
              className="panel-hover relative flex flex-col gap-3 rounded-lg border border-line bg-surface-solid px-4 py-4 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:px-5"
            >
              <Link
                href={`/hisse/${row.symbol}`}
                prefetch={false}
                aria-label={`${row.symbol} ${m?.name ?? ""}`}
                className="absolute inset-0 rounded-lg"
              />
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <LogoTile symbol={row.symbol} logoUrl={m?.logoUrl} size="lg" />
                <div className="min-w-0">
                  {/* Yıldız sembolün SOLUNDA ve sembol bloğu sabit
                      genişlikte: zamanlama çipleri kartlar arasında aynı
                      hizada dursun, sembolün kaç harf olduğuna göre
                      sağa sola kaymasın. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex min-w-[104px] items-center gap-1.5">
                      {watchSet.has(row.symbol) && (
                        <span aria-hidden className="text-sm text-primary">
                          ★
                        </span>
                      )}
                      <span className="text-lead font-bold tracking-[-0.02em] text-strong">
                        {row.symbol}
                      </span>
                    </span>
                    <TimingChip tone={timing.tone}>{timing.label}</TimingChip>
                    {badge && <AnalysisBadge badge={badge} t={t} />}
                    {/* Adıyla yazılı hâli yalnızca hero satırlarında —
                        günün en büyük iki bilançosu, takvime girmeye en çok
                        değen ikisi. Dar listelerde ikonlu (compact) sürüm. */}
                    <AddToCalendar
                      symbol={row.symbol}
                      date={row.reportDate}
                      label={t.earnings.addToCalendar}
                    />
                  </div>
                  <p className="mt-[3px] truncate text-sm text-body">
                    {m?.name ?? ""}
                  </p>
                </div>
              </div>
              <div className="border-t border-line pt-3 sm:ml-auto sm:shrink-0 sm:border-0 sm:pt-0 sm:text-right">
                {headline ? (
                  <>
                    <p className="plate text-nano tracking-[0.09em]">
                      {headline.label}
                    </p>
                    <p className="figure mt-[3px] text-title font-bold tracking-[-0.03em] text-strong sm:text-title">
                      {headline.value}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted">{t.common.noData}</p>
                )}
                {rest.length > 0 && (
                  <dl className="mt-2 flex flex-col gap-[3px] text-small sm:items-end">
                    {rest.map((figure) => (
                      <div
                        key={figure.label}
                        className="flex items-baseline gap-2"
                      >
                        <dt className="text-muted">{figure.label}</dt>
                        <dd className="figure font-semibold text-body">
                          {figure.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Katman 2: mini kartlar ----
          Kartlar SABİT 184px genişlikteydi ve `flex-wrap` içinde duruyordu:
          altı kart kapsayıcının tamamını doldurmuyor, kalan yer satırın
          sağında ölü boşluk olarak kalıyordu — üstteki tam genişlik hero
          satırlarının yanında bu kırık görünüyordu.

          Davranış KART SAYISINA bağlı, çünkü tek bir kural ikisini birden
          çözmüyor:

            Kalabalık satır (4+) — `1fr` ile kartlar artan yeri paylaşır ve
              satırı doldurur. Sabit genişlikte bırakılınca sağda ölü boşluk
              kalıyordu ve üstteki tam genişlik hero satırlarının yanında
              kırık görünüyordu.

            Seyrek satır (1–3) — kartlar doğal genişliğinde kalır ve sola
              yaslanır. Burada `1fr` felaket: o gün tek şirket açıklama
              yaptığında kart satırın tamamına yayılıyor, "kart" olmaktan
              çıkıp anlamsız bir banda dönüşüyordu.

          Eşik 4: dörtten azı zaten satırı dolduracak kadar değil, o yüzden
          germek yerine olduğu gibi bırakmak dürüst duruyor. */}
      {mid.length > 0 && (
        <div
          className={cn(
            "mt-2.5 grid gap-2.5",
            mid.length >= 4
              ? "grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]"
              : "grid-cols-[repeat(auto-fit,minmax(9.5rem,15rem))] justify-start",
          )}
        >
          {mid.map((row) => {
            const m = meta[row.symbol];
            const timing = timingOf(row.hour, t);
            const { headline, rest } = cardFigures(row, m, locale, t, true);
            const badge = badgeOf(row);
            return (
              <div
                key={row.id}
                className="panel-hover relative flex h-full min-w-0 flex-col gap-[11px] rounded-lg border border-line bg-surface-solid p-3.5 transition-colors"
              >
                <Link
                  href={`/hisse/${row.symbol}`}
                  prefetch={false}
                  aria-label={`${row.symbol} ${m?.name ?? ""}`}
                  className="absolute inset-0 rounded-lg"
                />
                <div className="flex items-start gap-2">
                  <LogoTile symbol={row.symbol} logoUrl={m?.logoUrl} />
                  <TimingChip tone={timing.tone} size="sm" className="ml-auto">
                    {timing.short}
                  </TimingChip>
                </div>
                {/* Takvim düğmesi kimlik satırının SAĞINDA, kendi satırında
                    değil: dar kartta ayrı bir satır her karta ~32px ekliyordu
                    ve ızgara `h-full` olduğu için o boşluk hepsine yayılıyordu.
                    Burada var olan satırın sağ ucuna oturuyor, ad zaten
                    kırpılıyor. Üst satır (logo + zamanlama çipi) 152px'lik
                    kartta zaten dolu; ikon oraya sığmıyordu. */}
                <div className="flex min-w-0 items-start gap-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-read font-bold tracking-[-0.01em] text-strong">
                      {watchSet.has(row.symbol) && (
                        <span aria-hidden className="mr-1 text-primary">
                          ★
                        </span>
                      )}
                      {row.symbol}
                    </p>
                    <p className="truncate text-small text-muted">
                      {m?.name ?? ""}
                    </p>
                  </div>
                  <AddToCalendar
                    symbol={row.symbol}
                    date={row.reportDate}
                    label={t.earnings.addToCalendar}
                    compact
                    className="-mt-1 -mr-1 mb-0"
                  />
                </div>
                {badge && (
                  <AnalysisBadge
                    badge={badge}
                    t={t}
                    size="sm"
                    className="self-start"
                  />
                )}
                {/* Her sayı kendi etiketiyle: dar kartta "1,84 Mr" tek
                    başına gelir mi kâr mı belli olmuyordu.

                    MANŞET SAYI AYRIŞTI. Üç ölçü de aynı 11,5px'te, aynı
                    ağırlıkta, alt alta duruyordu; bir günde altı kart, dört
                    gün üst üste gelince sayfa gri satırlardan bir duvara
                    dönüşüyordu ve hiçbir kartın odağı yoktu. Artık gelir
                    beklentisi (yoksa EPS) kendi büyük puntosunda, kalan iki
                    ölçü onun altında sessiz bir künye. Kartın taşıdığı bilgi
                    aynı, okuma sırası farklı. Puntolar sonradan bir kademe
                    büyütüldü (16→18, 11→12.5): sayılar bir bakışta
                    okunmuyordu, hiyerarşi aynı kaldı. */}
                <div className="mt-auto border-t border-line pt-[9px]">
                  {headline && (
                    <>
                      <p className="plate text-nano tracking-[0.08em]">
                        {headline.label}
                      </p>
                      <p className="figure mt-[3px] text-lead font-bold leading-none tracking-[-0.03em] text-strong">
                        {headline.value}
                      </p>
                    </>
                  )}
                  {rest.length > 0 && (
                    <dl
                      className={cn(
                        "flex flex-col gap-[2px] text-small",
                        headline && "mt-2",
                      )}
                    >
                      {rest.map((figure) => (
                        <div
                          key={figure.label}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <dt className="text-muted">{figure.label}</dt>
                          <dd className="figure font-semibold text-body">
                            {figure.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Katman 3: kalanlar ----
           Çipler artık sunucuda ÇİZİLMİYOR, veri olarak geçiyor: kapalı bir
           `<details>` içindeki 1.354 çip HTML'in yarısını yiyordu. Gerekçe
           `AlsoReporting` dosyasının başında. */}
      <AlsoReporting
        label={t.earnings.alsoReporting}
        total={rest.length}
        groups={[
          { label: t.earnings.beforeOpen, tone: "pre", list: bmo },
          { label: t.earnings.afterClose, tone: "post", list: amc },
          { label: t.earnings.timeUnknown, tone: "neutral", list: other },
        ].map((group) => ({
          label: group.label,
          tone: group.tone as "pre" | "post" | "neutral",
          symbols: group.list.map((row) => ({
            symbol: row.symbol,
            watched: watchSet.has(row.symbol),
          })),
        }))}
      />
    </section>
  );
}
