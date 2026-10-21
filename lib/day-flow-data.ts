import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { economicEvents, earningsCalendar, earningsAnalyses, watchlistItems, watchlists } from "./schema";
import { getHolidays, getStatus, getSymbolNames, guncelBilanco } from "./data";
import { addEtDays, closeMinutesFor, etDateTimeToUtc, isTradingDay, nextTradingDay, prevTradingDay } from "./market-hours";
import { displayOffsets, displayZone, formatInZone, zoneTag } from "./session-clock";
import { getEarningsFiling } from "./providers/sec-edgar";
import { withTimeout } from "./providers/timeout";
import { getDictionary, type Locale } from "./i18n";
import { withLocale } from "./i18n/routing";
import { analysisHref } from "./analysis";
import { formatEventValue, formatMoneyCompact, formatPercent, formatPrice } from "./utils";
import { epsSurprise, revenueSurprise, type Surprise } from "./earnings-week";
import { isSpotlight } from "./spotlight";
import { getEarningsCalendar } from "./providers/finnhub";
import { getReleasedObservation } from "./providers/fred";
import { earningsStatus, eventFamily, groupStatus, hasActual, type DayFlowSnapshot, type FlowEvent, type FlowMember, type FlowSurprise } from "./day-flow";

/** Sürprizin yazımı haftalık takvimle aynı: bir ondalık (`WeekSchedule`). */
const SURPRISE_DIGITS = 1;
/** SEC bildirimini en çok bu kadar bekle — gerekçe `filings`te. */
const SEC_FILING_WAIT_MS = 3_000;

/* GEÇMİŞ VE GELECEK GÜNLER (21 Ekim, sahibinin isteği: "geçmişe de
   gidebilsin, sağda oklarla"). Akış bugüne kilitliydi; dünün bilançolarının
   ne çıktığını görmek için takvime gitmek gerekiyordu. Oklar bir önceki ya
   da sonraki İŞLEM gününe gider (tatil ve hafta sonu atlanır). Pencere
   sınırlı: geriye 60, ileriye 14 gün — uç rastgele tarihlerle veritabanını
   taramaya açılmasın, takvimin dolu olduğu aralık da bu kadar.

   Bugün DIŞINDAKİ gün yalnız VERİTABANINDAN okunur: sağlayıcı sonuç
   takvimi, FRED'in anlık okuması ve SEC bildirimleri bugünün canlı
   ayrıntısı; geçmiş günün sonucu zaten günlük senkronla tabloya yazılmış,
   gelecek günün henüz sonucu yok. Yani gün değiştirmek sağlayıcı kotası
   harcamaz. */
export const DAY_FLOW_BACK_DAYS = 60;
export const DAY_FLOW_AHEAD_DAYS = 14;

/** Tarih gezinme penceresinde mi — uç ve yükleyici aynı sınırı okur. */
export function dayFlowDateAllowed(date: string, today: string): boolean {
  return date >= addEtDays(today, -DAY_FLOW_BACK_DAYS) && date <= addEtDays(today, DAY_FLOW_AHEAD_DAYS);
}

/** One source for SSR and polling. GET reads providers, never mutates the DB. */
export async function loadDayFlow(locale: Locale, userId?: string, requestedDate?: string): Promise<DayFlowSnapshot> {
  const [status, holidays] = await Promise.all([getStatus(), getHolidays()]);
  const today = status.etDate;
  const date = requestedDate && dayFlowDateAllowed(requestedDate, today) ? requestedDate : today;
  const isToday = date === today;
  /* Başka günün "şimdi"si: geçmişte gün bitmiştir, gelecekte başlamamıştır. */
  const etMinutes = isToday ? status.etMinutes : date < today ? 24 * 60 : 0;
  const closeMinutes = isToday ? status.closeMinutes : closeMinutesFor(date, holidays);
  const now = new Date();
  const t = getDictionary(locale);
  // Critical DB errors propagate: the client retains its last successful
  // snapshot rather than replacing real events with a false empty day.
  const [events, earnings, analyses, watched] = await Promise.all([
    db.select().from(economicEvents).where(eq(economicEvents.eventDate, date)).orderBy(asc(economicEvents.eventTimeEt)),
    db.select().from(earningsCalendar).where(and(eq(earningsCalendar.reportDate, date), guncelBilanco)),
    db.select({ symbol: earningsAnalyses.symbol, period: earningsAnalyses.period, locale: earningsAnalyses.locale, reportDate: earningsAnalyses.reportDate, timing: earningsAnalyses.timing }).from(earningsAnalyses).where(eq(earningsAnalyses.reportDate, date)),
    // getUserSymbols diğer paneller için hatada [] döndürür. Burada bu,
    // takip edilen küçük şirketleri gün akışından sessizce kaldırırdı.
    // Yalnız gereken sembolleri oku; sorgu hatası tüm snapshot'ı reddetsin.
    userId
      ? db.selectDistinct({ symbol: watchlistItems.symbol })
        .from(watchlistItems)
        .innerJoin(watchlists, eq(watchlists.id, watchlistItems.watchlistId))
        .where(eq(watchlists.userId, userId))
      : Promise.resolve([]),
  ]);
  /* Sözlükteki iki kayıt `Record` olarak okunuyor: `tr` sabit anahtarlarla
     yazıldığı için `en` aynı anahtarları vermek zorunda (tip oradan türüyor),
     ama arama anahtarı çalışma zamanında geldiğinden indeksleme serbest. */
  const notes: Record<string, string> = t.dayFlow.notes;
  const issuers: Record<string, string> = t.dayFlow.issuers;
  const watchedSet = new Set(watched.map((row) => row.symbol));
  const analysisMap = new Map<string, (typeof analyses)[number]>();
  for (const row of analyses) if (!analysisMap.has(row.symbol) || row.locale === locale) analysisMap.set(row.symbol, row);
  const meta = await getSymbolNames(
    [...new Set([...earnings.map((row) => row.symbol), ...analyses.map((row) => row.symbol)])],
    { throwOnError: true },
  );
  // One shared request for the entire day, never one request per company.
  // On closed empty days there is no provider traffic.
  const provider = isToday && earnings.length && status.etMinutes >= 240
    ? await getEarningsCalendar(date, date, undefined, "results") : null;
  const live = new Map(provider?.ok ? provider.data.filter((row) => row.reportDate === date).map((row) => [row.symbol, row]) : []);
  const eventItems: FlowEvent[] = await Promise.all(events.map(async (event) => {
    const scheduledAt = event.eventTimeEt ? etDateTimeToUtc(date, event.eventTimeEt).toISOString() : null;
    const fresh = isToday && !hasActual(event.actual) && event.fredSeriesId && scheduledAt && new Date(scheduledAt) <= now
      ? await getReleasedObservation(event.fredSeriesId, date) : null;
    const actual = fresh?.actual ?? event.actual;
    return {
      id: event.id, timeEt: event.eventTimeEt, scheduledAt,
      title: locale === "tr" ? event.titleTr : event.titleEn,
      importance: event.importance === "high" || event.importance === "low" ? event.importance : "medium",
      kind: "event", status: hasActual(actual) ? "released" : "scheduled",
      actual: formatEventValue(actual, event.unit, locale) || undefined,
      forecast: formatEventValue(event.forecast, event.unit, locale) || undefined,
      previous: formatEventValue(fresh?.previous ?? event.previous, event.unit, locale) || undefined,
      href: withLocale("/takvim?g=day", locale),
      note: notes[eventFamily(event.slug)],
      /* Ham sağlayıcı anahtarı ekrana basılmaz: panelde "Kaynak:
         federalreserve" yazıyordu. Listede olmayan kaynak olduğu gibi kalır —
         yanlış bir ada çevirmektense ham anahtar dürüsttür. */
      source: fresh ? "FRED" : event.source === "seed" ? t.dayFlow.calendarSource : issuers[event.source] ?? event.source,
      updatedAt: (fresh?.fetchedAt ?? event.updatedAt).toISOString(),
    };
  }));
  const byWindow = new Map<string, FlowMember[]>();
  const combined = new Map(earnings.map((row) => [row.symbol, row]));
  // Published reports can precede the calendar import: keep those actionable.
  for (const row of analyses) if (!combined.has(row.symbol)) combined.set(row.symbol, {
    id: row.symbol, symbol: row.symbol, reportDate: date, hour: row.timing,
    epsActual: null, epsEstimate: null, revenueActual: null, revenueEstimate: null,
    quarter: null, year: null, updatedAt: now,
  });
  /* GİZLENENLER SAYILIYOR. Eşiğin altındaki bilançolar akışa girmiyor ve
     o gün yalnız onlar varsa akış "Bugün Planlanmış Açıklama Yok" diyordu;
     aynı sayfanın "Bugün Bilanço Açıklayanlar" paneli hemen altında dokuz
     şirket listeliyordu (22 Eylül, ölçüldü: en büyüğü AZO, 46,6 milyar $).
     Sayı boş duruma taşınıyor ve cümle ona göre kuruluyor. */
  let hiddenEarnings = 0;
  /* SEC BİLDİRİMİ ANLIK (2 Ekim). Şirket sonucu SEC'e yatırdığı dakika
     8-K / 2.02 kaydı EDGAR'da; Finnhub'ın EPS'i dakikalar-saatler sonra
     geliyor. Kayıt bulunursa satır "Açıklandı" oluyor ve bildirime
     bağlanıyor (gerekçe `lib/providers/sec-edgar.ts`). Yalnızca akışta
     GÖSTERİLEN şirketler, yalnızca 04:00 ET'den sonra; sorular aynı anda
     açılır ama ağa çıkan her biri ortak SEC sırasından geçer (`sec-gate.ts`,
     ≤ 4/sn — soğuk turda N × 275 ms). SEC düşerse akış eskisi gibi Finnhub'ı
     bekliyor. Sonucu zaten gelmiş satır (`settled`, 20 Ekim) yalnız
     bağlantısı için on dakikada bir sorulur, dakikada bir yoklanmaz: yoklama
     SEC'in saniyede on istek sınırına karşı sıraya giriyor ve 6-K yatıran
     yabancı şirketlerde (TSM, ASML) 8-K hiç gelmiyor.

     BEKLEME SINIRLI (20 Ekim). `Promise.all`in süresi yoktu; sıra uzadığında
     (gün dönümünde her anahtar yeni, dağıtımdan sonra hafıza boş, ya da
     Form 4 dalgası) akışın tamamı arkasında bekliyordu — 6 sn'lik
     `AbortSignal` ancak sıra gelince başlıyor. Her soru en çok
     `SEC_FILING_WAIT_MS` beklenir; aşan satır o turda bildirimsiz çıkar,
     yoklama arkada sürer ve sonucu hafızaya düştüğü için sonraki turda
     gelir. Bulunmuş bildirim ve önceki tur hafızadan anında döndüğü için
     süre yalnız ilk soruyu keser. */
  const shown = [...combined.values()].filter((row) => analysisMap.has(row.symbol) || watchedSet.has(row.symbol) || isSpotlight(row.symbol) || (meta[row.symbol]?.marketCap ?? 0) >= 50e9);
  const settled = (row: (typeof shown)[number]) => {
    const providerRow = live.get(row.symbol);
    return earningsStatus(providerRow?.epsActual ?? row.epsActual, providerRow?.revenueActual ?? row.revenueActual, analysisMap.has(row.symbol)) !== "scheduled";
  };
  const filings = new Map(isToday && status.etMinutes >= 240
    ? await Promise.all(shown.map(async (row) => [
        row.symbol,
        await withTimeout(getEarningsFiling(row.symbol, date, settled(row)), SEC_FILING_WAIT_MS).catch(() => null),
      ] as const))
    : []);
  const zone = displayZone(locale);
  const zoneTags = zoneTag(locale);
  for (const row of combined.values()) {
    const analysis = analysisMap.get(row.symbol);
    const info = meta[row.symbol];
    if (!analysis && !watchedSet.has(row.symbol) && !isSpotlight(row.symbol) && (info?.marketCap ?? 0) < 50e9) {
      hiddenEarnings += 1;
      continue;
    }
    const providerRow = live.get(row.symbol);
    // A missing value never erases an already confirmed database result.
    const eps = providerRow?.epsActual ?? row.epsActual;
    const revenue = providerRow?.revenueActual ?? row.revenueActual;
    const epsEstimate = providerRow?.epsEstimate ?? row.epsEstimate;
    const revenueEstimate = providerRow?.revenueEstimate ?? row.revenueEstimate;
    const hour = providerRow?.hour ?? row.hour ?? "unknown";
    /* PARA BİRİMİ ŞİRKETİN ANA BORSASINDAN. Satır `currency: true` ile her
       sayıyı dolar basıyordu; sağlayıcının tahmin ve sonuçları ana borsanın
       parasında geliyor (gerekçe `EarningsCalendar` → `cardFigures`). `||`,
       `??` değil: `symbols.currency` boş dize olabiliyor. */
    const money = { currency: info?.currency || true } as const;
    const code = info?.currency || null;
    const surpriseOf = (value: Surprise | null): FlowSurprise | undefined => value
      ? { direction: value.direction, pct: value.ratio === null ? undefined : formatPercent(value.ratio * 100, locale, SURPRISE_DIGITS) }
      : undefined;
    const member: FlowMember = {
      symbol: row.symbol, logoUrl: info?.logoUrl ?? null, watched: watchedSet.has(row.symbol),
      /* Bildirim yatırıldıysa sonuç açıklanmıştır — rakam henüz gelmemiş olsa da. */
      status: earningsStatus(eps, revenue, !!analysis) === "scheduled" && filings.get(row.symbol) ? "released" : earningsStatus(eps, revenue, !!analysis),
      href: withLocale(analysis ? analysisHref(row.symbol, analysis.period) : `/hisse/${row.symbol}`, locale),
      eps: hasActual(eps) ? formatPrice(eps!, locale, money) : undefined,
      revenue: hasActual(revenue) ? formatMoneyCompact(revenue!, locale, code) : undefined,
      epsEstimate: hasActual(epsEstimate) ? formatPrice(epsEstimate!, locale, money) : undefined,
      revenueEstimate: hasActual(revenueEstimate) ? formatMoneyCompact(revenueEstimate!, locale, code) : undefined,
      epsSurprise: hasActual(eps) ? surpriseOf(epsSurprise(eps, epsEstimate)) : undefined,
      revenueSurprise: hasActual(revenue) ? surpriseOf(revenueSurprise(revenue, revenueEstimate)) : undefined,
      filing: (() => {
        const filed = filings.get(row.symbol);
        return filed
          ? {
              label: filed.acceptedAt
                ? `${t.dayFlow.secFiling} · ${formatInZone(new Date(filed.acceptedAt), zone)} ${zoneTags.primary}`
                : t.dayFlow.secFiling,
              url: filed.url,
              acceptedAt: filed.acceptedAt,
            }
          : undefined;
      })(),
    };
    byWindow.set(hour, [...(byWindow.get(hour) ?? []), member]);
  }
  const windows: Record<string, { time: string | null; title: string }> = {
    bmo: { time: "08:00", title: t.earnings.beforeOpen },
    amc: { time: `${Math.floor(closeMinutes / 60)}`.padStart(2, "0") + ":" + String(closeMinutes % 60).padStart(2, "0"), title: t.earnings.afterClose },
    dmh: { time: "12:00", title: t.earnings.duringMarket },
    unknown: { time: null, title: t.dayFlow.timeUnknown },
  };
  const earningsItems: FlowEvent[] = [...byWindow].map(([hour, members]) => {
    const window = windows[hour] ?? windows.unknown;
    members.sort((a, b) => Number(b.watched) - Number(a.watched) || (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0));
    return {
      id: `earnings-${hour}`, timeEt: window.time,
      scheduledAt: window.time ? etDateTimeToUtc(date, window.time).toISOString() : null,
      /* TEK ŞİRKETLİK SATIRDA ŞİRKETİN ADI DA YAZILIR. "FDX" tek başına
         okuyucuya ne olduğunu söylemiyordu: sembolü bilmeyen için üç harf,
         bilen için de satırın bilanço mu haber mi olduğu belirsiz. Ad veri
         tabanında zaten var (`symbols.name`), bir sorgu daha açmıyor. Birden
         çok şirket varsa adlar sığmaz; orada semboller kalır ve satırı
         künyedeki "Bilanço" tanımlar. */
      title: members.length === 1 && meta[members[0]!.symbol]?.name
        ? `${members[0]!.symbol} · ${meta[members[0]!.symbol]!.name}`
        : members.slice(0, 3).map((member) => member.symbol).join(" · ") + (members.length > 3 ? ` +${members.length - 3}` : ""),
      importance: "medium", kind: "earnings", status: groupStatus(members), approx: !!window.time,
      /* Künye TÜRÜ önce söyler. Yalnız pencere adı ("Kapanış Sonrası")
         yazıyordu ve satırda bilançoyu gösteren tek işaret zil simgesiydi —
         simge tek başına "bu bir bilanço" demiyor. */
      /* Saati belirsizse pencere adı EKLENMEZ: `windows.unknown.title` zaten
         "Saat Belirtilmedi" ve aynı cümle satırın saat sütununda, panelin
         künyesinde de duruyor. Üç kez yazılıyordu. */
      detail: window.time ? `${t.dayFlow.earnings} · ${window.title}` : t.dayFlow.earnings, members,
      href: withLocale("/bilancolar", locale), source: "Finnhub",
      updatedAt: provider?.ok ? provider.fetchedAt.toISOString() : now.toISOString(),
    };
  });
  return {
    dateEt: date, asOf: now.toISOString(),
    events: [...eventItems, ...earningsItems].sort((a, b) => (a.timeEt ?? "99:99").localeCompare(b.timeEt ?? "99:99") || a.id.localeCompare(b.id)),
    initialNowMinutes: etMinutes, tradingDay: isToday ? status.tradingToday : isTradingDay(date, holidays), closeMinutes,
    today,
    prevDate: (() => { const d = prevTradingDay(date, holidays); return dayFlowDateAllowed(d, today) ? d : null; })(),
    nextDate: (() => { const d = nextTradingDay(date, holidays); return dayFlowDateAllowed(d, today) ? d : null; })(),
    offsets: displayOffsets(date, locale), tags: zoneTag(locale), pollAfterMs: 30_000,
    sourceDelayed: !!provider && !provider.ok,
    hiddenEarnings,
  };
}

/* OTURUMSUZ ANLIK GÖRÜNTÜ PAYLAŞIMLI (15 Ekim taraması; 20 Ekim'de buraya
   taşındı). `/api/day-flow` sitenin en sık çağrılan ucu: açık her sekme 30
   saniyede bir yokluyor ve kullanıcıya özel tek parça favori işaretleri —
   oturumsuz görüntü locale başına birebir aynı. Yine de her anonim çağrı 4
   paralel DB sorgusu + sembol adları + (seans içinde) sağlayıcı yolunu
   baştan koşuyordu. Tazelik yoklama aralığına eşit (30 sn), yani ekrandaki
   veri eskimiyor.

   İKİ ÇAĞIRAN, İKİ AYRI NOT (20 Ekim). Paylaşım yalnız uçtaydı; misafirin
   ana sayfası (`RailSection`) aynı görüntüyü her çizimde baştan kuruyordu,
   yani en sık çağıran önbelleksiz olandı. İkisi de buradan geçer — ama
   AYNI notu okumazlar: Turbopack üretim derlemesi bu modülü iki ayrı
   grafiğe koyuyor (sayfa `chunks/ssr/[turbopack]_runtime.js`, `/api` ucu
   `chunks/[turbopack]_runtime.js`; her çalışma zamanının kendi
   `moduleCache`i var), yani tek süreçte iki modül örneği ve iki bağımsız
   30 saniyelik not. Her biri locale başına 30 saniyede en çok bir kez
   yükler; bedel en fazla bir fazla `loadDayFlow`. SSR görüntüsü ile ilk
   yoklama farklı kayıtlardan gelebilir; ilk yoklama daha eski bir `asOf`
   taşırsa istemci onu zaten atıyor (`DayFlow.tsx`). Gerçek paylaşım
   gerekirse Map `globalThis`e asılır; bugün buna dayanan kod yok.

   `unstable_cache` DEĞİL, süreç içi not (20 Ekim). `unstable_cache` geri
   çağrısının içindeki her `fetch`i `no-store`a çeviriyor ve iç içe
   `unstable_cache`i atlıyor (next/dist/server/lib/patch-fetch.js,
   "Inside unstable-cache we treat it the same as force-no-store"). Sarmal
   bütün `loadDayFlow`u kapsadığı için her yeniden hesapta Finnhub sonuç
   takvimi (60 sn), FRED'in iki okuması (önceki gün sürümü 24 sa), SEC
   bildirimleri ve `loadSymbolTable` birleşimi kendi önbelleklerini
   atlayıp sağlayıcıya gidiyordu: iş azalmıyor, sağlayıcıya kayıyordu.
   VPS tek süreç (`lib/stock-insights.ts` → `remembered` aynı kalıp); not
   uçuştaki yüklemeyi de paylaştırıyor ve SWR penceresi yok, yani sessiz bir
   gecenin ardından ilk okuyucuya dünün görüntüsü gitmiyor. HATA NOTUN
   DIŞINDA: `loadDayFlow` fırlatırsa kayıt silinir, boş sonuç saklanmaz
   (CLAUDE.md "İstekler arası önbellek"); silmeden önce kimlik sorulur ki
   eski bir hatalı yükleme yerine geçen yenisini düşürmesin. */
const SHARED_DAY_FLOW_MS = 30_000;
const sharedDayFlow = new Map<Locale, { at: number; snapshot: Promise<DayFlowSnapshot> }>();

/* BAŞKA GÜNÜN OTURUMSUZ GÖRÜNTÜSÜ (21 Ekim). Okla gezen okuyucu aynı
   günleri ileri geri açıyor; geçmiş gün yalnız veritabanından okunduğu ve
   gün içinde nadiren değiştiği için beş dakika paylaşılır. Not sınırlı
   (en çok 64 gün × dil): rastgele tarih sorgusu belleği büyütemez, pencere
   zaten `dayFlowDateAllowed` ile 75 günle sınırlı. Hata notun dışında. */
const OTHER_DAY_MS = 5 * 60_000;
const otherDays = new Map<string, { at: number; snapshot: Promise<DayFlowSnapshot> }>();

export function loadSharedOtherDay(locale: Locale, date: string): Promise<DayFlowSnapshot> {
  const key = `${locale}:${date}`;
  const held = otherDays.get(key);
  if (held && Date.now() - held.at < OTHER_DAY_MS) return held.snapshot;
  if (otherDays.size >= 64) otherDays.delete(otherDays.keys().next().value!);
  const entry = { at: Date.now(), snapshot: loadDayFlow(locale, undefined, date) };
  otherDays.set(key, entry);
  entry.snapshot.catch(() => {
    if (otherDays.get(key) === entry) otherDays.delete(key);
  });
  return entry.snapshot;
}

/** Oturumsuz okuyucunun gün akışı — SSR ve yoklama aynı TÜRDEN 30 sn'lik
 *  notu okur, aynısını değil: sayfa ve `/api` ucu ayrı Turbopack çalışma
 *  zamanında, her biri kendi not örneğini tutar (gerekçe yukarıda). */
export function loadSharedDayFlow(locale: Locale): Promise<DayFlowSnapshot> {
  const held = sharedDayFlow.get(locale);
  if (held && Date.now() - held.at < SHARED_DAY_FLOW_MS) return held.snapshot;
  const entry = { at: Date.now(), snapshot: loadDayFlow(locale, undefined) };
  sharedDayFlow.set(locale, entry);
  entry.snapshot.catch(() => {
    if (sharedDayFlow.get(locale) === entry) sharedDayFlow.delete(locale);
  });
  return entry.snapshot;
}
