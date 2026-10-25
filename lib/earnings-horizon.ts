import { laneOf, type WeekLane } from "@/lib/earnings-week";

/**
 * HAFTANIN BİLANÇO UFKU — saf hesap (25 Ekim). Veri okuması ve çizim
 * `components/earnings/horizon/`; burası veritabanına ve sağlayıcıya
 * dokunmuyor, `tests/earnings-horizon.test.ts` doğrudan sınıyor.
 *
 * Üç karar burada:
 *   1. Karo ALANI piyasa değeriyle orantılı: kenar = √(değer / haftanın en
 *      büyüğü). Haftalık sekmenin üç basamaklı karosu (`tileTier`) paylaşım
 *      görselinin dar alanına göre kuruldu; ufukta yer var ve sürekli ölçek
 *      "en büyükleri nerede" sorusunu bir bakışta cevaplıyor. Taban (CSS'te
 *      dokunma hedefi) küçükleri görünür tutuyor ve künyede adıyla yazılı.
 *   2. Beklenti karnesi hisse sayfasındakiyle AYNI kural ve AYNI kaynak
 *      (`getEarningsSurprises`; `UpcomingEarnings` → `karneler`): son dört
 *      çeyrek, yalnız beklentisi ve gerçekleşeni bilinenler, gerçekleşen
 *      beklentinin üstündeyse aşılmış. Tek çeyrek karne değil (en az iki).
 *   3. Tepedeki cümle şablon + veri: en büyükler, piyasa değeri toplamı en
 *      yüksek gün × pencere hücresinden.
 */

/** Karnede en çok bu kadar çeyrek — hisse sayfasının kartıyla aynı. */
export const KARNE_QUARTERS = 4;
/** Bundan az eşli çeyrekte karne basılmaz (hisse sayfasının kuralı). */
export const KARNE_MIN = 2;
/** Cümlede adı geçen en fazla şirket. */
export const LEAD_SYMBOLS = 3;

export type KarneMark = "beat" | "miss";

/**
 * Son dört eşli çeyrek, ESKİDEN YENİYE (soldan sağa okuma zamanla aynı).
 * Dönem "YYYY-MM-DD" dizesi; sıralama dizeyle.
 */
export function karneMarks(
  rows: readonly { period: string; epsActual: number | null; epsEstimate: number | null }[],
): KarneMark[] {
  const paired = rows
    .filter((row) => row.epsActual !== null && row.epsEstimate !== null)
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, KARNE_QUARTERS)
    .map((row): KarneMark => (row.epsActual! > row.epsEstimate! ? "beat" : "miss"));
  return paired.length >= KARNE_MIN ? paired.reverse() : [];
}

/** Karonun kenar oranı (0…1): alan piyasa değeriyle orantılı. */
export function tileScale(marketCap: number | null, weekMax: number): number {
  if (marketCap === null || !(marketCap > 0) || !(weekMax > 0)) return 0;
  return Math.sqrt(Math.min(1, marketCap / weekMax));
}

/* --------------------------------------------------------------------------
   Kompakt ufuk (25 Ekim, ikinci tur — sahibinin isteği: "hepsi tek
   seferde görüntülensin")
   -------------------------------------------------------------------------- */

/**
 * BÜYÜK KARO (ilk tur: iki boy, 56 / 40 piksel). Sürekli ölçekte en büyük
 * karo 96 pikseldi ve Çarşamba kapanış sonrası hücresi tek başına 1280×800
 * ekranın yarısını tutuyordu; iki satır beş gün ilk ekrana sığmıyordu.
 * Büyük boy, kenar oranı yarıyı geçenler: alanı haftanın en büyüğünün
 * dörtte birinden fazla olanlar. Kart turunda (aşağıda) boy tekleşti:
 * büyük şirket artık karonun ÇERÇEVESİYLE ve hücrenin başında duruyor
 * (sıra zaten büyükten küçüğe); kesin değer okuma satırında.
 */
export const BIG_TILE_SCALE = 0.5;

export type TileTier = "big" | "base";

export function tileTierOf(scale: number): TileTier {
  return scale >= BIG_TILE_SCALE ? "big" : "base";
}

/**
 * Bir hücrede en çok bu kadar YUVA (karo + "+N" çipi).
 *
 * KART TURU (25 Ekim, üçüncü tur — sahibinin isteği: "logolar, kartlar
 * kompakt; bazı yerler çok uzun kalmış"). Karolar artık TEK BOY (38
 * piksel) ve hücre dört sütunlu bir ızgara: geniş ekranda gün sütunu
 * ~190 piksel, dört karo yan yana sığıyor, yani sekiz yuva İKİ SIRA.
 * Eskiden iki boy karo (56 / 40) satırı dağıtıyordu: altı yuva bazen üç
 * karoda sarıyor, büyük karonun yanında boşluk kalıyordu. Telefonda
 * pencereler alt alta ve tam genişlik, sekiz yuva yine en çok iki sıra.
 */
export const CELL_MAX_SLOTS = 8;

/**
 * "Saati Belirsiz" satırı TEK SIRA ve küçük karo (logo + sembol yan yana):
 * çoğu hafta beş günün birinde bir-iki şirket taşıyor; tam yükseklikte bir
 * satır boş dört hücreyi uzatıyordu (ölçüldü: 68 piksel).
 */
export const OTHER_MAX_SLOTS = 2;

/** Pencereye göre yuva tavanı. */
export function laneSlots(lane: WeekLane): number {
  return lane === "other" ? OTHER_MAX_SLOTS : CELL_MAX_SLOTS;
}

/**
 * Karonun altındaki dört kare, ESKİDEN YENİYE. Eşli çeyrek dörtten azsa
 * eksik olanlar BAŞTA "veri yok" (en eski çeyrekler bilinmiyor); karne hiç
 * yoksa dördü de "veri yok". Kare sayısı her karoda aynı ki satır hizası
 * bozulmasın ve "boş kare = aşılmadı" ile "soluk kare = bilinmiyor" ayrı
 * okunsun.
 */
export type KarneSlot = KarneMark | "none";

export function karneSlots(marks: readonly KarneMark[]): KarneSlot[] {
  const tail = marks.slice(-KARNE_QUARTERS);
  return [...Array<KarneSlot>(KARNE_QUARTERS - tail.length).fill("none"), ...tail];
}

/**
 * Haftanın zirvesi: TÜM açıklayanların (yalnız karolar değil) en kalabalık
 * iş günü. Eşitlikte takvimde önce gelen; kapalı ya da boş haftada yok.
 * Gün başlığındaki "Zirve" rozeti bu güne basılıyor, yoğunluk çizgisi de
 * o günde tam.
 */
export function peakDay(days: readonly { date: string; total: number }[]): string | null {
  let best: { date: string; total: number } | null = null;
  for (const day of days) {
    if (day.total > 0 && (!best || day.total > best.total || (day.total === best.total && day.date < best.date))) best = day;
  }
  return best?.date ?? null;
}

/**
 * Hücreye sığan karolar ve sığmayanların sayısı. Karolar zaten büyükten
 * küçüğe sıralı (`buildWeek`), kesilen kuyruk en küçükler. Sığmıyorsa son
 * yuva "+N" çipine kalır; çip o günün tam listesine bağlanıyor.
 */
export function capCell<T>(tiles: readonly T[], max: number = CELL_MAX_SLOTS): { shown: T[]; more: number } {
  if (max < 1) return { shown: [], more: tiles.length };
  if (tiles.length <= max) return { shown: [...tiles], more: 0 };
  const keep = max - 1;
  return { shown: tiles.slice(0, keep), more: tiles.length - keep };
}

export type PeakCell = { date: string; lane: WeekLane; symbols: string[] };

/**
 * Piyasa değeri toplamı en yüksek gün × pencere hücresi ve oradaki en
 * büyükler (büyükten küçüğe). Piyasa değeri bilinmeyen satır toplama
 * girmez; hiçbiri bilinmiyorsa hücre yok. Eşitlikte takvimde önce gelen.
 */
export function peakCell(
  rows: readonly { symbol: string; reportDate: string; hour: string | null; marketCap: number | null }[],
  max: number = LEAD_SYMBOLS,
): PeakCell | null {
  const cells = new Map<string, { date: string; lane: WeekLane; sum: number; rows: typeof rows[number][] }>();
  for (const row of rows) {
    if (row.marketCap === null || !(row.marketCap > 0)) continue;
    const lane = laneOf(row.hour);
    const key = `${row.reportDate}:${lane}`;
    const cell = cells.get(key) ?? { date: row.reportDate, lane, sum: 0, rows: [] };
    cell.sum += row.marketCap;
    cell.rows.push(row);
    cells.set(key, cell);
  }
  const LANE_ORDER: Record<WeekLane, number> = { bmo: 0, amc: 1, other: 2 };
  const best = [...cells.values()].sort(
    (a, b) => b.sum - a.sum || a.date.localeCompare(b.date) || LANE_ORDER[a.lane] - LANE_ORDER[b.lane],
  )[0];
  if (!best) return null;
  return {
    date: best.date,
    lane: best.lane,
    symbols: [...best.rows]
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0) || a.symbol.localeCompare(b.symbol))
      .slice(0, max)
      .map((row) => row.symbol),
  };
}

export type LeadWords = {
  leadThis: string;
  leadNext: string;
  peakMany: string;
  peakOne: string;
  windowBmo: string;
  windowAmc: string;
  windowOther: string;
};

/**
 * Tepedeki tek cümle. "Bu hafta 963 şirket bilanço açıklıyor; en büyükleri
 * Çarşamba kapanış sonrası: MSFT, GOOGL ve META." Hafta henüz başlamadıysa
 * (hafta sonu, sekme gelecek haftayı gösteriyor) "Önümüzdeki hafta".
 * Sayı haftanın TÜM açıklayanları (ikinci hisse sınıfı hariç) — karolar
 * yalnız kayda değer olanlar, künye bunu ayrıca söylüyor.
 */
export function horizonLead({
  count,
  upcoming,
  peak,
  weekday,
  words,
  listFormat,
  formatCount,
}: {
  count: number;
  /** Hafta bugünden sonra mı başlıyor. */
  upcoming: boolean;
  peak: PeakCell | null;
  /** Zirve hücresinin gün adı ("Çarşamba"). */
  weekday: string | null;
  words: LeadWords;
  listFormat: (items: string[]) => string;
  formatCount: (value: number) => string;
}): string {
  const head = (upcoming ? words.leadNext : words.leadThis).replace("{count}", formatCount(count));
  if (!peak || !weekday || peak.symbols.length === 0) return `${head}.`;
  const window =
    peak.lane === "bmo" ? words.windowBmo : peak.lane === "amc" ? words.windowAmc : words.windowOther;
  const tail = (peak.symbols.length === 1 ? words.peakOne : words.peakMany)
    .replace("{day}", weekday)
    .replace("{window}", window)
    .replace("{symbols}", listFormat(peak.symbols));
  return `${head}${tail}`;
}

/* --------------------------------------------------------------------------
   Karne turu: kota korumalı toplama (25 Ekim, sunucu incelemesi)
   -------------------------------------------------------------------------- */

/** Aynı anda en çok bu kadar sağlayıcı çağrısı (Finnhub ücretsiz katmanı
    saniyede 30, dakikada 60; tur 30 sembole kadar çıkıyor). */
export const KARNE_CONCURRENCY = 4;

/** Bir sembolün tek turdaki sonucu: karne, "geçmiş yok" (kesin boş) ya da
    tekrar denenmesi gereken hata. `limited` yalnız 429. */
export type KarneFetch =
  | { kind: "ok"; marks: KarneMark[] }
  | { kind: "retry"; limited: boolean };

export type KarneRound = {
  marks: Record<string, KarneMark[]>;
  /** Her sembol kesin sonuçla döndü mü; yalnız tam tur önbelleğe girer. */
  complete: boolean;
  /** Turda 429 görüldü mü (çağıran soğuma başlatır). */
  limited: boolean;
  /** Sağlayıcıya giden çağrı sayısı (ölçüm ve test için). */
  calls: number;
};

/**
 * Sembolleri `concurrency` işçiyle sırayla çağırır. 429 görülünce tur
 * KESİLİR: işçiler sıradaki sembole geçmez, kalan karolar bu turda karnesiz
 * kalır ve yeni istek gitmez (hızı sınırlanmış anahtara 30 istek daha atmak
 * kotayı yalnız uzatıyor, sitenin öbür Finnhub panelleri de aynı anahtarda).
 * Hata alan sembol `[]` döner ama tur eksik sayılır.
 */
export async function runKarneRound(
  symbols: readonly string[],
  fetchOne: (symbol: string) => Promise<KarneFetch>,
  concurrency: number = KARNE_CONCURRENCY,
): Promise<KarneRound> {
  const marks: Record<string, KarneMark[]> = {};
  let next = 0;
  let calls = 0;
  let complete = true;
  let limited = false;

  async function worker(): Promise<void> {
    while (!limited && next < symbols.length) {
      const symbol = symbols[next++];
      calls += 1;
      let result: KarneFetch;
      try {
        result = await fetchOne(symbol);
      } catch {
        result = { kind: "retry", limited: false };
      }
      if (result.kind === "ok") {
        marks[symbol] = result.marks;
      } else {
        marks[symbol] = [];
        complete = false;
        if (result.limited) limited = true;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, symbols.length)) }, worker));
  for (const symbol of symbols) {
    if (!(symbol in marks)) {
      marks[symbol] = [];
      complete = false;
    }
  }
  return { marks, complete, limited, calls };
}
