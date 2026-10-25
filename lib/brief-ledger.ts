import { PAREN_STOPLIST } from "./autolink";
import { closeToClose } from "./brief-indices";
import { dayChange, posterReadyAt } from "./day-poster";
import { STORY_FLAT_BAND } from "./day-poster-story";
import { addEtDays, isTradingDay, prevTradingDay, type MarketHoliday } from "./market-hours";
import type { Bar } from "./providers/types";

/**
 * BÜLTENİN KAYIT DEFTERİ — saf kurallar (25 Ekim görsel zirve turu).
 *
 * SORUN. Bülten sayfası 1440 pikselde 2.775 kelime ve sıfır görseldi; ana
 * sayfadaki kartı da öyle. Metin "DIA %1,24, SPY %0,52 düştü" diyordu ama
 * okuyucu dört endeksin aynı günü nasıl yaşadığını ancak dört sayıyı
 * akılda tutarak karşılaştırabiliyordu.
 *
 * ÇÖZÜM. Başlığın altında bir bant: dört endeks ortak sıfır çizgili
 * kulvarlarda, öne çıkan üç ölçü önce → sonra kartlarında, bültende adı
 * geçen hisseler logolu bir şeritte. Bant YENİ BİR ŞEY YAZMIYOR: her sayı
 * bülten tarihindeki TAMAMLANMIŞ seansın verisinden, rutin hiçbir şeye
 * dokunmuyor ve cümle şablon + veri.
 *
 * HANGİ SEANS. Günlük bülten 16:10 TR'de, ABD açılışından ÖNCE yazılıyor
 * (docs/claude-rutinler.md § 1) ve bir önceki seansı anlatıyor: 24 Ekim
 * Cumartesi sayısı 23 Ekim Cuma'yı, bir salı sayısı pazartesiyi. Bant da o
 * yüzden `briefDate`ten ÖNCEKİ son işlem gününe bakıyor ve bunu künyesinde
 * adıyla söylüyor ("23 Ekim Cuma Kapanışı"). Haftalık sayı pazartesi
 * çapasıyla (`weekAnchor`) biten haftayı anlatıyor: pazartesi–cuma.
 *
 * HESAP. Günlük yüzde `dayChange` — Günün Posteri'nin kendi fonksiyonu,
 * yani bandın S&P 500'ü posterdekiyle aynı sayı (CLAUDE.md "Veri
 * dürüstlüğü" 3). Haftalık yüzde `closeToClose` — bülten bağlamının ve
 * pazar özetinin tanımı (lib/brief-indices.ts).
 *
 * Bu dosya SAF: tests/brief-ledger.test.ts her kararı ölçüyor. Veri tarafı
 * `lib/brief-ledger-data.ts`, çizim `components/today/BriefLedger.tsx`.
 */

export type LedgerPeriod = "daily" | "weekly";

export type LedgerDay = { date: string; trading: boolean };

export type LedgerWindow = {
  period: LedgerPeriod;
  /** Dönemin ilk ve son takvim günü (günlükte ikisi de seans). */
  from: string;
  to: string;
  /** Dönemin SON seansı — yüzdenin vardığı kapanış. */
  session: string;
  /** Dönemden önceki son seans — yüzdenin tabanı. */
  prevSession: string;
  /** Haftalıkta beş iş günü (tatil `trading: false`); günlükte tek gün. */
  days: LedgerDay[];
};

/** Haftanın gün sayısı — pazartesiden cumaya. */
const WEEK_DAYS = 5;

/**
 * Bülten sayısının anlattığı dönem. İşlem günü bulunamazsa (tam tatil
 * haftası) `null` — bant basılmaz.
 */
export function ledgerWindow(
  briefDate: string,
  period: LedgerPeriod,
  holidays: MarketHoliday[],
): LedgerWindow | null {
  if (period === "daily") {
    const session = prevTradingDay(briefDate, holidays);
    return {
      period,
      from: session,
      to: session,
      session,
      prevSession: prevTradingDay(session, holidays),
      days: [{ date: session, trading: true }],
    };
  }
  const days = Array.from({ length: WEEK_DAYS }, (_, i) => {
    const date = addEtDays(briefDate, i);
    return { date, trading: isTradingDay(date, holidays) };
  });
  const last = [...days].reverse().find((day) => day.trading);
  if (!last) return null;
  return {
    period,
    from: days[0].date,
    to: days[WEEK_DAYS - 1].date,
    session: last.date,
    prevSession: prevTradingDay(days[0].date, holidays),
    days,
  };
}

/** Dönemin son seansı kapandı ve verisi oturdu mu — posterin eşiği. */
export function ledgerComplete(window: LedgerWindow, holidays: MarketHoliday[], now: Date): boolean {
  return now.getTime() >= posterReadyAt(window.session, holidays).getTime();
}

/* --------------------------------------------------------------------------
   Endeksler ve hisseler
   -------------------------------------------------------------------------- */

/** Haftalık şeridin bir hücresi; tatilde `change` null. */
export type LedgerStep = { date: string; change: number | null };

export type LedgerMove = {
  symbol: string;
  /** Dönemin kapanıştan kapanışa yüzdesi. */
  change: number;
  /** Haftalıkta beş gün; günlükte boş. */
  steps: LedgerStep[];
};

/**
 * Bir sembolün dönemi. Bir gün bile eksikse `null`: eksik hücreli şerit
 * okuyucuya o günü "yatay" diye okuturdu, eksik günlü hafta toplamı da
 * yanlış haftayı anlatırdı.
 */
export function ledgerMove(
  symbol: string,
  bars: readonly Bar[] | undefined,
  window: LedgerWindow,
  holidays: MarketHoliday[],
): LedgerMove | null {
  if (!bars || bars.length === 0) return null;
  if (window.period === "daily") {
    const change = dayChange(bars, window.session, window.prevSession);
    return change === null ? null : { symbol, change, steps: [] };
  }
  const move = closeToClose(bars, window.from, window.to);
  if (move.change_pct === null || move.price_date !== window.session) return null;
  const steps: LedgerStep[] = [];
  for (const day of window.days) {
    if (!day.trading) {
      steps.push({ date: day.date, change: null });
      continue;
    }
    const change = dayChange(bars, day.date, prevTradingDay(day.date, holidays));
    if (change === null) return null;
    steps.push({ date: day.date, change });
  }
  return { symbol, change: move.change_pct, steps };
}

/**
 * ORTAK ÖLÇEK — bütün kulvarlar ve hücreler tek ölçekte (yüzde puan).
 * Taban posterinkiyle aynı gerekçe (`POSTER_SCALE_FLOOR`): ±%0,2'lik sakin
 * günün şeridi %3'lük günün şeridi kadar uzun durmasın.
 */
export const LEDGER_SCALE_FLOOR = 1;

export function ledgerScale(moves: readonly LedgerMove[], useSteps: boolean): number {
  const values = moves.flatMap((move) =>
    useSteps ? move.steps.map((step) => Math.abs(step.change ?? 0)) : [Math.abs(move.change)],
  );
  return Math.max(LEDGER_SCALE_FLOOR, ...values);
}

/* --------------------------------------------------------------------------
   Ölçüler — önce → sonra
   -------------------------------------------------------------------------- */

export type LedgerMetricKey = "us10y" | "vix" | "usdtry";

export type LedgerMetric = {
  key: LedgerMetricKey;
  value: number;
  prev: number;
  /** Değerin kendi gözlem günü — kartta yazılır. */
  date: string;
  prevDate: string;
};

export type Observation = { date: string; value: number };

/**
 * Bir gözlem serisinden dönemin ölçüsü.
 *
 * GÜNLÜKTE GÖZLEM O SEANSIN GÜNÜNDE OLMALI. 10 yıllık faiz ya da VIX o gün
 * yayımlanmadıysa (tahvil piyasası tatili, kaynak gecikmesi) bir önceki
 * günün değeri "23 Ekim" diye basılmaz — ölçü kalkar (CLAUDE.md "Veri
 * dürüstlüğü" 2). Taban, gözlemden önceki son gözlem.
 *
 * HAFTALIKTA dönemin içindeki son gözlem ile dönemden önceki son gözlem;
 * hafta içinde hiç gözlem yoksa ölçü kalkar.
 */
export function metricFromObservations(
  key: LedgerMetricKey,
  observations: readonly Observation[],
  window: LedgerWindow,
): LedgerMetric | null {
  const sorted = [...observations]
    .filter((point) => Number.isFinite(point.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  let current: Observation | null = null;
  let prev: Observation | null = null;
  for (const point of sorted) {
    if (point.date < window.from) prev = point;
    else if (point.date <= window.to) current = point;
  }
  if (!current || !prev) return null;
  if (window.period === "daily" && current.date !== window.session) return null;
  return { key, value: current.value, prev: prev.value, date: current.date, prevDate: prev.date };
}

/* --------------------------------------------------------------------------
   Veriden tek cümle
   -------------------------------------------------------------------------- */

export type LedgerStory =
  | { kind: "allUp" | "allDown"; symbol: string; change: number }
  | { kind: "mixed"; up: string[]; down: string[]; flat: string[] }
  | {
      kind: "week";
      dir: "up" | "down" | "flat";
      symbol: string;
      change: number;
      sessions: number;
      upDays: number;
      /** En sert günün haftadaki sırası (0 = pazartesi). */
      dayIndex: number;
      dayChange: number;
    };

/** Yatay bandı posterin cümlesiyle aynı (±0,1 puan). */
export const LEDGER_FLAT_BAND = STORY_FLAT_BAND;

/** Cümlenin çapası — bültenin de en çok andığı endeks. */
export const LEDGER_ANCHOR = "SPY";

function directionWithin(change: number): "up" | "down" | "flat" {
  return change > LEDGER_FLAT_BAND ? "up" : change < -LEDGER_FLAT_BAND ? "down" : "flat";
}

/**
 * Günün ya da haftanın cümlesi. Endeks yoksa `null` (bant zaten basılmaz).
 *
 * Günlük: dört endeks aynı yöndeyse en büyük hareketi, ayrıştıysa hangisinin
 * hangi yöne gittiğini söyler. Haftalık: çapanın haftası, kaç seansın artıda
 * kapandığı ve en sert gün.
 */
export function ledgerStory(moves: readonly LedgerMove[], period: LedgerPeriod): LedgerStory | null {
  if (moves.length === 0) return null;
  if (period === "weekly") {
    const anchor = moves.find((move) => move.symbol === LEDGER_ANCHOR) ?? moves[0];
    const trading = anchor.steps.filter((step) => step.change !== null);
    if (trading.length === 0) return null;
    let dayIndex = -1;
    let dayValue = 0;
    anchor.steps.forEach((step, index) => {
      if (step.change !== null && (dayIndex < 0 || Math.abs(step.change) > Math.abs(dayValue))) {
        dayIndex = index;
        dayValue = step.change;
      }
    });
    return {
      kind: "week",
      dir: directionWithin(anchor.change),
      symbol: anchor.symbol,
      change: anchor.change,
      sessions: trading.length,
      upDays: trading.filter((step) => (step.change ?? 0) > 0).length,
      dayIndex,
      dayChange: dayValue,
    };
  }
  const up = moves.filter((move) => directionWithin(move.change) === "up");
  const down = moves.filter((move) => directionWithin(move.change) === "down");
  const flat = moves.filter((move) => directionWithin(move.change) === "flat");
  const ALL = 4;
  if (moves.length === ALL && up.length === ALL) {
    const top = [...up].sort((a, b) => b.change - a.change)[0];
    return { kind: "allUp", symbol: top.symbol, change: top.change };
  }
  if (moves.length === ALL && down.length === ALL) {
    const top = [...down].sort((a, b) => a.change - b.change)[0];
    return { kind: "allDown", symbol: top.symbol, change: top.change };
  }
  return {
    kind: "mixed",
    up: up.map((move) => move.symbol),
    down: down.map((move) => move.symbol),
    flat: flat.map((move) => move.symbol),
  };
}

export type LedgerStoryLabels = {
  allUp: string;
  allDown: string;
  someUp: string;
  someDown: string;
  flat: string;
  split: string;
  splitFlat: string;
  upFlat: string;
  downFlat: string;
  weekUp: string;
  weekDown: string;
  weekFlat: string;
};

export type LedgerStoryFormat = {
  name: (symbol: string) => string;
  /** İşaretli yüzde: "−%0,52". */
  signed: (value: number) => string;
  /** İşaretsiz yüzde: "%1,97". */
  plain: (value: number) => string;
  list: (items: string[]) => string;
  /** Haftanın günü, cümle içi ("Perşembe"). */
  dayName: (index: number) => string;
};

/** Şablonu doldurur. Cümle Türkçede de İngilizcede de tek cümle. */
export function ledgerStoryText(story: LedgerStory, labels: LedgerStoryLabels, f: LedgerStoryFormat): string {
  if (story.kind === "allUp" || story.kind === "allDown") {
    return labels[story.kind].replace("{name}", f.name(story.symbol)).replace("{pct}", f.signed(story.change));
  }
  if (story.kind === "week") {
    const template = story.dir === "up" ? labels.weekUp : story.dir === "down" ? labels.weekDown : labels.weekFlat;
    return template
      .replace("{name}", f.name(story.symbol))
      .replace("{pct}", f.plain(story.change))
      .replace("{sessions}", String(story.sessions))
      .replace("{upDays}", String(story.upDays))
      .replace("{day}", f.dayName(story.dayIndex))
      .replace("{dayPct}", f.signed(story.dayChange));
  }
  if (story.kind !== "mixed") return "";
  const names = (symbols: string[]) => f.list(symbols.map(f.name));
  const { up, down, flat } = story;
  if (up.length && down.length && flat.length) {
    return labels.splitFlat.replace("{up}", names(up)).replace("{down}", names(down)).replace("{flat}", names(flat));
  }
  if (up.length && down.length) return labels.split.replace("{up}", names(up)).replace("{down}", names(down));
  if (up.length && flat.length) return labels.upFlat.replace("{up}", names(up)).replace("{flat}", names(flat));
  if (down.length && flat.length) return labels.downFlat.replace("{down}", names(down)).replace("{flat}", names(flat));
  if (up.length) return labels.someUp.replace("{list}", names(up));
  if (down.length) return labels.someDown.replace("{list}", names(down));
  return labels.flat.replace("{list}", names(flat));
}

/* --------------------------------------------------------------------------
   Bültende geçen hisseler
   -------------------------------------------------------------------------- */

export type MentionCandidate = { symbol: string; name: string };

export type StockMention = {
  symbol: string;
  /** Metinde geçtiği biçim ("American Express", "AMD") — bağ için. */
  alias: string;
  /** İlk geçişin metindeki yeri; şerit bu sırayla. */
  at: number;
};

/** Şeritte en çok bu kadar hisse — bir bakışta okunacak kadar. */
export const MAX_LEDGER_STOCKS = 8;

/**
 * Çıplak büyük harfle yazıldığında sembol SAYILMAYAN kısaltmalar.
 * `PAREN_STOPLIST` (lib/autolink.ts) üstüne bültende sık geçenler: saat
 * dilimi (ET), petrol (WTI), veri adları (PCE, PMI), kurumlar (CME, LSEG,
 * MSCI). Bunların bir kısmı gerçek bir sembolün de adı ("ET" Energy
 * Transfer, "PRO" PROS); bülten metninde öyle kastedilmiyor.
 *
 * SÖZCÜK OLAN SEMBOLLER (25 Ekim son düzeltme). Üye listesinde üç harften
 * uzun 70'i aşkın sembol bir İngilizce sözcük (KEY KeyCorp, LOW Lowe's,
 * COST Costco, MET MetLife, HAS Hasbro, CAT Caterpillar, WELL Welltower,
 * TECH Bio-Techne, FAST Fastenal, BEN Franklin Resources…). Ara başlıkta ya
 * da vurguda büyük harfle yazılan "KEY", "LOW", "FAST" bir hisse değil;
 * kısaltma olarak geçenler de öyle (ICE ABD göçmenlik dairesi, PEG oranı,
 * COP iklim zirvesi, DOW endeksin büyük harfli yazımı, RTX Nvidia'nın ekran
 * kartı serisi: 30 bültenlik taramada "RTX PRO 5500" RTX Corp'a gidiyordu).
 * Bu şirketler `$KEY`, `(KEY)` ya da adlarıyla tanınır.
 */
const BARE_STOPLIST: ReadonlySet<string> = new Set([
  "ET", "UTC", "WTI", "PCE", "PMI", "CME", "LSEG", "MSCI", "DRAM", "TSMC",
  "PRO", "NYSE", "OPEC", "IEA", "EIA", "BLS", "NFIB", "ADP", "JOLTS", "SIP",
  "KEY", "LOW", "COST", "MET", "HAS", "CAT", "WELL", "TECH", "FAST", "BEN",
  "ICE", "PEG", "COP", "DOW", "RTX", "CMS", "DOC", "FIX", "DASH", "ECHO",
  "AMP", "GEN", "TAP", "HUM", "COIN", "HOOD", "SHOP", "BALL", "FLEX", "LITE",
  "MAR", "ESS", "BRO", "TRI", "WAT", "YUM", "KIM", "LEN", "LIN", "REG",
]);

/**
 * TEK KELİMEYLE TANINAN ADLAR — markalaşmış, gündelik dilde başka bir şey
 * olmayan şirket adları ("Apple", "Nvidia", "Microsoft", "JPMorgan").
 * `headlineMentions`in (lib/utils.ts) `BRAND_NAMES` kalıbının bülten hâli:
 * orada başlık kısa olduğu için genel sözcükler dışlanıyordu, burada uzun
 * metin yüzünden TERSİ — yalnız listede olan tek kelime yeter.
 *
 * NEDEN LİSTE (25 Ekim son düzeltme). İlk kural her adın ilk kelimesini
 * kanıt sayıyor, yalnız gündelik sözcükleri dışlıyordu. Gerçek üye
 * listesiyle "Boston Fed Başkanı Susan Collins" Boston Scientific'e,
 * "Fed Başkan Yardımcısı Philip Jefferson" Philip Morris'e, "Las Vegas'taki
 * CES" Las Vegas Sands'e, "Martin Luther King Günü" Martin Marietta'ya
 * gidiyordu; aynı risk Illinois, Cincinnati, Alexandria, Church, Henry,
 * Jack, Ralph, Raymond, Franklin, Baker, Cooper, Simon, Ross, Charter,
 * Crown, Comfort, Flex, Genuine, Packaging, Electronic, Analog, Automatic,
 * Norwegian, Citizens ve Thomson'da. Yer, kişi ve ay adı olabilen ilk
 * kelimeyi saymak yerine marka olanı saymak tutucu taraf: listede olmayan
 * ad iki kelimeyle tanınır ("Boston Scientific", "Philip Morris", "Martin
 * Marietta"), tek kelimesi kalmayan ad yalnız sembolle. Kişi adı olan
 * markalar (Abbott: Teksas valisi; Emerson, Tyson, Otis, Cummins) listede
 * yok. Büyük harfli kısaltma adları (IBM, KKR) sembol de olduğu için zaten
 * tanınıyor; listede olanlar adı sembolünden farklı olanlar.
 */
const SINGLE_WORD_BRANDS: ReadonlySet<string> = new Set([
  "agilent", "apple", "abbvie", "airbnb", "accenture", "adobe", "aflac",
  "akamai", "allstate", "allegion", "alphabet", "altria", "amazon", "amcor",
  "ameren", "ameriprise", "ametek", "amgen", "amphenol", "applovin", "aptiv",
  "assurant", "autodesk", "autozone", "avalonbay", "biogen", "blackrock",
  "blackstone", "boeing", "broadcom", "broadridge", "caterpillar", "cboe",
  "cencora", "centene", "chevron", "chipotle", "chubb", "cigna", "cintas",
  "cisco", "citigroup", "clorox", "coca-cola", "coinbase", "colgate-palmolive",
  "comcast", "conocophillips", "copart", "coreweave", "corpay", "corteva",
  "costar", "costco", "crowdstrike", "carvana", "danaher", "datadog", "davita",
  "deere", "dell", "dexcom", "doordash", "dupont", "ebay", "echostar",
  "ecolab", "elevance", "emcor", "entergy", "equifax", "equinix", "evergy",
  "eversource", "exelon", "expedia", "exxonmobil", "factset", "fastenal",
  "fedex", "ferrovial", "firstenergy", "fiserv", "fortinet", "fortive",
  "freeport-mcmoran", "garmin", "gartner", "generac", "gilead", "godaddy",
  "halliburton", "hasbro", "hershey", "hilton", "honeywell", "howmet",
  "humana", "idexx", "incyte", "intel", "intuit", "invesco", "iqvia", "jabil",
  "jpmorgan", "kenvue", "keysight", "kimberly-clark", "kroger", "l3harris",
  "labcorp", "leidos", "lennar", "lilly", "lowe's", "lululemon", "lumentum",
  "lyondellbasell", "marvell", "masco", "mastercard", "mcdonald's",
  "mckesson", "medtronic", "mercadolibre", "merck", "meta", "metlife",
  "micron", "microsoft", "moderna", "mondelez", "moody's", "nebius", "netapp",
  "netflix", "newmont", "nextera", "nike", "nisource", "nucor", "nvidia",
  "omnicom", "oneok", "oracle", "paccar", "palantir", "paychex", "paypal",
  "pentair", "pepsico", "pfizer", "prologis", "pultegroup", "qualcomm",
  "regeneron", "resmed", "revvity", "robinhood", "salesforce", "sandisk",
  "schlumberger", "seagate", "sempra", "servicenow", "sherwin-williams",
  "shopify", "skyworks", "snap-on", "spacex", "starbucks", "steris",
  "stryker", "supermicro", "synopsys", "sysco", "t-mobile", "take-two",
  "teradyne", "tesla", "textron", "transdigm", "trimble", "truist", "uber",
  "ulta", "unitedhealth", "valero", "veeva", "veralto", "verisign", "verisk",
  "verizon", "vertiv", "viatris", "vistra", "wabtec", "walmart", "welltower",
  "weyerhaeuser", "williams-sonoma", "workday", "wynn", "xcel", "xylem",
  "zoetis", "at&t", "pg&e", "bio-techne", "brown–forman",
]);

/**
 * İki kelimesi de yer adı olan çekirdekler — üçüncü kelime istenir: "Las
 * Vegas'taki CES" Las Vegas Sands değil, "Palo Alto'daki kampüs" Palo Alto
 * Networks değil, "Charles River" bir nehir.
 */
const PLACE_PHRASES: ReadonlySet<string> = new Set([
  "las vegas", "palo alto", "charles river", "new york", "san francisco", "los angeles",
]);

/** Ad çekirdeği: kurumsal son ekler ve parantezli künyeler atılmış ilk kelime(ler). */
const CORPORATE_SUFFIXES: ReadonlySet<string> = new Set([
  "co", "co.", "companies", "company", "corp", "corp.", "corporation", "group",
  "holdings", "inc", "inc.", "incorporated", "limited", "llc", "ltd", "ltd.", "plc", "the",
]);
const NAME_JOINERS: ReadonlySet<string> = new Set(["of", "&", "and"]);
/** "Arthur J. Gallagher" — ikinci kelime baş harfse bir sonraki de alınır. */
const INITIAL = /^\p{Lu}\.$/u;

/**
 * Adın metinde aranacak biçimi.
 *   - Kurumsal son ekler, parantezli künyeler ("(The)", "(Eli)") ve sonda
 *     kalan bağlaç atılır; baştaki "The" de.
 *   - İlk kelime `SINGLE_WORD_BRANDS`te ise o tek kelime ("Meta Platforms"
 *     → "Meta").
 *   - Değilse iki kelime; araya bağlaç ya da baş harf giriyorsa üç ("Bank
 *     of America", "Arthur J. Gallagher"), iki kelime yer adıysa üç ("Las
 *     Vegas Sands"). Adın o kadar kelimesi yoksa ya da ikinci kelime son
 *     ekse ("Packaging Corporation of America") ad eşleşme üretmez.
 */
export function nameCore(name: string): string | null {
  const words = name.trim().split(/\s+/).filter(Boolean).map((word) => word.replace(/,$/, ""));
  if (words[0]?.toLowerCase() === "the") words.shift();
  const strip = (word: string) =>
    CORPORATE_SUFFIXES.has(word.toLowerCase()) || NAME_JOINERS.has(word.toLowerCase()) || word.startsWith("(");
  while (words.length > 0 && strip(words.at(-1)!)) words.pop();
  const first = words[0];
  if (!first || first.length < 3) return null;
  if (SINGLE_WORD_BRANDS.has(first.toLowerCase())) return first;
  const second = words[1]?.toLowerCase() ?? "";
  if (!second || CORPORATE_SUFFIXES.has(second)) return null;
  const longer =
    NAME_JOINERS.has(second) || INITIAL.test(words[1] ?? "") || PLACE_PHRASES.has(`${first} ${second}`.toLowerCase());
  const take = longer ? 3 : 2;
  if (words.length < take) return null;
  return words.slice(0, take).join(" ");
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LETTER = "[\\p{L}\\p{M}\\p{N}]";

/**
 * Metinde adı ya da sembolü geçen hisseler, ilk geçiş sırasıyla.
 *
 * TUTUCU — yanlış logo, logosuzluktan pahalı (lib/utils.ts →
 * `headlineMentions` aynı ilkeyle):
 *   - `$NVDA` ya da "(NVDA)" her zaman (autolink kalıbı; parantezde
 *     `PAREN_STOPLIST` dışı).
 *   - Çıplak büyük harfli sembol en az ÜÇ harfse ("AMD", "IBM", "SLB");
 *     iki harfli çıplak biçim ("ET", "GE", "FE") saat dilimi, kısaltma ya da
 *     başka bir şey olabilir.
 *   - Şirket adı, büyük harfle başlayan özel ad olarak ("American Express",
 *     "T-Mobile", "AT&T", "Tesla'nın").
 */
export function findStockMentions(
  text: string,
  candidates: readonly MentionCandidate[],
  exclude: ReadonlySet<string> = new Set(),
  max = MAX_LEDGER_STOCKS,
): StockMention[] {
  type Hit = { at: number; alias: string };
  const earlier = (a: Hit | null, b: Hit | null) => (a === null ? b : b === null || a.at <= b.at ? a : b);
  const byTicker = new Map<string, Hit>();
  const byName = new Map<string, Hit & { core: string }>();
  for (const { symbol, name } of candidates) {
    if (exclude.has(symbol)) continue;
    const ticker = escapeRegExp(symbol);
    let hit: Hit | null = null;
    /* "$X" ve "(X)" tek harfliyse sembol sayılmaz — "(A)" bir madde imi. */
    const patterned = symbol.length >= 2;
    const dollar = patterned ? new RegExp(`(?<![A-Za-z0-9])\\$${ticker}(?![A-Za-z0-9])`).exec(text) : null;
    if (dollar) hit = earlier(hit, { at: dollar.index, alias: dollar[0] });
    if (patterned && !PAREN_STOPLIST.has(symbol)) {
      const paren = new RegExp(`\\(${ticker}\\)`).exec(text);
      if (paren) hit = earlier(hit, { at: paren.index + 1, alias: symbol });
    }
    if (symbol.length >= 3 && !PAREN_STOPLIST.has(symbol) && !BARE_STOPLIST.has(symbol)) {
      const bare = new RegExp(`(?<![A-Za-z0-9$&\\-])${ticker}(?![A-Za-z0-9&\\-])`).exec(text);
      if (bare) hit = earlier(hit, { at: bare.index, alias: symbol });
    }
    if (hit) byTicker.set(symbol, hit);
    const core = nameCore(name);
    if (!core) continue;
    const phrase = core.split(" ").map(escapeRegExp).join("\\s+");
    const pattern = new RegExp(`(?<!${LETTER})${phrase}(?!${LETTER})`, "giu");
    for (const match of text.matchAll(pattern)) {
      const head = match[0][0];
      /* Özel ad: ilk harf büyük ya da adın kendi yazımı ("eBay").
         "american express" küçük harfle bir şirket değil. */
      if (head !== head.toLocaleLowerCase("en-US") || match[0] === core) {
        byName.set(symbol, { at: match.index ?? 0, alias: match[0], core: core.toLowerCase() });
        break;
      }
    }
  }
  /* AYNI AD İKİ ŞİRKETİN ÇEKİRDEĞİYSE ad kanıt sayılmaz: "Honeywell" hem
     HON'un hem ayrılan HONA'nın adı (25 Ekim taraması). Hangisi olduğunu
     bilmiyoruz; yanlış logo basmaktansa ikisi de yalnız sembolle tanınır. */
  const coreCount = new Map<string, number>();
  for (const hit of byName.values()) coreCount.set(hit.core, (coreCount.get(hit.core) ?? 0) + 1);
  const found: StockMention[] = [];
  for (const symbol of new Set([...byTicker.keys(), ...byName.keys()])) {
    const named = byName.get(symbol);
    const best = earlier(byTicker.get(symbol) ?? null, named && coreCount.get(named.core) === 1 ? { at: named.at, alias: named.alias } : null);
    if (best) found.push({ symbol, alias: best.alias, at: best.at });
  }
  return found.sort((a, b) => a.at - b.at || a.symbol.localeCompare(b.symbol, "en")).slice(0, max);
}

/* --------------------------------------------------------------------------
   Metindeki geçişler ↔ bant
   -------------------------------------------------------------------------- */

/**
 * Metindeki bir geçişin banttaki karşılığı. Anahtar bantta `data-ledger-key`,
 * metinde `data-ledger-ref` olarak duruyor (components/today/LedgerLinker).
 */
export type LedgerRef = { key: string; aliases: readonly string[] };

/** Endeks fonlarının metindeki adları — uzun biçim önce. "Nasdaq bileşik"
 *  ve "Nasdaq vadelileri" Nasdaq 100 fonu değil, bağlanmıyor. */
export const INDEX_ALIASES: Readonly<Record<string, readonly string[]>> = {
  SPY: ["S&P 500", "SPY"],
  QQQ: ["Nasdaq 100", "QQQ"],
  DIA: ["Dow Jones", "Dow", "DIA"],
  IWM: ["Russell 2000", "IWM"],
};

export const METRIC_ALIASES: Readonly<Record<LedgerMetricKey, readonly string[]>> = {
  us10y: [
    "10 yıllık ABD tahvil faizi",
    "10 yıllık tahvil faizi",
    "10 yıllık faiz",
    "10 yıllık",
    "10-year Treasury yield",
    "10-year yield",
    "10-year",
  ],
  vix: ["VIX"],
  usdtry: ["dolar/TL", "Dolar/TL", "USD/TRY", "dolar/lira"],
};

export type RefPiece = string | { key: string; text: string };

/** Geçişin hemen ardındaki yüzde de bağa dahil: "SPY %0,52", "IWM 0.33%". */
const NUMBER_TAIL = /^\s?(?:[+\-−]?%\s?\d+(?:[.,]\d+)?|[+\-−]?\d+(?:[.,]\d+)?\s?%)/u;

/**
 * Düz metni bağlı ve bağsız parçalara böler. Eşleşme büyük/küçük harfe
 * duyarlı, kelime sınırlı (Türkçe kesme ekleri serbest: "Dow'u",
 * "S&P 500'ün"); aynı noktada uzun biçim kısayı yutar.
 */
export function splitLedgerRefs(text: string, refs: readonly LedgerRef[]): RefPiece[] {
  const entries = refs
    .flatMap((ref) => ref.aliases.map((alias) => ({ key: ref.key, alias })))
    .filter((entry) => entry.alias.length > 0)
    .sort((a, b) => b.alias.length - a.alias.length);
  if (entries.length === 0) return [text];
  const pattern = new RegExp(
    `(?<!${LETTER})(${entries.map((entry) => escapeRegExp(entry.alias)).join("|")})(?!${LETTER})`,
    "gu",
  );
  const keyOf = new Map(entries.map((entry) => [entry.alias, entry.key] as const));
  const pieces: RefPiece[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start < cursor) continue;
    const key = keyOf.get(match[1]);
    if (!key) continue;
    let end = start + match[0].length;
    const tail = NUMBER_TAIL.exec(text.slice(end));
    if (tail) end += tail[0].length;
    if (start > cursor) pieces.push(text.slice(cursor, start));
    pieces.push({ key, text: text.slice(start, end) });
    cursor = end;
  }
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return pieces;
}

