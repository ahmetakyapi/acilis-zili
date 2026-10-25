/**
 * ZİL RAPORU — ekranın SAF kararları (25 Ekim). Veritabanına dokunmaz;
 * `lib/report-data.ts` okur, burası okunanı ekranın diline çevirir. Ayrı
 * dosya, çünkü testler `db` modülünü yüklemeden bu kararları sınamalı
 * (tests/report-summary.test.ts).
 */

/** Rapordaki tek pozisyon satırı — vitrinin `ShowcaseMove`u ile aynı şekil. */
export type ReportMove = { symbol: string; returnPct: number };

/**
 * UÇLARIN ETİKETİ VERİDEN (25 Ekim, sahibinin bildirimi). Rapor en üstteki
 * pozisyonu "En İyi Pozisyon" diye basıyordu ve bütün pozisyonlar eksideyken
 * ekranda "En İyi Pozisyon AMD −%0,8" duruyordu: okur "iyi" ile "eksi"yi
 * yan yana görüp duraksıyordu. Etiket artık sayının işaretini söylüyor:
 * hepsi düşmüşse üstteki "En Az Düşen", hepsi yükselmişse alttaki "En Az
 * Kazandıran". İyi/kötü yargısı yok — yalnız sıra ve yön.
 */
export type ExtremeKind = "mostGain" | "leastGain" | "leastLoss" | "mostLoss" | "flat";

/**
 * Yatay sayılan eşik, yüzde puanı. Ekran getiriyi tek ondalıkla basıyor
 * (`formatPercent(…, 1)`); 0,05'in altı "%0,0" görünür ve ona "Kazandıran"
 * ya da "Düşen" demek, okurun göremediği bir farkı ilan etmek olur.
 */
export const FLAT_RETURN_PCT = 0.05;

export type Extreme = { symbol: string; returnPct: number; kind: ExtremeKind };

export function positionExtremes(moves: readonly ReportMove[]): { top: Extreme | null; bottom: Extreme | null } {
  if (moves.length === 0) return { top: null, bottom: null };
  /* Vitrin zaten büyükten küçüğe sıralıyor; burada yine sıralanıyor ki
     karar çağıranın sırasına bağlı kalmasın. */
  const sorted = [...moves].sort((a, b) => b.returnPct - a.returnPct);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const flat = (pct: number) => Math.abs(pct) < FLAT_RETURN_PCT;
  const top: Extreme = {
    ...first,
    kind: flat(first.returnPct) ? "flat" : first.returnPct > 0 ? "mostGain" : "leastLoss",
  };
  if (sorted.length < 2 || last.symbol === first.symbol) return { top, bottom: null };
  const bottom: Extreme = {
    ...last,
    kind: flat(last.returnPct) ? "flat" : last.returnPct < 0 ? "mostLoss" : "leastGain",
  };
  return { top, bottom };
}

/**
 * SPY KIYASI PUAN FARKI. İki yüzde arasındaki fark yüzde değil PUAN
 * (−%16,0 ile +%0,7 arası 16,7 puan); "yüzde 16,7 geride" demek farkı
 * oranmış gibi okuturdu.
 */
export type SpyGap = { points: number; side: "ahead" | "behind" | "level" };

export function spyGap(returnPct: number, spyReturnPct: number | null): SpyGap | null {
  if (spyReturnPct === null || !Number.isFinite(spyReturnPct) || !Number.isFinite(returnPct)) return null;
  const diff = returnPct - spyReturnPct;
  if (Math.abs(diff) < FLAT_RETURN_PCT) return { points: 0, side: "level" };
  return { points: Math.abs(diff), side: diff > 0 ? "ahead" : "behind" };
}

/**
 * MASKOTUN YÜZÜ HESABIN DURUMU. Kapaktaki zil sitenin üç kahraman
 * sahnesinden birini oynuyor ve seçim KATILIMA bakıyor, getiriye değil:
 * portföyün eksideyken zilin surat asması bir yargı olurdu (rapor yargı
 * vermiyor). Dört alan sayılıyor: takip listesi, alarm, portföy, yazı.
 *   - ikisi ve fazlası: çalıyor (`heroRing`)
 *   - biri: uyanık, bekliyor (`heroWait`)
 *   - hiçbiri: uyukluyor (`heroSleep`) — yeni hesap
 */
export type ReportMood = "heroRing" | "heroWait" | "heroSleep";

export type ActivityInput = {
  listSymbols: number;
  alertsTotal: number;
  posts: number;
  hasShowcase: boolean;
};

export function reportActivity(input: ActivityInput): number {
  return [input.listSymbols > 0, input.alertsTotal > 0, input.hasShowcase, input.posts > 0].filter(Boolean).length;
}

export function reportMood(input: ActivityInput): ReportMood {
  const active = reportActivity(input);
  return active >= 2 ? "heroRing" : active === 1 ? "heroWait" : "heroSleep";
}

/**
 * KOLON PLANI — iki kolon + gerekirse tam genişlikte bir panel (25 Ekim).
 *
 * Önceki dengeleyici (`balanceColumns`) açgözlüydü: sıradaki paneli o an
 * kısa kolona koyuyordu. 1440'ta portföy (sol) ile takip + Sıradaki (sağ) kolonlarının dipleri
 * 190 piksel ayrı bitiyordu (ölçüldü) ve üç panelle hiçbir iki kolonluk
 * dağılım bundan iyi değildi: farkı kapatan, geniş okunabilen bir paneli
 * (takip çipleri, Sıradaki adımları) kolonların ALTINA tam genişlikte
 * almak. Plan bütün seçenekleri dener (panel sayısı en çok beş, 2⁴ × 3
 * olasılık): kolon içi sıra korunur, ilk panel solda, en küçük dip farkı
 * kazanır; eşitlikte tam genişlik kullanmayan plan. Ağırlıklar tahmini
 * boy (birim ≈ 62 piksel, ölçüm BellReport.tsx'te), `gap` kolon içi
 * aralığın aynı birimdeki karşılığı.
 */
export type ColumnPlan<T> = { left: T[]; right: T[]; full: T[] };

export function planColumns<T>(
  items: readonly { item: T; weight: number; wide?: boolean }[],
  gap = 0.32,
): ColumnPlan<T> {
  if (items.length <= 1) return { left: items.map((entry) => entry.item), right: [], full: [] };
  const height = (list: readonly { weight: number }[]) =>
    list.reduce((sum, entry) => sum + entry.weight, 0) + Math.max(0, list.length - 1) * gap;
  let best: { plan: ColumnPlan<T>; diff: number; usesFull: boolean } | null = null;
  const fullOptions = [-1, ...items.flatMap((entry, index) => (entry.wide ? [index] : []))];
  for (const fullIndex of fullOptions) {
    const rest = items.filter((_, index) => index !== fullIndex);
    if (rest.length === 0) continue;
    /* Bit i: rest[i] sağda. İlk panel hep solda (ayna planlar aynı). */
    for (let mask = 0; mask < 1 << rest.length; mask += 2) {
      const left = rest.filter((_, i) => !(mask & (1 << i)));
      const right = rest.filter((_, i) => mask & (1 << i));
      /* Tam genişlik ancak altında iki dolu kolon varken anlamlı. */
      if (fullIndex >= 0 && right.length === 0) continue;
      const diff = right.length === 0 ? height(left) : Math.abs(height(left) - height(right));
      const usesFull = fullIndex >= 0;
      if (!best || diff < best.diff - 1e-9 || (Math.abs(diff - best.diff) < 1e-9 && best.usesFull && !usesFull)) {
        best = {
          plan: {
            left: left.map((entry) => entry.item),
            right: right.map((entry) => entry.item),
            full: usesFull ? [items[fullIndex].item] : [],
          },
          diff,
          usesFull,
        };
      }
    }
  }
  return best?.plan ?? { left: items.map((entry) => entry.item), right: [], full: [] };
}

/**
 * SEANS ŞERİDİ — haftalık (25 Ekim, sahibinin isteği: "sayıları yalnız
 * yazma, çiz"). "59 seans" tek başına soyut; şerit aynı sayıyı hafta hafta
 * gösteriyor: her hafta bir sütun, sütunun kulvarı o haftanın ÜYELİK İÇİNDE
 * kalan hafta içi günleri (`span`), dolgusu açılıp kapanan seanslar
 * (`sessions`). Tatil boşluk olarak görünür; ilk ve son hafta yarımsa
 * kulvarı da yarım — "o hafta az seans vardı" yanılgısı çizilmez.
 *
 * Gün sayımı tek geçişte: toplam `total` ekrandaki sayının kendisi, yani
 * şerit ile sayı aynı kaynaktan (veri dürüstlüğü 3).
 */
export type SessionWeek = { sessions: number; span: number };

/** Şeridin tavanı: bir yıl. Daha eskisi sayıya girer, şeride girmez. */
export const SESSION_WEEKS_MAX = 52;

function shiftDay(day: string, by: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + by));
  return date.toISOString().slice(0, 10);
}

function weekdayOfDay(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function sessionWeeks(
  fromDay: string,
  toDay: string,
  isTrading: (day: string) => boolean,
  maxWeeks = SESSION_WEEKS_MAX,
): { total: number; weeks: SessionWeek[] } {
  const weeks: SessionWeek[] = [];
  let total = 0;
  let current: SessionWeek | null = null;
  /* Emniyet tavanı 20 yıl (eski sayaçla aynı). */
  for (let i = 0, day = fromDay; i < 7400 && day <= toDay; i += 1, day = shiftDay(day, 1)) {
    const weekday = weekdayOfDay(day);
    if (!current || weekday === 1) {
      current = { sessions: 0, span: 0 };
      weeks.push(current);
    }
    if (weekday === 0 || weekday === 6) continue;
    current.span += 1;
    if (isTrading(day)) {
      current.sessions += 1;
      total += 1;
    }
  }
  /* Hafta sonu başlayan üyelikte ilk "hafta" boş kalabilir — atılır. */
  const filled = weeks.filter((week) => week.span > 0);
  return { total, weeks: filled.slice(-maxWeeks) };
}

/**
 * ÜYELİK AYLARI — üyelik süresinin takvim karşılığı. Her ay bir kulvar,
 * dolgusu o ayda üye olunan günlerin payı: 1 Ağustos'ta katılıp 25 Ekim'de
 * bakan okur iki dolu ve bir dörtte üçü dolu kulvar görür. Tavan bir yıl.
 */
export type MemberMonth = { month: string; share: number };

export const MEMBER_MONTHS_MAX = 12;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function memberMonths(fromDay: string, toDay: string, maxMonths = MEMBER_MONTHS_MAX): MemberMonth[] {
  if (fromDay > toDay) return [];
  const [fy, fm, fd] = fromDay.split("-").map(Number);
  const [ty, tm, td] = toDay.split("-").map(Number);
  const months: MemberMonth[] = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    const length = daysInMonth(y, m);
    const first = y === fy && m === fm ? fd : 1;
    const last = y === ty && m === tm ? td : length;
    months.push({ month: `${y}-${String(m).padStart(2, "0")}`, share: (last - first + 1) / length });
    if (months.length > 400) break;
  }
  return months.slice(-maxMonths);
}
