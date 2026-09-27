import {
  SESSION_BOUNDS,
  addEtDays,
  etParts,
  quoteBasis,
  type MarketStatus,
  type QuoteBasis,
} from "./market-hours";

/**
 * Açılış Kartı — günün paylaşılabilir görselinin SAF mantığı.
 *
 * Görselin kendisi `app/gun/[tarih]/kart/route.tsx`te; burada veritabanına
 * ve sağlayıcıya dokunmayan kararlar duruyor, ki test edilebilsinler:
 * adresteki tarihin kabulü, günün üç olayının seçimi ve endeks
 * hareketlerinin HANGİ SEANSI anlattığı.
 */

/** Adresin "bugün" takma adı — `/gun/bugun/kart` her gün günün kartı. */
export const TODAY_ALIAS = "bugun";

/** Kabul edilen tarih penceresi: bugünden bu kadar gün geri ve ileri. */
const CARD_PAST_DAYS = 400;
const CARD_FUTURE_DAYS = 30;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Adresteki tarihi ET gününe çevirir; geçersizse `null` (rota 404 verir).
 *
 * PENCERE VAR: sınırsız bir tarih kabul edilseydi `/gun/1900-01-01/kart`
 * gibi binlerce adres her biri ayrı bir görsel çizimi tetikleyebilirdi.
 * Bir yıldan eski kart paylaşılmıyor, bir aydan uzak gelecekte takvim boş.
 */
export function parseCardDate(raw: string, today: string): string | null {
  if (raw === TODAY_ALIAS) return today;
  if (!ISO_DATE.test(raw)) return null;
  const parsed = new Date(`${raw}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    return null;
  }
  if (raw < addEtDays(today, -CARD_PAST_DAYS) || raw > addEtDays(today, CARD_FUTURE_DAYS)) {
    return null;
  }
  return raw;
}

/* --------------------------------------------------------------------------
   Günün olayları
   -------------------------------------------------------------------------- */

export type CardEconomicInput = {
  title: string;
  /** "HH:mm" ET; saati ilan edilmemişse null. */
  timeEt: string | null;
  importance: string;
};

export type CardEarningsInput = {
  symbol: string;
  name: string | null;
  /** Takvimin penceresi: bmo | amc | dmh; bilinmiyorsa null. */
  hour: string | null;
  marketCap: number | null;
};

export type CardEvent =
  | { kind: "economic"; title: string; timeEt: string | null }
  | { kind: "earnings"; symbol: string; name: string | null; hour: string | null };

/** Kartta kaç olay duruyor — üç satır 1200×630'a başlığı ezmeden sığıyor. */
export const CARD_EVENT_LIMIT = 3;

/** Makro olaylardan en fazla bu kadarı; kalan yer bilançolara. */
const ECONOMIC_SHARE = 2;

const IMPORTANCE_RANK: Readonly<Record<string, number>> = { high: 0, medium: 1, low: 2 };

/**
 * YALNIZCA SIRALAMA İÇİN bir dakika. Bilanço satırının saati YOK, penceresi
 * var (açılış öncesi / seans içi / kapanış sonrası); ekrana saat YAZILMIYOR
 * (CLAUDE.md "Veri dürüstlüğü" 1), yalnızca makro olaylarla aynı eksende
 * doğru sıraya girsin diye pencerenin sınırına oturtuluyor.
 */
function sortMinutes(event: CardEvent): number {
  const clock = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };
  if (event.kind === "economic") {
    return event.timeEt ? clock(event.timeEt) : Number.MAX_SAFE_INTEGER;
  }
  if (event.hour === "bmo") return SESSION_BOUNDS.regularOpen - 1;
  if (event.hour === "dmh") return SESSION_BOUNDS.regularOpen + 1;
  if (event.hour === "amc") return SESSION_BOUNDS.regularClose + 1;
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Günün üç olayı: önce yüksek önemli makro veriler (en fazla iki), kalan
 * yer piyasa değeri en büyük bilançolara. Sonuç ZAMAN sırasında.
 *
 * Neden karışık: yalnızca makro seçilseydi bilanço sezonunda NVDA'nın
 * açıkladığı gün kartta görünmezdi; yalnızca bilanço seçilseydi CPI günü
 * kaybolurdu. Düşük önemli makro olay (haftalık stok verisi gibi) karta
 * hiç girmiyor: üç satırlık yerde gürültü.
 */
export function pickKeyEvents(
  economic: CardEconomicInput[],
  earnings: CardEarningsInput[],
  limit = CARD_EVENT_LIMIT,
): CardEvent[] {
  const macro = economic
    .filter((event) => event.importance !== "low")
    .sort(
      (a, b) =>
        (IMPORTANCE_RANK[a.importance] ?? IMPORTANCE_RANK.low) -
          (IMPORTANCE_RANK[b.importance] ?? IMPORTANCE_RANK.low) ||
        (a.timeEt ?? "99:99").localeCompare(b.timeEt ?? "99:99"),
    )
    .slice(0, Math.min(ECONOMIC_SHARE, limit))
    .map((event): CardEvent => ({ kind: "economic", title: event.title, timeEt: event.timeEt }));

  const reports = [...earnings]
    .sort((a, b) => (b.marketCap ?? -1) - (a.marketCap ?? -1) || a.symbol.localeCompare(b.symbol, "en"))
    .slice(0, limit - macro.length)
    .map((row): CardEvent => ({ kind: "earnings", symbol: row.symbol, name: row.name, hour: row.hour }));

  return [...macro, ...reports].sort((a, b) => sortMinutes(a) - sortMinutes(b));
}

/* --------------------------------------------------------------------------
   Endeks hareketleri — hangi seans?
   -------------------------------------------------------------------------- */

/**
 * Kartta fonun değil ENDEKSİN adı yazıyor, ama yüzde fonun yüzdesi — ana
 * sayfanın endeks kartlarıyla aynı sözleşme (`components/today/IndexLive.tsx`).
 * O dosyadaki tablo bir "use client" modülünde ve sunucuda değer olarak
 * okunamıyor (CLAUDE.md "İstemci ile sunucu sınırı"); iki satırlık kopya
 * bu yüzden burada.
 */
export const CARD_INDEX_NAMES: Readonly<Record<string, string>> = {
  QQQ: "Nasdaq 100",
  SPY: "S&P 500",
  DIA: "Dow Jones",
  IWM: "Russell 2000",
};

export type CardQuote = {
  symbol: string;
  changePct: number | null;
  tradedAt: Date | null;
};

export type CardMoves = {
  basis: QuoteBasis;
  /** `lastClose` ise yüzdenin anlattığı seansın ET günü. */
  sessionDay: string | null;
  items: { symbol: string; changePct: number }[];
};

/**
 * Kartta endeks yüzdesi basılabilir mi, basılırsa NEYİ anlatıyor.
 *
 * Kural CLAUDE.md "Veri dürüstlüğü" 4'ün kartlaştırılmış hâli: bir yüzde
 * hangi seansı anlattığını KANITLAMADAN basılmaz.
 *
 * - Kartın günü seans günüyse (`status.sessionDate`): yüzdeler o seansa ait
 *   olanlar; künye `quoteBasis`ten (seans içi / açılış öncesi / kapanış
 *   sonrası).
 * - Kartın günü BUGÜN ama seans henüz başlamadıysa (sessionDate dünü
 *   anlatıyor): yüzde ÖNCEKİ KAPANIŞ ve künye bunu tarihiyle söylüyor.
 * - Geçmiş ya da gelecek bir gün: hiçbir yüzde basılmaz. Elimizde o günün
 *   kotasyonu yok ve bugünün yüzdesini geçmiş bir tarihin kartına yazmak
 *   tam olarak "başka bir günün verisi" hatası olurdu.
 *
 * Bütün semboller AYNI künyeyi paylaşmak zorunda: kartta tek bir künye
 * satırı var. İlk sembolün (sıra INDEX_STRIP) künyesine uymayan sembol
 * karttan düşüyor; iki farklı seansın yüzdesi yan yana tek künyeyle
 * durmasın.
 *
 * `stale` (sağlayıcı katmanı paketi güncel bulamadı) ise hiçbir şey
 * basılmaz: kart paylaşılıp günlerce önbellekte kalan bir görsel ve bayat
 * bir yüzdeyi büyük puntoyla göstermek "Veri dürüstlüğü" 2'nin ihlali.
 */
export function cardMoves(
  cardDate: string,
  status: MarketStatus,
  quotes: CardQuote[],
  stale: boolean,
): CardMoves | null {
  if (stale || quotes.length === 0) return null;

  const isSessionDay = cardDate === status.sessionDate;
  const isBeforeOpenToday = cardDate === status.etDate && status.sessionDate < cardDate;
  if (!isSessionDay && !isBeforeOpenToday) return null;

  const read = quotes.flatMap((quote) => {
    if (quote.changePct === null || !quote.tradedAt) return [];
    const basis: QuoteBasis = isSessionDay ? quoteBasis(quote, status) : "lastClose";
    /* Seans gününün kartında `lastClose` künyesi de kanıt istiyor: işlemin
       günü seans gününden önceyse bu yüzde başka bir günü anlatıyor. */
    const day = etParts(quote.tradedAt).dateStr;
    if (!isSessionDay && day >= cardDate) return [];
    return [{ symbol: quote.symbol, changePct: quote.changePct, basis, day }];
  });
  const lead = read[0];
  if (!lead) return null;
  const same = read.filter(
    (item) => item.basis === lead.basis && (lead.basis !== "lastClose" || item.day === lead.day),
  );
  return {
    basis: lead.basis,
    sessionDay: lead.basis === "lastClose" ? lead.day : null,
    items: same.map(({ symbol, changePct }) => ({ symbol, changePct })),
  };
}
