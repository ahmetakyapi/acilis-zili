import { Suspense } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { CompanyCards } from "@/components/ui/CompanyCards";
import styles from "./EarningsCalendar.module.css";
import {
  TimingChip,
  type TimingTone,
  LogoTile,
} from "@/components/ui/primitives";
import { AnalysisBadge } from "@/components/earnings/AnalysisBadge";
import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import { AlsoReporting } from "@/components/earnings/AlsoReporting";
import { EarningsVote } from "@/components/earnings/vote/EarningsVote";
import type { AnalysisBadge as AnalysisBadgeData, SymbolMeta } from "@/lib/data";
import { earningsHref } from "@/lib/earnings-company";
import { verdictOf } from "@/lib/analysis";
import { boardFor, buildVoteView, type VoteView } from "@/lib/earnings-vote";
import type { VoteBoard } from "@/lib/earnings-vote-data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { SessionLane, type SessionLaneWindow } from "@/components/earnings/SessionLane";
import { closeMinutesFor, daysBetweenEt, SESSION_BOUNDS, type MarketHoliday } from "@/lib/market-hours";
import { clockOf, timePair, zoneTag } from "@/lib/session-clock";
import { isSpotlight } from "@/lib/spotlight";
import { cn, formatMoneyCompact, formatEtDateLong, formatPrice, NO_VALUE, plural } from "@/lib/utils";
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
/** Seyrek günde katlanmadan basılan en çok sembol (gerekçe `DaySection`). */
const SPARSE_INLINE_MAX = 24;

export function timingOf(
  hour: string | null,
  t: Dictionary,
): { label: string; short: string; tone: TimingTone } {
  /* KISA HÂL GERÇEKTEN KISA. `short` alanı vardı ama uzun etiketin
     kopyasıyla dolduruluyordu ve sözlükteki kısa karşılıklar hiç
     kullanılmıyordu. Mini kartlarda çip 102 piksel, kartın kendisi 172:
     logonun yanındaki bütün boşluğu tek bir çip yiyordu ve o çip bir
     günün altı kartında da AYNI olduğu için hiçbir şey ayırt etmiyordu.
     Kısa hâlde ~62 piksel. */
  if (hour === "bmo")
    return {
      label: t.earnings.beforeOpen,
      short: t.earnings.beforeOpenShort,
      tone: "pre",
    };
  if (hour === "amc")
    return {
      label: t.earnings.afterClose,
      short: t.earnings.afterCloseShort,
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
 * Manşet sayı gelir beklentisidir; o yoksa EPS beklentisi, o da yoksa
 * piyasa değeri öne çıkar — kartın en büyük yerinde bir "—" ya da hiçbir şey
 * görmek bilgi taşımıyordu. Sıranın gerekçesi aşağıda.
 */
type Figure = { label: string; value: string };

function cardFigures(
  row: EarningsRow,
  meta: SymbolMeta | undefined,
  locale: Locale,
  t: Dictionary,
  short: boolean,
): { headline: Figure | null; rest: Figure[]; capNote: Figure | null } {
  const revenue =
    row.revenueEstimate !== null && row.revenueEstimate !== undefined
      ? {
          label: short ? t.earnings.revenueShort : t.earnings.revenueEstimate,
          /* Kod geçiliyor: sağlayıcının bilanço tahminleri şirketin ANA
             borsasının parasında geliyor (PDD'nin gelir beklentisi CNY,
             AFYA BRL). Bugün sızmıyor — piyasa değeri USD dışında null
             olduğu için o semboller görünür katmanlara giremiyor — ama
             `SPOTLIGHT_SYMBOLS` listesine USD dışı tek bir ad eklendiği gün
             kart sessizce dolar basardı. */
          value: formatMoneyCompact(row.revenueEstimate, locale, meta?.currency),
        }
      : null;
  const eps =
    row.epsEstimate !== null && row.epsEstimate !== undefined
      ? {
          label: short ? "EPS" : t.earnings.epsEstimate,
          /* `|| true`, `?? true` DEĞİL: `symbols.currency` boş dize
             olabiliyor ve `{ currency: "" }` `formatPrice` içinde
             "para birimi yok" dalına düşüp çıplak sayı bastırıyordu. */
          value: formatPrice(row.epsEstimate, locale, {
            currency: meta?.currency || true,
          }),
        }
      : null;
  // Gün içindeki sıralama zaten piyasa değerine göre; sayı da görünsün.
  const cap = meta?.marketCap
    ? {
        label: short ? t.earnings.marketCapShort : t.market.marketCap,
        value: formatMoneyCompact(meta.marketCap, locale),
      }
    : null;

  /* MANŞET SIRASI: gelir beklentisi → EPS beklentisi → piyasa değeri.
     Üçüncü basamak sonradan eklendi. Beklentisi olmayan şirkette (takvimde
     çoğunluk: kapalı uçlu fonlar, mikro ölçekli şirketler) manşet boş
     kalıyordu ve kart `h-full` ile satırın en uzun kartı kadar uzadığı için
     ortasında avuç içi kadar bir boşluk açılıyordu — dört kartlık bir
     satırda üçü böyleydi. Piyasa değeri o boşluğu dolduran uydurma bir sayı
     değil: kartın zaten bastığı, sıralamayı belirleyen ölçü. Etiketi
     sayının üstünde durduğu için hangi kartta ne yazdığı karışmıyor. */
  /* SIFIR GELİR MANŞET OLMAZ (10 Kasım, görsel kalite turu). Geliri
     olmayan şirketlerde (klinik aşamadaki biyoteknoloji, maden geliştirici:
     TNGX, COAG, LAC, CADL, ACTU — canlı takvim, 10–13 Kasım) sağlayıcı
     gelir beklentisini 0 yazıyor ve kartın EN BÜYÜK puntosunda "0,00 $"
     duruyordu: bir günün altı kartının ikisi anlamsız bir sıfırı
     bağırıyordu. Sıfır yine doğru bir bilgi (şirketten gelir beklenmiyor)
     ve silinmiyor; manşetten ikincil satıra iniyor, manşete EPS beklentisi
     (o da yoksa piyasa değeri) çıkıyor. Eşik 1 birim: yuvarlama artığı
     ("0,4 $") da sıfır sayılır, küçük ama gerçek gelir (12 B $) sayılmaz. */
  const noRevenue = revenue !== null && Math.abs(row.revenueEstimate ?? 0) < 1;
  const headline = (noRevenue ? null : revenue) ?? eps ?? cap ?? revenue;
  const tumu = [revenue, eps, cap].filter(
    (figure): figure is Figure => figure !== null && figure !== headline,
  );
  /* MİNİ KARTTA EN FAZLA BİR İKİNCİL ÖLÇÜ. Yığın karttan karta 0–2 satır
     arasında oynuyordu ve kart `h-full` ile satırın en uzun kartı kadar
     uzadığı için fark, kısa kartların altında boşluk olarak birikiyordu.
     Düşen ölçü hemen her zaman piyasa değeri oluyordu.

     PİYASA DEĞERİ GERİ GELDİ — ama DEĞİŞKEN satır olarak değil, kartın
     dibinde SABİT bir künye olarak. Yükseklik sorunu ölçünün kendisinden
     değil, kaç satır çizildiğinin karttan karta oynamasından geliyordu;
     her kartta tam olarak bir künye satırı olunca fark ortadan kalkıyor.
     Sayı zaten kartın sıralamasını belirleyen ölçü ve okuyucunun "bu şirket
     ne büyüklükte" sorusunu soracağı ilk yer bilanço kartı.

     Künye yalnızca manşet ya da ikincil listede ZATEN yoksa basılıyor:
     beklentisi olmayan kartlarda piyasa değeri manşete çıkıyor ve aynı sayı
     iki kez yazılmamalı. */
  const rest = short ? tumu.slice(0, 1) : tumu;
  const capNote =
    short && cap && headline !== cap && !rest.includes(cap) ? cap : null;
  return { headline, rest, capNote };
}

type CalendarProps = {
  rows: EarningsRow[];
  meta: Record<string, SymbolMeta>;
  watchSet: Set<string>;
  /** `SEMBOL:TARİH` → yayımlanmış analiz. Boşsa hiçbir rozet basılmaz. */
  badges: Record<string, AnalysisBadgeData>;
  today: string;
  locale: Locale;
  t: Dictionary;
  /**
   * "Beklentiyi Geçer mi?" oylaması (24 Ekim) — yalnızca oturum açık ve
   * tablo varken (`board.available`). Verilmezse kartlar eski hâliyle.
   */
  vote?: { board: VoteBoard; holidays: MarketHoliday[]; now: Date };
  /**
   * Borsa tatilleri — baş kartın seans şeridi kapanış zilini o GÜNÜN
   * kapanışından yazar (yarım günde 13:00 ET). Verilmezse olağan kapanış.
   */
  holidays?: readonly MarketHoliday[];
};

/**
 * Kartın oy görünümü. Takvim kartında oy düğmesi YALNIZCA açıkken; kapanmış
 * bir oylama kartta ancak okur oy verdiyse (kendi oyu ve dağılım) kalıyor.
 * Oy vermediği kapanmış oylamayı kartta göstermek, günün kartlarına
 * okurun hiç dokunmadığı bir satır eklemek olurdu — o satırın yeri şirketin
 * bilanço sayfası.
 */
function cardVote(row: EarningsRow, vote: CalendarProps["vote"]): VoteView | null {
  if (!vote?.board.available) return null;
  const view = buildVoteView({ row, holidays: vote.holidays, now: vote.now, ...boardFor(vote.board, row) });
  return view.phase === "open" || view.mine !== null ? view : null;
}

export function EarningsCalendar({
  rows,
  meta,
  watchSet,
  badges,
  today,
  locale,
  t,
  vote,
  holidays = vote?.holidays ?? [],
}: CalendarProps) {
  const byDay = new Map<string, EarningsRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.reportDate) ?? [];
    list.push(row);
    byDay.set(row.reportDate, list);
  }

  /* ŞİRKET KARTI — yalnızca logosu çizilen hero ve orta kartlar; "Ayrıca
     Açıklayanlar" satırı yalnızca sembol yazıyor. Tek kayıt, tek kotasyon
     turu (gün başına ayrı tur açılmasın); akışla iniyor. */
  const carded = [...byDay.values()].flatMap((dayRows) => {
    const { heroes, mid } = dayTiers(dayRows, meta);
    return [...heroes, ...mid].map((row) => row.symbol);
  });

  return (
    <>
      <Suspense fallback={null}>
        <CompanyCards symbols={carded} names={meta} />
      </Suspense>
      {[...byDay.entries()].map(([date, dayRows]) => (
        <DaySection
          key={date}
          date={date}
          today={today}
          rows={dayRows}
          meta={meta}
          watchSet={watchSet}
          badges={badges}
          locale={locale}
          t={t}
          vote={vote}
          holidays={holidays}
        />
      ))}
    </>
  );
}

/**
 * Günün üç katmanı: hero satırları, orta kartlar ve kalanlar. Takvimin
 * kendisi ve şirket kartı kaydı (yalnızca logosu çizilen hero ve orta
 * kartlar) aynı hesabı okuyor.
 */
function dayTiers(rows: EarningsRow[], meta: Record<string, SymbolMeta>) {
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

  return { heroes, mid, heroSet, midSet };
}

/** Takvim satırının `hour` alanı → seans şeridinin penceresi. */
function laneWindow(hour: string | null): SessionLaneWindow {
  const key = hour?.trim();
  return key === "bmo" || key === "amc" || key === "dmh" ? key : null;
}

function DaySection({
  date,
  today,
  rows,
  meta,
  watchSet,
  badges,
  locale,
  t,
  vote,
  holidays,
}: {
  date: string;
  today: string;
  rows: EarningsRow[];
  meta: Record<string, SymbolMeta>;
  watchSet: Set<string>;
  badges: Record<string, AnalysisBadgeData>;
  locale: Locale;
  t: Dictionary;
  vote: CalendarProps["vote"];
  holidays: readonly MarketHoliday[];
}) {
  const { heroes, mid, heroSet, midSet } = dayTiers(rows, meta);
  /* Günün iki zili okurun birincil saatiyle — baş kartın seans şeridi
     (`SessionLane`). Gün başına bir kez; kapanış o günün kapanışı. */
  const closeMinutes = closeMinutesFor(date, [...holidays]);
  const bells = {
    open: timePair(date, clockOf(SESSION_BOUNDS.regularOpen), locale).primary,
    close: timePair(date, clockOf(closeMinutes), locale).primary,
  };
  const laneLabels = {
    pre: t.earnings.beforeOpen,
    regular: t.calendarVisuals.sessionLane.regular,
    after: t.earnings.afterClose,
    unknown: t.earnings.timeUnknown,
    open: t.calendarVisuals.sessionLane.open,
    close: t.calendarVisuals.sessionLane.close,
    aria: t.calendarVisuals.sessionLane.aria,
  };
  /* Rozet satırı yalnız GÜNDE rozetli kart varken (10 Kasım): gerekçe
     aşağıda, mini kartın sınıf listesinde. */
  const midHasBadge = mid.some((row) => badges[`${row.symbol}:${row.reportDate}`] !== undefined);
  /* SEYREK GÜN (10 Kasım): görünür katmana giren şirket yok. Gerekçe
     aşağıda, `AlsoReporting` çağrısında. */
  const sparse = heroes.length + mid.length === 0;
  const rest = rows.filter(
    (row) => !heroSet.has(row.symbol) && !midSet.has(row.symbol),
  );
  const bmo = rest.filter((row) => row.hour === "bmo");
  const amc = rest.filter((row) => row.hour === "amc");
  const other = rest.filter((row) => row.hour !== "bmo" && row.hour !== "amc");

  const badgeOf = (row: EarningsRow) => badges[`${row.symbol}:${row.reportDate}`];
  /* Oy satırı orta kartlarda ALT IZGARANIN BEŞİNCİ SATIRI: satırdaki bir
     kartta bile oy varsa hepsi beş satırlı, oysuz kart o satırı boş
     taşıyor — rozet satırının kuralı (aşağıda). */
  const voteOf = (row: EarningsRow) => cardVote(row, vote);
  const midVotes = mid.map(voteOf);
  const midHasVote = midVotes.some((view) => view !== null);
  const voteNode = (view: VoteView) => (
    <EarningsVote
      view={view}
      signedIn
      labels={t.earningsSeason.vote}
      lock=""
      variant="card"
      signInHref="/giris"
      locale={locale}
    />
  );
  const away = daysBetweenEt(today, date);
  const watched = rows.filter((row) => watchSet.has(row.symbol)).length;

  return (
    <section id={`earnings-day-${date}`} aria-label={date} className={styles.day}>
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
      {/* YAPIŞKAN BAŞLIK KART İÇERİĞİNİN ÜSTÜNDE — z-20, z-10 DEĞİL.
          Kartlardaki "Takvime Ekle" bağlantısı da `z-10` taşıyor (satır
          tıklamasını kaplayan bağlantının üstünde kalması için) ve aynı
          yığın bağlamında eşit z-index'te SONRAKİ eleman kazanıyor: gün
          başlığı ekranın tepesine yapıştığında altından geçen kartın takvim
          ikonu başlığın "83 şirket" sayacının üstüne çiziliyordu. Üst çubuk
          z-30, yani 20 aradaki doğru basamak. */}
      <div className={cn("sticky top-(--app-bar-h) z-20 mb-4 bg-page pt-1", styles.dateHeader)}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 border-t-2 border-strong pb-3 pt-3">
          <h2 className="text-title font-bold tracking-[-0.03em] text-strong">
            {formatEtDateLong(date, locale)}
          </h2>
          {/* UZAKLIK ROZETİ, YALNIZCA "BUGÜN" DEĞİL. Rozet iki şeyi birden
              düzeltiyor.
              Renk: eski rozet `bg-down-wash text-down` idi, yani bu üründe
              "düşüş" demek olan kırmızı bir tarih etiketinde duruyordu.
              Renk sözlüğü tek cümle — renk yalnızca yukarı, aşağı ve
              etkileşim söyler; "bugün" üçüncüsü.
              Kapsam: takvim beş gün alt alta akıyor ve ikinci günün yarın mı
              üç gün sonra mı olduğu ancak tarih kafadan çözülerek
              bulunuyordu. Ekonomik takvim aynı soruyu aynı rozetle çözmüş
              durumda (`app/(app)/takvim/page.tsx`); burada da o dil
              kullanılıyor, üçüncü bir dil icat edilmiyor — büyük harf de
              orada yok, burada da kalktı. */}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-nano font-bold",
              away === 0
                ? "bg-primary text-on-primary"
                : "bg-surface-elevated text-soft",
            )}
          >
            {away === 0
              ? t.calendar.today
              : away === 1
                ? t.calendar.tomorrow
                : `${away} ${t.calendar.daysAway}`}
          </span>
          {/* Sayaç ve takip künyesi sağ uçta. Takip sayısı takvimin en
              kişisel bilgisi ve yeni sorgu istemiyor — `watchSet` bileşene
              zaten geliyor. Hepsi takipteyse basılmıyor: takip sekmesinde
              (`/bilancolar/takip`) her satır zaten takipte ve "6 şirket ·
              ★ 6 takipte" hiçbir şey söylemiyor. */}
          <span className={cn("figure ml-auto flex items-baseline gap-2 text-small text-muted", styles.dayCount)}>
            <span>
              <b>{rows.length}</b>{" "}
              {plural(
                rows.length,
                t.earnings.companyOne,
                t.earnings.companyMany,
              )}
            </span>
            {watched > 0 && watched < rows.length && (
              <>
                <span aria-hidden>·</span>
                <span className="text-primary-ink">
                  <span aria-hidden>★ </span>
                  {watched} {t.dayRail.watchedNote}
                </span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* ---- Katman 1: hero satırları ---- */}
      <div data-motion-stagger className={cn("flex flex-col gap-2.5", styles.heroList)}>
        {heroes.map((row) => {
          const m = meta[row.symbol];
          const timing = timingOf(row.hour, t);
          const { headline, rest } = cardFigures(row, m, locale, t, false);
          const badge = badgeOf(row);
          const heroVote = voteOf(row);
          return (
            /* Kart bir <a> DEĞİL, içinde yüzeyi kaplayan bir <a> taşıyan
               kutu: analiz rozeti kendi bağlantısını taşıyor ve iç içe
               bağlantı geçersiz HTML. Görünüm birebir aynı kalıyor. */
            /* `sm:flex-wrap`: oy satırı (varsa) geniş ekranda kimlik ve
               ölçü sütununun ALTINDA tam genişlik bir satır; oysuz kartta
               sarma hiçbir şeyi değiştirmiyor. */
            <div
              key={row.id}
              /* ÜÇ BÖLGE: KİMLİK · SEANS ŞERİDİ · ÖLÇÜLER (10 Kasım, görsel
                 kalite turu). Kart `sm:flex-row` + `sm:ml-auto` ile kimliği
                 sola, ölçüleri sağa itiyordu; 1440'ta arada ~700 piksel ölü
                 boşluk kalıyordu (canlı ekran görüntüsünden: kimliğin sağı
                 x≈517, ölçülerin solu x≈1224, kart 1320×150). `justify-between` kuralının anlattığı
                 hata: boşluk esnetilmez, doldurulur. Ortaya günün seans
                 şeridi girdi (`SessionLane` — bilanço günün neresinde,
                 Türkiye saatiyle), ölçüler sağda etiketi üstte üç hücrelik
                 bir ölçü ızgarası oldu (taban çizgileri aynı hatta).
                 Düzen `EarningsCalendar.module.css` → `.heroCard`; ölçüm
                 orada. Analizi yayımlanmış bilançoda görüş, kartın
                 tepesindeki 3 piksellik şeritte (sitenin kart dili). */
              className={cn("panel-hover relative rounded-lg border border-line bg-surface-solid transition-colors", styles.heroCard)}
              data-verdict={badge ? verdictOf(badge.verdict) : undefined}
            >
              {/* KART ŞİRKETİN BİLANÇO SAYFASINA (24 Ekim). Takvim bir
                  bilanço sorusu soruyor ("ne zaman") ve kartın gittiği yer
                  hisse sayfasıydı; cevabın tamamı (tarih, TR saati, oy,
                  okunan çeyrekler) artık `/bilancolar/[symbol]`ta ve o sayfa
                  hisseye ilk satırında bağlanıyor. Şirket kartı (`data-cc`)
                  hisse bağlantısını taşımaya devam ediyor. */}
              <Link
                href={earningsHref(row.symbol)}
                prefetch={false}
                aria-label={`${row.symbol} ${m?.name ?? ""}`}
                className="absolute inset-0 rounded-lg"
                data-cc={row.symbol}
              />
              <div className={cn("flex min-w-0 items-center gap-3 sm:gap-4", styles.heroWho)}>
                {/* Hero logosu bir basamak büyük (56px): katman farkı
                    yalnızca puntoyla değil ölçüyle de konuşuyor. */}
                <LogoTile symbol={row.symbol} logoUrl={m?.logoUrl} size="xl" />
                {/* DAR EKRANDA KALAN GENİŞLİĞİ KAPLIYOR (`flex-1`): içindeki
                    takvim düğmesi ancak böyle kartın sağ kenarına
                    yaslanabiliyor. Blok kendi içeriği kadar genişken
                    `ml-auto` sembolün birkaç piksel sağına itiyordu ve düğme
                    kartın ortasında, şirket adının üstünde asılı kalıyordu.
                    Geniş ekranda blok yine içeriği kadar: sağdaki ölçü
                    sütunu `sm:ml-auto` ile kendi yerini alıyor. */}
                <div className="min-w-0 flex-1 sm:flex-initial">
                  {/* Yıldız sembolün SOLUNDA ve sembol bloğu sabit
                      genişlikte: zamanlama çipleri kartlar arasında aynı
                      hizada dursun, sembolün kaç harf olduğuna göre
                      sağa sola kaymasın. */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* SABİT GENİŞLİK YALNIZCA GENİŞ EKRANDA. 104 piksellik
                        rezervasyon zamanlama çiplerini kartlar arasında aynı
                        hizada tutmak için; telefonda ise satırı taşırıyordu:
                        sembol (104) + çip (130) + takvim düğmesi (32) 254
                        piksellik alana sığmıyor, düğme tek başına ikinci
                        satıra düşüp şirket adının üstünde asılı kalıyordu.
                        Dar ekranda sembol kendi genişliği kadar ve üçü aynı
                        satırda. */}
                    <span className="flex items-center gap-1.5 sm:min-w-[104px]">
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
                    {/* Adıyla yazılı hâli yalnızca hero satırlarında ve
                        yalnızca GENİŞ EKRANDA — günün en büyük iki bilançosu,
                        takvime girmeye en çok değen ikisi.
                        Telefonda metinli düğme ~130 piksel istiyor ve sembol
                        (104) + zamanlama çipi (100) ile birlikte 286
                        piksellik satıra sığmıyordu: satır kırılıyor, şirketin
                        adı düğmenin altında öksüz bir üçüncü satır olarak
                        kalıyordu. Dar ekranda ikonlu sürüm aynı işi 32
                        pikselde yapıyor. */}
                    <AddToCalendar
                      symbol={row.symbol}
                      date={row.reportDate}
                      label={t.earnings.addToCalendar}
                      compact
                      className="ml-auto sm:hidden"
                    />
                    <AddToCalendar
                      symbol={row.symbol}
                      date={row.reportDate}
                      label={t.earnings.addToCalendar}
                      className="hidden sm:inline-flex"
                    />
                  </div>
                  <p className="mt-[3px] truncate text-sm text-body">
                    {m?.name ?? ""}
                  </p>
                </div>
              </div>
              <SessionLane
                window={laneWindow(row.hour)}
                openClock={bells.open}
                closeClock={bells.close}
                closeMinutes={closeMinutes}
                zone={zoneTag(locale).primary}
                labels={laneLabels}
                className={styles.heroLane}
              />
              {/* ÖLÇÜ IZGARASI: etiket üstte, sayı altta; manşet bir basamak
                  büyük ama üç sayının TABAN ÇİZGİSİ aynı hatta (alt ızgara,
                  ölçü `EarningsCalendar.module.css` → `.heroFigures`). Eski
                  sağa yaslı yığında ikincil ölçüler "etiket sayı" çiftleri
                  hâlinde 12 pikselde alt alta duruyordu. */}
              {headline ? (
                <dl className={styles.heroFigures}>
                  {[headline, ...rest].map((figure, index) => (
                    <div key={figure.label} data-lead={index === 0 || undefined}>
                      <dt>{figure.label}</dt>
                      <dd className="figure">{figure.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className={cn("text-xs text-muted", styles.heroFigures)}>{t.common.noData}</p>
              )}
              {heroVote && (
                <div className={styles.voteRow}>{voteNode(heroVote)}</div>
              )}
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
          data-motion-stagger
          className={cn(
            "mt-2.5 grid gap-2.5",
            styles.miniGrid,
            mid.length >= 4
              ? "grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]"
              : "grid-cols-[repeat(auto-fit,minmax(9.5rem,15rem))] justify-start",
          )}
        >
          {mid.map((row, index) => {
            const m = meta[row.symbol];
            const midVote = midVotes[index];
            const timing = timingOf(row.hour, t);
            const { headline, rest, capNote } = cardFigures(
              row,
              m,
              locale,
              t,
              true,
            );
            const badge = badgeOf(row);
            return (
              <div
                key={row.id}
                /* KART BİR ALT IZGARA. Bloklar dikey bir yığındı ve
                   ARADAKİ BİR BLOK KOŞULLUYDU: analiz rozeti yalnızca
                   analizi yayımlanmış şirkette basılıyor. Rozetsiz kartta
                   ölçü bloğu bir blok yukarı çıkıyor ve aynı satırdaki iki
                   kartın ayraç çizgisi 29 piksel kayıyordu (1024'te
                   ölçüldü) — yan yana duran iki kart hiçbir hattı
                   paylaşmıyordu. Alt ızgara dört bloğu da KARDEŞ kartlarla
                   aynı satıra bağlıyor; rozet satırı rozetsiz kartta da
                   duruyor, boş. Dolgu bütün kartlarda aynı olduğu için
                   hizayı bozmuyor. */
                /* ROZET SATIRI YALNIZ ROZET VARKEN (10 Kasım, görsel kalite
                   turu). Yukarıdaki karar rozet satırını HER kartta boş
                   taşıyordu; takvim ileriye baktığı için günlerin çoğunda
                   hiçbir kartta rozet yok ve boş satır + iki aralık adla
                   ayraç çizgisi arasında ~35 piksellik boş bir bant
                   bırakıyordu (canlı ekran, 1440). Hiza kararı duruyor: GÜNDE tek kartta bile rozet
                   varsa satır bütün kartlarda var (oy satırının kuralı,
                   `midHasVote`); yoksa hiçbirinde yok. Satır sayısı 3–5. */
                className={cn("panel-hover relative grid h-full min-w-0 grid-rows-subgrid gap-[11px] rounded-lg border border-line bg-surface-solid p-3.5 transition-colors", styles.miniCard)}
                style={{ gridRow: `span ${3 + (midHasBadge ? 1 : 0) + (midHasVote ? 1 : 0)}` }}
                data-verdict={badge ? verdictOf(badge.verdict) : undefined}
              >
                {/* Bilanço sayfasına — gerekçe hero kartında. */}
                <Link
                  href={earningsHref(row.symbol)}
                  prefetch={false}
                  aria-label={`${row.symbol} ${m?.name ?? ""}`}
                  className="absolute inset-0 rounded-lg"
                  data-cc={row.symbol}
                />
                {/* KİMLİK TEK SATIR, ZAMAN ONUN ALTINDA (10 Kasım, görsel
                    kalite turu). Kart iki köşeli bir satırla açılıyordu
                    (logo solda, zamanlama çipi sağda), sembol ve ad ayrı
                    satırdaydı: logo kimliğinden kopuk, çip "Kap. Sonrası"
                    diye kısaltılmış (tam etiket 128 piksel, logonun yanında
                    123 piksel yer vardı — 1440'ta ölçüldü). Şimdi logo,
                    [ölçüm: kart 1440'ta 212×240, 1280'de 192×240, 390'da
                    172×236; satırdaki altı kartın ayraç çizgisi ve dibi tek
                    hatta, kutudan taşan 0 — 1024'teki 154'lük kart dahil]
                    sembol ve ad tek kimlik satırı (baş kartın ve analiz
                    şeridinin dili); zaman kendi satırında TAM adıyla, takvim
                    düğmesi o satırın sağ ucunda. Blok sayısı aynı (iki),
                    kart uzamadı.
                    Aşağıdaki eski gerekçeler duruyor: logo 44, ad tek satır
                    (`.companyName`), takvim düğmesi var olan satırın ucunda. */}
                <div className={styles.miniIdentity}>
                  {/* Mini kart logosu da bir basamak büyük (44px). Izgara
                      dar ekranda bile kart başına ~150 piksel bırakıyor,
                      geniş ekranda 225-340; 32 piksellik karo o kutuda
                      küçük kalıyordu. Hero satırı 56'da kaldığı için iki
                      katman arasındaki ölçü farkı sürüyor. */}
                  <LogoTile symbol={row.symbol} logoUrl={m?.logoUrl} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="text-read font-bold tracking-[-0.01em] text-strong">
                      {watchSet.has(row.symbol) && (
                        <span aria-hidden className="mr-1 text-primary">
                          ★
                        </span>
                      )}
                      {row.symbol}
                    </p>
                    <p className={styles.companyName}>
                      {m?.name ?? ""}
                    </p>
                  </div>
                </div>
                {/* Takvim düğmesi zaman satırının SAĞINDA, kendi satırında
                    değil: dar kartta ayrı bir satır her karta ~32px ekliyordu
                    ve ızgara `h-full` olduğu için o boşluk hepsine yayılıyordu. */}
                <div className={styles.miniWhen}>
                  {/* KISALTMA YALNIZ DAR KARTTA. Telefonda (kart 174, iç
                      148) tam etiket + takvim düğmesi sığmıyor; iki yazım da
                      DOM'da, hangisinin görüneceğini satırın kendi genişliği
                      seçiyor (kap sorgusu, `.miniWhen`). Ekran okuyucu her
                      genişlikte tam adı duyar. */}
                  <TimingChip tone={timing.tone} size="sm">
                    <span className={styles.chipFull}>{timing.label}</span>
                    <span className={styles.chipShort} aria-hidden>{timing.short}</span>
                  </TimingChip>
                  <AddToCalendar
                    symbol={row.symbol}
                    date={row.reportDate}
                    label={t.earnings.addToCalendar}
                    compact
                    className="mb-0 ml-auto -mr-1 sm:ml-auto sm:-mr-1"
                  />
                </div>
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
                {/* ÖLÇÜ BLOĞU KİMLİĞİN HEMEN ALTINDA, kartın dibinde DEĞİL.
                    `mt-auto` bloğu alt kenara yapıştırıyordu ve kart
                    `h-full` ile satırın en uzun kartı kadar uzadığı için
                    aradaki fark kartın ORTASINDA bir delik olarak açılıyordu:
                    üç ölçüsü olan bir kartın yanındaki tek ölçülü kartta
                    ~90 piksellik boşluk vardı. Blok yukarı alınınca üstündeki
                    her şey sabit yükseklikte olduğu için ayraç çizgisi
                    satırdaki bütün kartlarda AYNI hizaya düşüyor — artan yer
                    de deliğe değil, kartın altına, dolgunun devamı gibi
                    kalıyor. */}
                <div className="border-t border-line pt-[9px]">
                  {/* Profili gelmemiş bir spotlight sembolünde üç ölçünün
                      üçü de boş olabiliyor; şerit o zaman çıplak bir ayraç
                      çizgisi olarak kalıyordu. */}
                  {!headline && rest.length === 0 && (
                    <p className="text-small text-muted">{t.common.noData}</p>
                  )}
                  {headline && (
                    <>
                      <p className="plate text-nano">
                        {headline.label}
                      </p>
                      <p className="figure mt-[3px] truncate text-lead font-bold leading-none tracking-[-0.03em] text-strong">
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
                  {/* PİYASA DEĞERİ KÜNYESİ — her mini kartta aynı yerde,
                      aynı satır sayısında. Üstündeki ölçüler karttan karta
                      oynayabiliyor ama bu satır oynamıyor, o yüzden kart
                      yükseklikleri de oynamıyor. */}
                  {capNote && (
                    <p className={cn("flex items-baseline justify-between gap-2 text-tiny", styles.capNote)}>
                      <span className="text-muted">{capNote.label}</span>
                      <span className="figure font-semibold text-body">
                        {capNote.value}
                      </span>
                    </p>
                  )}
                  {/* BEKLENTİSİ OLMAYAN KARTTA KÜNYE YERİNE NEDENİ YAZILI.
                      Üstteki künyenin varlık sebebi "her kartta tam olarak
                      bir alt satır olsun ki yükseklikler oynamasın" — ama o
                      satır yalnızca piyasa değeri MANŞET DEĞİLKEN basılıyor.
                      Beklentisi olmayan şirkette piyasa değeri manşete
                      çıkıyor, künye düşüyor ve kart tek satırla kalıyordu:
                      ölçüldü, tahminli kartta alt ölü boşluk 15 piksel,
                      beklentisizde 66 — dört katı, ve 230 piksellik kutunun
                      görünür şekilde yarısı boş kalıyordu.
                      Satır bir sayı UYDURMUYOR, eksiği söylüyor: okuyucu
                      kartın neden seyrek olduğunu görüyor. Küçük şirketlerde
                      analist kapsamının olmaması bilgi, kusur değil. */}
                  {/* İKİ SATIR, ÖTEKİ KARTLARLA AYNI HATTA (10 Kasım, görsel
                      kalite turu). Tek satırlık "Beklenti Yok" künyesi kartı
                      komşularından bir satır kısa bırakıyordu (tahminli
                      kartta manşetin altında iki satır: EPS ve PD). Şimdi
                      aynı iki yuva duruyor, değeri yok: "Gelir –", "EPS –".
                      Yine sayı uydurulmuyor; eksik, yerinde gösteriliyor ve
                      "Beklenti Yok" ekran okuyucuya kalıyor. */}
                  {!capNote && rest.length === 0 && headline && (
                    <dl className="mt-2 flex flex-col gap-[2px] text-small" data-empty>
                      <span className="sr-only">{t.earnings.noEstimate}</span>
                      {[t.earnings.revenueShort, "EPS"].map((label) => (
                        <div key={label} aria-hidden className="flex items-baseline justify-between gap-2">
                          <dt className="text-muted">{label}</dt>
                          <dd className="figure font-semibold text-muted">{NO_VALUE}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
                {/* ROZET ÖLÇÜLERİN ALTINDA (10 Kasım): kimlik ile ölçüler
                    arasındaydı; rozetsiz kartta boş satır kartın ORTASINDA
                    40 piksellik bir delik bırakıyordu (TDG'nin analizi
                    çıktığı gün öteki beş kart). Dipte boş satır kartın alt
                    payına karışır, ayraç çizgileri yine aynı hatta. */}
                {/* Rozetsiz kartta da satır duruyor — gerekçesi kartın
                    sınıf listesinde. */}
                {badge ? (
                  /* Sıkı kip: mini kart 172–192px; tam hap ("SELL 81
                     Analysis ›", 164px) iç genişliğe sığmayıp kesiliyordu
                     (30 Ekim, duman testinin "sıkışan" denetimi). */
                  <AnalysisBadge
                    badge={badge}
                    t={t}
                    size="sm"
                    compact
                    className="self-start"
                  />
                ) : midHasBadge ? (
                  <span aria-hidden />
                ) : null}
                {midHasVote &&
                  (midVote ? (
                    <div className={styles.voteRow}>{voteNode(midVote)}</div>
                  ) : (
                    <span aria-hidden />
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Katman 3: kalanlar ----
           Çipler artık sunucuda ÇİZİLMİYOR, veri olarak geçiyor: kapalı bir
           `<details>` içindeki 1.354 çip HTML'in yarısını yiyordu. Gerekçe
           `AlsoReporting` dosyasının başında. */}
      {/* SEYREK GÜN AÇIK GELİR (10 Kasım, görsel kalite turu). Görünür
          katmana giren şirketi olmayan günde (cumartesi: tek küçük şirket)
          gün başlığının altında yalnız kapalı bir "Diğer Açıklayanlar (1)"
          katlaması kalıyor, bölüm boş görünüyordu. O günün bütün içeriği bu
          liste: `SPARSE_INLINE_MAX` sembole kadar katlanmadan, başlığın
          hemen altında tek satır çip olarak basılır. Daha kalabalık seyrek
          günde (profili gelmemiş onlarca sembol) katlama kalır — HTML yükü
          gerekçesi `AlsoReporting` başında. */}
      <AlsoReporting
        label={t.earnings.alsoReporting}
        inline={sparse && rest.length <= SPARSE_INLINE_MAX}
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
