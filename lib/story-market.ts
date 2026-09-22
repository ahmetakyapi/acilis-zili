import type { MarketStatus } from "@/lib/market-hours";

export type StoryClose = { price: number; date: string };

/** Daily bars can include today's unfinished candle. Only a completed
 * session can be called a closing price; allow the delayed feed to finish
 * after an ordinary or early close. Existing provider cache guards apply. */
export function lastStoryClose(
  bars: readonly { time: number; close: number }[] | undefined,
  status: Pick<MarketStatus, "etDate" | "etMinutes" | "closeMinutes" | "tradingToday">,
): StoryClose | null {
  if (!bars) return null;
  const todayComplete = status.tradingToday && status.etMinutes >= status.closeMinutes + 15;
  let latest: StoryClose | null = null;
  for (const bar of bars) {
    if (!Number.isFinite(bar.time) || !Number.isFinite(bar.close) || bar.close <= 0) continue;
    const date = new Date(bar.time * 1000).toISOString().slice(0, 10);
    if (date > status.etDate || (date === status.etDate && !todayComplete)) continue;
    if (!latest || date > latest.date) latest = { price: bar.close, date };
  }
  return latest;
}

/* --------------------------------------------------------------------------
   Olaydan bugüne getiri

   Arşiv kartlarındaki ve manşetteki tek rakam: yazının anlattığı olayın
   gününden bugüne, o sembolün ne yaptığı. Kart "bu ay fiyat nasıl seyretti"
   diye sormuyor — "bu olaydan sonra ne oldu" diye soruyor.
   -------------------------------------------------------------------------- */

/**
 * Olayın barlarla eşleşmesi için tanınan boşluk.
 *
 * Olay gününden sonraki İLK işlem günü taban sayılıyor; hafta sonu ve tatil
 * payı buradan geliyor.
 */
const MAX_EVENT_GAP_SECONDS = 10 * 86400;

/**
 * Olaydan son kapanışa yüzde değişim.
 *
 * TABAN OLAYDAN ÖNCEKİ KAPANIŞ — olay gününün kapanışı DEĞİL.
 *
 * Taban olay gününün kendi kapanışıydı ve bu iki şeyi birden bozuyordu:
 *
 *   1. Olayın kendi etkisi ölçünün DIŞINDA kalıyordu. Sitedeki "Moderna
 *      %177 Yükseldi" yazısı bunun en açık örneği: hisse olay günü %177
 *      yükselmiş, ama olay gününün kapanışından ölçülünce kartta − %16,77
 *      yazıyordu. Okuyucu başlıkta "yükseldi" okuyup rakamda düşüş
 *      görüyordu. Aynı sayı doğru tabandan + %130,51.
 *   2. Olay SON işlem gününe denk geldiğinde taban ile son bar aynı bar
 *      oluyor ve fonksiyon hiçbir şey döndüremiyordu. Yani rakam tam da en
 *      yeni — ve sayfada en üstte duran — yazılarda kayboluyordu: manşetin
 *      kadro tablosundaki üç şirket de tire gösteriyordu.
 *
 * Olaydan önceki kapanış yoksa (olay serinin başında ya da öncesinde) taban
 * olay barının kendisi kalır; o da son barsa hiçbir şey dönmez.
 *
 * TABAN UYDURULMAZ. Bir yıllık bar çekiliyor; olay üç yıl önceyse serinin en
 * eski barı olayın günü değil. Bu fonksiyon bir dönem o tabandan yüzde
 * hesaplayıp sonucu yine "olaydan bugüne" diye yazıyordu, yani künye sayının
 * ne olduğu konusunda yanılıyordu. `MAX_EVENT_GAP_SECONDS` bunu engelliyor.
 */
export function sinceEventReturn(
  bars: readonly { time: number; close: number }[] | undefined,
  eventDate: string,
): number | null {
  if (!bars || bars.length < 2) return null;

  const eventTs = Date.parse(`${eventDate}T00:00:00Z`) / 1000;
  if (!Number.isFinite(eventTs)) return null;

  const at = bars.findIndex((bar) => bar.time >= eventTs);
  if (at < 0) return null;
  if (bars[at].time - eventTs > MAX_EVENT_GAP_SECONDS) return null;

  const base = at > 0 ? bars[at - 1] : bars[at];
  const last = bars[bars.length - 1];
  if (base.close <= 0 || base.time === last.time) return null;

  return ((last.close - base.close) / base.close) * 100;
}

/**
 * "Olaydan Bugüne" — TEK KURAL, üç ekran (Mercek listesi, yazı sayfası,
 * şirket sayfasının yazılar bölümü).
 *
 * Liste yüzdeyi serinin SON barından hesaplıyordu; o bar seans sürerken
 * bitmemiş mum olabiliyor. Yazı sayfası ise tamamlanmış kapanışta kesiyordu
 * ve aynı ölçü iki ekranda iki sayı veriyordu (23 Eylül 00:30 TR, ölçüldü:
 * listede AMD +%10,74, yazıda +%11,42). Artık üçü de buradan:
 *
 * - Seri `lastStoryClose`un kabul ettiği son TAMAMLANMIŞ kapanışta kesilir;
 *   künye o günü yazar ("22 Eyl Kapanışı").
 * - İlk olay sonrası kapanış gelmeden YÜZDE YOK: o gün ölçülen şey olay
 *   gününün kendi hareketi ve yazı o günü kendi kaynağıyla basıyor —
 *   sağlayıcının barı onunla çelişebiliyordu (Arm +%17,16 / yazıda +%10).
 *   Çağıran isterse son kapanışı tarihiyle gösterir.
 */
export function storySinceEvent(
  bars: readonly { time: number; close: number }[] | undefined,
  eventDate: string,
  status: Pick<MarketStatus, "etDate" | "etMinutes" | "closeMinutes" | "tradingToday">,
): { pct: number | null; close: StoryClose | null } {
  const close = lastStoryClose(bars, status);
  if (!bars || !close || close.date <= eventDate) return { pct: null, close };
  const settled = bars.filter(
    (bar) => new Date(bar.time * 1000).toISOString().slice(0, 10) <= close.date,
  );
  return { pct: sinceEventReturn(settled, eventDate), close };
}
