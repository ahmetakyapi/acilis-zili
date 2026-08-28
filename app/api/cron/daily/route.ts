import { NextResponse } from "next/server";
import { checkBearer } from "@/lib/api-auth";
import { and, desc, eq, gte, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  earningsCalendar,
  economicEvents,
  news as newsTable,
  macroSeries,
  pageViews,
} from "@/lib/schema";
import {
  getCompanyNews,
  getEarningsCalendar,
  getMarketNews,
} from "@/lib/providers/finnhub";
import { MACRO_SERIES, getSeries } from "@/lib/providers/fred";
import { addEtDays, etParts, todayEt } from "@/lib/market-hours";
import { calendarRunwayDays, syncCalendar } from "@/lib/calendar-sync";
import { translatePendingNews, isTranslateConfigured } from "@/lib/translate";
import {
  getEarningsSymbolsMissingProfile,
  getIndexDriftCandidates,
  getStalestSymbols,
} from "@/lib/data";
import { getCompanyProfile } from "@/lib/providers";
import { symbols as symbolsTable } from "@/lib/schema";
import { ALL_MEMBERS } from "@/db/seed/indices";
import { SPOTLIGHT_SYMBOLS } from "@/lib/spotlight";

/**
 * BÜTÇE. Finnhub ücretsiz katmanı dakikada 60 istek kabul ediyor ve bu
 * fonksiyonun toplam süresi 120 saniye. Yani bu koşum en fazla ~120 istek
 * atabilir ve pratikte daha azını atmalı — sınıra dayanmak 429 demek.
 *
 * Sayılar bir dönem bu aritmetiği hiç yapmadan konmuştu: 31 bilanço günü +
 * 20 şirket haberi + 60 profil + ~15 FRED = ~127 istek, yani koşum ancak
 * kotaya çarparak ya da yarıda kesilerek bitebiliyordu. Kuyruktaki iş
 * (profiller) sessizce hiç çalışmıyordu.
 *
 * Yeni dağılım ~84 istek: bilanço takvimi kısaltılmadı (gün gün çekmek bir
 * hata düzeltmesiydi — SNDK böyle kaybolmuştu), kısalan yerler haber ve
 * profil. Profil turu 60'tan 25'e inince evren ~12 günde değil ~29 günde bir
 * tazeleniyor; hisse sayısı ve sektör ancak geri alım/ihraçla değiştiği için
 * bu kabul edilebilir bir yavaşlama.
 *
 * İşi ayrı cron uçlarına bölmek (her birine kendi 120 saniyesi) daha iyi
 * olurdu ama cron SAYISI dağıtım planına bağlı; bu düzeltme hangi planda
 * olursa olsun çalışıyor.
 */
const COMPANY_NEWS_SYMBOLS = 12;
const PROFILE_REFRESH_LIMIT = 25;

/**
 * Koşumun kendine ayırdığı süre — fonksiyon sınırının altında bir pay.
 *
 * Adımlar bu süreyi aşmaya başlayınca KALANI ATLIYOR ve raporda söylüyor.
 * Yarıda kesilen bir fonksiyon hiçbir şey söylemeden ölüyordu; atlanan iş
 * ertesi gün zaten tekrar sıraya giriyor.
 */
const BUDGET_MS = 100_000;

/**
 * Bilanço takvimi kaç gün ileri çekilir.
 *
 * Bilançolar sayfasının "Ay" sekmesi 29 gün gösteriyor ama burası 14 günde
 * duruyordu: aradaki iki hafta boş görünüyordu ve ancak gün gün yaklaştıkça
 * doluyordu. Sayfanın istediğinden bir gün fazlası çekilir ki sınırda boş
 * satır kalmasın. Maliyeti 31 Finnhub isteği ve koşumun en pahalı adımı bu;
 * yukarıdaki bütçe dağılımı buna göre kuruldu.
 */
const EARNINGS_HORIZON_DAYS = 30;

/** Sayfa ölçümü kaç gün saklanır — panelin en geniş penceresi altı ay. */
const VIEW_RETENTION_DAYS = 180;

/**
 * Haber kaç gün saklanır.
 *
 * Günde ~60 genel + ~50 şirket haberi yazılıyor (özet, çeviri ve sembol
 * dizisiyle birlikte) ve hiçbiri silinmiyordu. Ekran zaten yalnızca son
 * 20-60 haberi gösteriyor; birikenin tek etkisi tablo boyutu ve yedek
 * maliyeti. Doksan gün, hisse sayfasındaki "son haberler" penceresinin çok
 * üstünde.
 */
const NEWS_RETENTION_DAYS = 90;

/**
 * Bir olayın açıklanma saati geçti mi.
 *
 * Pay 30 dakika: FRED yayını saniyesinde yansıtmıyor ve sınırda koşan bir
 * cron, açıklanmış gibi görünen ama henüz gelmemiş bir gözlemi yazardı.
 * Saati bilinmeyen olay (eventTimeEt null) o gün için ATLANIR — ne zaman
 * çıktığını bilmediğimiz bir veriyi açıklanmış saymak, tam olarak kaçındığımız
 * uydurma kesinlik.
 */
const RELEASE_GRACE_MINUTES = 30;

function hasReleased(timeEt: string | null, nowMinutesEt: number): boolean {
  if (!timeEt) return false;
  const [hour, minute] = timeEt.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  return nowMinutesEt >= hour * 60 + minute + RELEASE_GRACE_MINUTES;
}

export const maxDuration = 120;

/**
 * Günlük senkron — Vercel Cron her sabah 06:00 ET civarı çağırır.
 * Sıra: bilanço takvimi → haberler → makro seriler → gerçekleşen değerler →
 * günlük özet. Her adım kendi hatasını yutar; biri düşse diğerleri çalışır.
 */
export async function GET(request: Request) {
  /* Eskiden `if (secret && ...)` yazıyordu: CRON_SECRET tanımsızsa koşul hiç
     çalışmıyor ve bu uç herkese açık kalıyordu. Sağlayıcılardan veri çekip
     veritabanına yazan bir uç için kabul edilemez — artık üretimde anahtar
     yoksa istek reddediliyor. */
  const auth = checkBearer(request, process.env.CRON_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const report: Record<string, string | number> = {};
  const today = todayEt();
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > BUDGET_MS;

  /* ---- 1. Bilanço takvimi (bugün → +30 gün) ----
     Finnhub tek yanıtı ~1500 kayıtla keser; geniş aralık limit yüzünden bazı
     günleri düşürür (SNDK böyle kaybolmuştu). Bu yüzden GÜN GÜN çekilir —
     31 istek, 60/dk limitine sığar. Yazım yine toplu upsert'tir.

     Beklenti ve gerçekleşen (epsEstimate/epsActual, revenueEstimate/
     revenueActual) her koşumda ÜZERİNE YAZILIR: analist beklentisi bilanço
     gününe kadar revize olur, sonrasında gerçekleşen değer düşer. Yani bu
     tablo elle bakım istemiyor, kendi kendine güncel kalıyor. */
  try {
    const unique = new Map<
      string,
      NonNullable<Awaited<ReturnType<typeof getEarningsCalendar>> extends infer R
        ? R extends { ok: true; data: (infer T)[] }
          ? T
          : never
        : never>
    >();
    let anyOk = false;
    let firstError = "";
    let skippedDays = 0;
    for (let offset = 0; offset <= EARNINGS_HORIZON_DAYS; offset++) {
      /* Takvim ilk adım ve en önemlisi; yine de sınırsız değil. Bütçe
         biterse kalan günler ertesi koşumda çekilir — o güne kadar takvimin
         uzak ucu eksik kalır, yakın ucu değil. */
      if (outOfTime()) {
        skippedDays = EARNINGS_HORIZON_DAYS - offset + 1;
        break;
      }
      const day = addEtDays(today, offset);
      const result = await getEarningsCalendar(day, day);
      if (!result.ok) {
        firstError ||= result.message;
        continue;
      }
      anyOk = true;
      for (const entry of result.data) {
        unique.set(`${entry.symbol}|${entry.reportDate}`, entry);
      }
    }
    if (anyOk) {
      /* Koşumun TEK damgası. Aşağıdaki temizlik "bu koşumda dokunulmayan
         satır" diye ayırıyor; her paket kendi `new Date()`ini yazsaydı
         paketler arasında milisaniyelik fark olur ve ölçüt bulanıklaşırdı. */
      const runAt = new Date();
      const rows = [...unique.values()].map((entry) => ({
        symbol: entry.symbol,
        reportDate: entry.reportDate,
        hour: entry.hour,
        epsEstimate: entry.epsEstimate,
        epsActual: entry.epsActual,
        revenueEstimate: entry.revenueEstimate,
        revenueActual: entry.revenueActual,
        quarter: entry.quarter,
        year: entry.year,
      }));

      for (let i = 0; i < rows.length; i += 200) {
        await db
          .insert(earningsCalendar)
          .values(rows.slice(i, i + 200))
          .onConflictDoUpdate({
            target: [earningsCalendar.symbol, earningsCalendar.reportDate],
            set: {
              hour: sql`excluded.hour`,
              epsEstimate: sql`excluded.eps_estimate`,
              epsActual: sql`excluded.eps_actual`,
              revenueEstimate: sql`excluded.revenue_estimate`,
              revenueActual: sql`excluded.revenue_actual`,
              updatedAt: runAt,
            },
          });
      }

      /* ---- Revize edilmiş tarihin ölü satırını sil ----
         Tekil anahtar `(symbol, report_date)`: sağlayıcı bir şirketin
         beklenen rapor tarihini değiştirdiğinde upsert eski satırı
         güncellemiyor, YENİSİNİ ekliyor ve eskisi tabloda kalıyordu.
         Ölçüldü: 566 sembol-çeyrek çifti birden fazla tarihte duruyordu ve
         takvimde aynı şirket aynı çeyrek için iki kez görünüyordu.

         Silme ÜÇ KOŞULU BİRDEN istiyor, yani asla tekil bir satırı
         düşüremez: satır bu koşumda gerçekten taranan pencerede olacak
         (bütçe yüzünden atlanan günler hariç), bu koşumda dokunulmamış
         olacak ve aynı sembol-çeyrek için DAHA YENİ bir kardeşi bulunacak.
         Geçmiş tarihler pencerenin dışında; gerçekleşen rakamlar duruyor. */
      const taranan = EARNINGS_HORIZON_DAYS - skippedDays;
      if (taranan > 0) {
        const silinen = await db.execute(sql`
          delete from earnings_calendar e
          where e.report_date between ${today} and ${addEtDays(today, taranan)}
            and e.updated_at < ${runAt}
            and e.quarter is not null and e.year is not null
            and exists (
              select 1 from earnings_calendar y
              where y.symbol = e.symbol and y.quarter = e.quarter
                and y.year = e.year and y.updated_at > e.updated_at
            )
        `);
        report.earningsPurged = silinen.rowCount ?? 0;
      }

      report.earnings =
        skippedDays > 0
          ? `${rows.length} (son ${skippedDays} gün bütçe yüzünden atlandı)`
          : rows.length;
    } else {
      report.earnings = `atlandı: ${firstError}`;
    }
  } catch (error) {
    report.earnings = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2. Piyasa haberleri ---- */
  try {
    const result = await getMarketNews("general");
    if (result.ok) {
      const seen = new Set<string>();
      const rows = result.data
        .slice(0, 60)
        .filter((item) => {
          if (seen.has(item.providerId)) return false;
          seen.add(item.providerId);
          return true;
        })
        .map((item) => ({
          providerId: item.providerId,
          headline: item.headline,
          summary: item.summary,
          url: item.url,
          imageUrl: item.imageUrl,
          source: item.source,
          category: item.category,
          symbols: item.symbols,
          publishedAt: item.publishedAt,
        }));
      if (rows.length > 0) {
        await db.insert(newsTable).values(rows).onConflictDoNothing();
      }
      report.news = rows.length;
    } else {
      report.news = `atlandı: ${result.message}`;
    }
  } catch (error) {
    report.news = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2b. Şirket haberleri ----
     Genel akış Yahoo ağırlıklı ve Yahoo her habere aynı yer tutucu logoyu
     iliştiriyor; o beslemeden okunur bir görsel çıkmıyor. Şirket bazlı uç
     ise makalenin kendi görselini veriyor (Benzinga, SeekingAlpha, Reuters
     foto servisi…). Bu yüzden en büyük şirketler için ayrıca çekiliyor. */
  try {
    const majors = await db
      .select({ symbol: symbolsTable.symbol })
      .from(symbolsTable)
      .where(isNotNull(symbolsTable.marketCap))
      .orderBy(desc(symbolsTable.marketCap))
      .limit(COMPANY_NEWS_SYMBOLS);

    const from = addEtDays(today, -2);
    let inserted = 0;

    let skipped = 0;
    for (const { symbol } of majors) {
      if (outOfTime()) {
        skipped++;
        continue;
      }
      const result = await getCompanyNews(symbol, from, today);
      if (!result.ok) continue;

      const rows = result.data
        .filter((item) => item.imageUrl)
        .slice(0, 4)
        .map((item) => ({
          providerId: item.providerId,
          headline: item.headline,
          summary: item.summary,
          url: item.url,
          imageUrl: item.imageUrl,
          source: item.source,
          category: item.category,
          symbols: item.symbols?.length ? item.symbols : [symbol],
          publishedAt: item.publishedAt,
        }));

      if (rows.length > 0) {
        await db.insert(newsTable).values(rows).onConflictDoNothing();
        inserted += rows.length;
      }
    }

    report.companyNews =
      skipped > 0 ? `${inserted} (${skipped} sembol atlandı)` : inserted;
  } catch (error) {
    report.companyNews = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2c. Haber çevirisi (Claude — anahtar varsa) ---- */
  try {
    if (isTranslateConfigured()) {
      report.translate = await translatePendingNews(40);
    } else {
      report.translate = "atlandı: DEEPL_API_KEY veya ANTHROPIC_API_KEY yok";
    }
  } catch (error) {
    report.translate = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2d. Sembol profillerini tazele ----
     Profil; hisse sayısı, sektör ve logoyu taşır. Piyasa değeri sayfalarda
     canlı fiyat × hisse sayısı olarak hesaplandığı için bu kayıtların gün
     içinde tazelenmesi gerekmez — hisse sayısı ancak geri alım/ihraçla
     değişir. Günde 25 sembol dönerek ~29 günde tüm evren yenilenir; sayı bir
     dönem 60'tı ve koşum 120 saniyelik fonksiyon bütçesini aşıyordu, bu
     yüzden kuyruğun sonundaki profiller sessizce hiç çalışmıyordu (gerekçe
     dosyanın başında). Finnhub'ın dakikada 60 istek sınırı da aynı kapıdan
     geçiyor. */
  try {
    /* Sıra: adla seçilen şirketler → yaklaşan bilançoların tanınmayan
       sembolleri → kalan bütçeyle en uzun süredir güncellenmeyenler. getCompanyProfile
       symbols tablosuna kendisi yazar (insert/update).

       Adla seçilenler en başta çünkü onların künyesi EKRANDA KULLANILIYOR:
       takvimde görünür katmana, gün şeridine ve analiz aday havuzuna sembolle
       giriyorlar ama ad, sektör ve logo profilden geliyor. ONDS bu yüzden
       aylarca künyesiz kaldı — bilanço takviminde kaydı vardı, `symbols`
       tablosunda hiç satırı yoktu. Sekiz sembol; günlük 25'lik bütçenin
       yanında küçük ama görmezden gelinecek kadar değil — sayı büyürse
       bütçenin de büyümesi gerekir. */
    const [upcoming, stalest] = await Promise.all([
      getEarningsSymbolsMissingProfile(7, 10),
      getStalestSymbols(PROFILE_REFRESH_LIMIT),
    ]);
    const targets = [
      ...new Set([...SPOTLIGHT_SYMBOLS, ...upcoming, ...stalest]),
    ].slice(0, PROFILE_REFRESH_LIMIT);

    let refreshed = 0;
    let skipped = 0;
    for (const symbol of targets) {
      if (outOfTime()) {
        skipped++;
        continue;
      }
      const result = await getCompanyProfile(symbol);
      if (result.ok) {
        refreshed++;
        continue;
      }
      /* DAMGA YALNIZCA KALICI HATADA İLERLETİLİR.
         Eskiden her başarısızlıkta güncelleniyordu ve bu, geçici bir hatayı
         kalıcı bir karara çeviriyordu: kotaya takılan ya da ağ hatası alan
         bir sembol "tazelenmiş" sayılıp sıranın en arkasına gidiyor ve
         evren bir turu tamamlayana kadar (haftalar) bir daha denenmiyordu.
         Sağlayıcı sembolü tanımıyorsa (`not-found`) tekrar denemenin
         anlamı yok — orada damga ilerliyor. */
      if (result.reason === "not-found" || result.reason === "empty") {
        await db
          .update(symbolsTable)
          .set({ updatedAt: new Date() })
          .where(eq(symbolsTable.symbol, symbol));
      }
    }
    report.profiles = skipped > 0 ? `${refreshed} (${skipped} atlandı)` : refreshed;
  } catch (error) {
    report.profiles = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2e. Ekonomik takvimi ileriye doldur ----
     Takvimin ilan edilmiş tarihleri elle tohumlanıyordu ve bir gün bitip
     ekranı sessizce boşaltıyordu. Artık FRED'in yayın takviminden bir yıl
     ileriye kadar kendi kendine uzuyor; elle işlenmiş kayıtlara dokunmuyor.
     Ayrıntı ve FOMC'nin neden buradan gelmediği: lib/calendar-sync.ts */
  try {
    const sync = await syncCalendar(today);
    report.calendar = `+${sync.inserted} yayın, +${sync.rolling} haftalık`;
    if (sync.problems.length > 0) {
      report.calendarProblems = sync.problems.join(" | ");
    }
    /* Takvimin ömrü rapora yazılır: bu sayı küçülüyorsa senkron çalışmıyor
       demektir ve bunu takvim boşalmadan ÖNCE görmek gerekir. */
    report.calendarRunwayDays = await calendarRunwayDays(today);
  } catch (error) {
    report.calendar = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 2f. Endeks listesi güncelliğini yitirdi mi ----
     indices.ts elle bakiliyor ve bir kez gercekten eskidi (SPCX Nasdaq-100'e
     girdi, dosya kacirdi). Otomatik duzeltemiyoruz — Finnhub'in bilesen ucu
     ucretsiz katmanda 403 — ama dev bir sirketin hicbir endekste gorunmemesi
     tespit edilebilir bir tutarsizlik. Raporda cikar, insan bakar. */
  try {
    const known = new Set(ALL_MEMBERS.map((member) => member.symbol));
    const drifting = await getIndexDriftCandidates(known);
    report.indexDrift =
      drifting.length === 0
        ? "yok"
        : drifting
            .slice(0, 5)
            .map((row) => `${row.symbol} (${Math.round(row.marketCap / 1e9)}Mr$)`)
            .join(", ");
  } catch (error) {
    report.indexDrift = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 3. Makro seriler ---- */
  try {
    let count = 0;
    for (const definition of MACRO_SERIES) {
      const result = await getSeries(definition);
      if (!result.ok) continue;
      await db
        .update(macroSeries)
        .set({
          latestValue: result.data.latestValue,
          prevValue: result.data.prevValue,
          periodLabel: result.data.periodLabel,
          observations: result.data.observations,
          updatedAt: new Date(),
        })
        .where(eq(macroSeries.seriesId, definition.seriesId));
      count++;
    }
    report.macro = count;
  } catch (error) {
    report.macro = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 4. Geçmiş olayların gerçekleşen değerleri ----
     Son 7 günün olaylarından actual'ı boş olanlara FRED'deki en güncel
     gözlemi işle. Sonraki açıklama tarihini de takvimden doldur.

     AÇIKLANMAMIŞ OLAY DIŞARIDA. Sorgu bugünün olaylarını da kapsıyordu ve
     cron 06:30 ET civarında koşuyor; ekonomik veriler ise 08:30 ET'de
     çıkıyor. Yani TÜFE gününde, veri daha AÇIKLANMADAN, FRED'in o an
     verdiği en güncel gözlem — geçen ayınki — bugünün olayına "gerçekleşen"
     diye yazılıyordu. Ekranda uydurma bir sayı değil, YANLIŞ TARİHE
     yapıştırılmış gerçek bir sayı görünüyordu ki bu daha da kötü: hiçbir
     yerde şüphe uyandırmıyor.

     Kural: olayın kendi saati geçmediyse dokunma. Payı 30 dakika — FRED
     yayını anında yansıtmıyor. */
  try {
    let filled = 0;
    let skippedUnreleased = 0;
    const nowEt = etParts(new Date());
    const pending = await db
      .select()
      .from(economicEvents)
      .where(
        and(
          gte(economicEvents.eventDate, addEtDays(today, -7)),
          lte(economicEvents.eventDate, today),
          isNull(economicEvents.actual),
        ),
      );

    for (const event of pending) {
      if (event.eventDate === today && !hasReleased(event.eventTimeEt, nowEt.minutes)) {
        skippedUnreleased++;
        continue;
      }
      if (!event.fredSeriesId) continue;
      const definition = MACRO_SERIES.find(
        (s) => s.seriesId === event.fredSeriesId,
      );
      if (!definition) continue;

      const result = await getSeries(definition, 3);
      if (!result.ok || result.data.latestValue === null) continue;

      await db
        .update(economicEvents)
        .set({
          actual: String(result.data.latestValue),
          previous:
            result.data.prevValue !== null
              ? String(result.data.prevValue)
              : event.previous,
          updatedAt: new Date(),
        })
        .where(eq(economicEvents.id, event.id));
      filled++;
    }

    // Makro kartlardaki "sonraki açıklama" — takvimdeki ilk ileri tarihli olay
    for (const definition of MACRO_SERIES) {
      const [next] = await db
        .select({ date: economicEvents.eventDate })
        .from(economicEvents)
        .where(
          and(
            eq(economicEvents.fredSeriesId, definition.seriesId),
            gte(economicEvents.eventDate, today),
          ),
        )
        .orderBy(economicEvents.eventDate)
        .limit(1);
      if (next) {
        await db
          .update(macroSeries)
          .set({ nextReleaseAt: next.date })
          .where(eq(macroSeries.seriesId, definition.seriesId));
      }
    }

    report.actuals = filled;
    /* Atlananlar raporda görünür: sayı sürekli sıfırdan büyükse cron çok
       erken koşuyor demektir ve bu bir ayar sorunu, bir hata değil. */
    if (skippedUnreleased > 0) {
      report.actualsSkipped = `${skippedUnreleased} olay henüz açıklanmadı`;
    }
  } catch (error) {
    report.actuals = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* ---- 5. Ölçüm kayıtlarını buda ----
     Sayfa görüntülemeleri satır satır tutuluyor ve hiçbir şey silmezse tablo
     sonsuza kadar büyür. Panelin en geniş penceresi altı ay; daha eskisinin
     tek faydası fatura. Silme İŞ GÜNÜNE değil takvim gününe göre: ölçüm
     borsanın kapalı olduğu günlerde de birikiyor. */
  try {
    const cutoff = addEtDays(today, -VIEW_RETENTION_DAYS);
    /* SATIRLARI GERİ ÇEKMEDEN SAY. `.returning()` silinen her satırın
       uuid'sini Neon'dan HTTP üzerinden geri getiriyordu; cron birkaç gün
       aksadıktan sonra koştuğunda bu yüz binlerce uuid'lik bir yanıt olabilir
       ve zaten dar olan bütçeyi boşuna yer. Sürücü etkilenen satır sayısını
       zaten veriyor. */
    const deleted = await db.delete(pageViews).where(lt(pageViews.viewedOn, cutoff));
    report.viewsPurged = deleted.rowCount ?? 0;
  } catch (error) {
    report.viewsPurged = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* Haber tablosu da budanıyor — ölçüm buduluyordu ama haber sonsuza kadar
     büyüyordu. Gerekçe NEWS_RETENTION_DAYS'te. */
  try {
    const cutoff = new Date(
      Date.parse(`${addEtDays(today, -NEWS_RETENTION_DAYS)}T00:00:00Z`),
    );
    const deleted = await db
      .delete(newsTable)
      .where(lt(newsTable.publishedAt, cutoff));
    report.newsPurged = deleted.rowCount ?? 0;
  } catch (error) {
    report.newsPurged = `hata: ${error instanceof Error ? error.message : "?"}`;
  }

  /* Bülten üretimi BİLEREK YOK. Cron bir dönem kural tabanlı bir özet
     yazıyordu (madde listesi hâlinde takvim + bilanço + endeks) ve 13:30'da
     günün slotunu dolduruyordu; kart 16:00'ya kadar bu mekanik metni "BUGÜN"
     rozetiyle gösteriyor, elle yazılmış dünkü bülteni ve eskime notunu hiç
     göstermiyordu. Bülteni yalnızca claude.ai rutini yazar (16:00 TR,
     POST /api/brief); o saate kadar kart en son bülteni "dünün yazısı" notuyla
     gösterir — o mekanizma BriefSwitch'te hazır ve doğru davranış bu. */

  return NextResponse.json({ ok: true, date: today, report });
}
