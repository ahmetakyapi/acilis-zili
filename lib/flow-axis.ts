import { AFTER_HOURS_MINUTES, SESSION_BOUNDS } from "./market-hours";

/**
 * GÜNÜN EKSENİ — "Bugünün Akışı" zaman çizelgesinin saf hesapları
 * (14 Kasım 2026; çizen bileşen `components/today/flow/FlowAxis.tsx`,
 * testi `tests/flow-axis.test.ts`).
 *
 * Eksen ET dakikasıyla kurulur (olayların `timeEt`i ET), etiketler okurun
 * saatiyle yazılır (`clockOf(dakika + offsets.primary)`, lib/session-clock).
 * Sabit saat YOK: sınırlar `SESSION_BOUNDS`tan, kapanış günün kendi
 * kapanışından (yarım günde 13:00), akşam seansı kapanış + dört saat
 * (`AFTER_HOURS_MINUTES`) — kahramandaki `SessionRail` ile aynı eksen.
 *
 * Düz modül: istemci bileşeni ve testler aynı fonksiyonları okur.
 */

export type AxisBandKey = "pre" | "regular" | "after";

export type AxisDomain = {
  /** Eksenin iki ucu, ET dakikası (ön seansın başı, akşam seansının sonu). */
  start: number;
  end: number;
  /** Açılış ve kapanış zili, ET dakikası. */
  open: number;
  close: number;
  /** İşlem günü değilse bant çizilmez: eksen yalnız saat cetvelidir. */
  trading: boolean;
};

export function axisDomain(closeMinutes: number, tradingDay: boolean): AxisDomain {
  const close = tradingDay ? closeMinutes : SESSION_BOUNDS.regularClose;
  return {
    start: SESSION_BOUNDS.preMarketOpen,
    end: close + AFTER_HOURS_MINUTES,
    open: SESSION_BOUNDS.regularOpen,
    close,
    trading: tradingDay,
  };
}

/** "HH:mm" → gün içi dakika. */
export function minutesOfClock(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Dakikanın eksendeki payı, 0–1. Eksenin dışı uca yapışır (02:00 verisi
    ön seansın başında, 21:00 konuşması akşam seansının sonunda durur). */
export function axisShare(minutes: number, domain: AxisDomain): number {
  const span = domain.end - domain.start;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (minutes - domain.start) / span));
}

/** Dakika hangi bantta. Sınır dakikası başlayan bandındır: 09:30 seans,
    kapanış dakikası akşam seansı (kapanış sonrası bilançonun penceresi). */
export function bandOf(minutes: number, domain: AxisDomain): AxisBandKey {
  if (minutes < domain.open) return "pre";
  if (minutes < domain.close) return "regular";
  return "after";
}

export type AxisBand = { key: AxisBandKey; from: number; to: number; fromMinutes: number; toMinutes: number };

/** Üç bant, pay olarak. İşlem günü değilse boş: çizecek seans yok. */
export function axisBands(domain: AxisDomain): AxisBand[] {
  if (!domain.trading) return [];
  const edges: [AxisBandKey, number, number][] = [
    ["pre", domain.start, domain.open],
    ["regular", domain.open, domain.close],
    ["after", domain.close, domain.end],
  ];
  return edges.map(([key, a, b]) => ({ key, from: axisShare(a, domain), to: axisShare(b, domain), fromMinutes: a, toMinutes: b }));
}

/** Tam saat çentikleri (uçlar hariç); dört saatte biri uzun. ET ile TR
    farkı tam saat olduğu için çentik okurun saatinde de tam saate düşer. */
export function axisHours(domain: AxisDomain): { at: number; major: boolean }[] {
  const out: { at: number; major: boolean }[] = [];
  for (let m = Math.ceil(domain.start / 60) * 60; m <= domain.end; m += 60) {
    if (m === domain.start || m === domain.end) continue;
    out.push({ at: axisShare(m, domain), major: ((m - domain.start) / 60) % 4 === 0 });
  }
  return out;
}

/**
 * LOGONUN BOYU PİYASA DEĞERİNDEN — üç kademe (14 Kasım 2026, ikinci tur).
 * Bilanço bayrağının imi şirketin logosu; bütün logolar aynı boydaydı ve
 * 4 trilyonluk şirket ile takip listesinden gelen 8 milyarlık şirket eksende
 * aynı ağırlıkta duruyordu. Sürekli ölçek DEĞİL: piyasa değerleri üç büyüklük
 * mertebesine yayılıyor, orantılı boy ya okunmaz küçük ya da satırı taşıran
 * bir logo verirdi; üç kademe bir bakışta ayrılır. Alt eşik akışa girme
 * eşiğinin kendisi (`DAY_FLOW_EARNINGS_MIN_CAP`, 50 milyar $: altındaki
 * şirket akışta yalnız takip, analiz ya da adla seçildiği için durur), üst
 * eşik 500 milyar $ (dev şirket). Değeri bilinmeyen en küçük kademede: boy
 * bilinmeyen bir büyüklüğü iddia etmez.
 */
export type CapTier = "sm" | "md" | "lg";
export const CAP_TIER_MIN = { md: 50e9, lg: 500e9 } as const;

export function capTier(marketCap: number | null | undefined): CapTier {
  if (typeof marketCap !== "number" || !Number.isFinite(marketCap)) return "sm";
  return marketCap >= CAP_TIER_MIN.lg ? "lg" : marketCap >= CAP_TIER_MIN.md ? "md" : "sm";
}

/** Çok şirketli pencerede imde duran şirket: piyasa değeri en büyük olan.
    Eşitlikte ve hiçbirinin değeri bilinmiyorsa listede ilk gelen (liste
    sunucuda takip edilen önce, sonra büyükten küçüğe sıralı). */
export function leadMember<T extends { marketCap?: number | null }>(members: readonly T[]): T | null {
  let lead: T | null = null;
  for (const member of members) {
    if (lead === null || (member.marketCap ?? -1) > (lead.marketCap ?? -1)) lead = member;
  }
  return lead;
}

export type FlagInput = { id: string; minutes: number | null };

export type PlacedFlag = {
  id: string;
  /** Direğin eksendeki yeri, 0–1. */
  at: number;
  /** Bayrağın katı; 0 eksene en yakın. */
  row: number;
  /** Sağ uca sığmayan bayrak direğin SOLUNA açılır. */
  flip: boolean;
  band: AxisBandKey;
  /** Aynı direkteki (aynı dakikadaki) bayrak sayısı ve bu bayrağın sırası
      (0 en üstteki, listede ilk gelen). */
  clusterSize: number;
  clusterIndex: number;
  /** Bayrağın uzayabileceği en büyük en (pay): sağındaki ilk engele kadar.
      Engel, bu kata kadar yükselen bir direk ya da aynı kattaki bayraktır.
      Başlık sığıyorsa kırpılmaz; sola açılan bayrak soluna doğru uzar. */
  room: number;
};

export type FlagLayout = {
  placed: PlacedFlag[];
  /** Saati bilinmeyen olaylar: eksende yerleri yok, ayrı tepside durur. */
  loose: string[];
  /** Kullanılan kat sayısı (boş eksende 0). */
  rows: number;
};

const EPS = 1e-9;

/**
 * BAYRAKLARIN YERİ — basamaklı yerleşim.
 *
 * Her olay saatinde dikilen bir direk ve direğe asılı, sağa açılan sabit
 * genişlikte bir bayraktır (`flagShare`: eksenin payı; genişlik zamanla
 * ölçüldüğü için yerleşim ekran eninden bağımsızdır ve sunucu son kareyi
 * basar, istemcide ölçüp yeniden dizme yok).
 *
 * Kural: bir bayrağın altından başka bir direk GEÇMEZ. Olaylar sondan başa
 * yerleşir; her bayrak, kendi açıklığına düşen daha geç direklerin
 * hepsinden bir kat yukarı çıkar. Sonuç soldan sağa inen bir basamak:
 * yoğun sabah (15:00, 15:30 ×3, 16:45, 17:00) okunur bir merdiven olur,
 * aynı dakikadaki olaylar aynı direkte üst üste KÜMELENİR (listede ilk gelen
 * en üstte). En alt kata sıkıştırmak (açgözlü) daha az kat harcıyordu ama
 * üst kattaki bayrağın direği alttaki bayrağın içinden geçiyordu (ön
 * taslakta ölçüldü: on iki olaylı günde yedi kesişme).
 *
 * Sağ uca sığmayan bayrak (direk + genişlik > 1) sola açılır. Karşı karşıya
 * bakan iki bayrak (biri sağa, biri sola açılan, aralarında bir genişlikten
 * az) kat değiştirerek çözülemez: orada direk bayrağın arkasında kalır
 * (akşam seansının son iki saatinde iki olay; ender).
 *
 * SOLA AÇILANLAR AYNA BASAMAK KURAR, SAĞA AÇILANLARIN ÜSTÜNDE (14 Kasım
 * 2026, ikinci tur). Sola açılan bayraklar da sondan başa yerleşiyordu:
 * akşam seansının son iki saatine üç olay yığılınca (TR 02:30, 03:00, 03:30)
 * en geç olan en alt kata iniyor, solundaki iki direk ve kapanış sonrası
 * bilançosunun direği onun katından geçiyordu. `room` o direklerde kesildiği
 * için bayrak taban eninde kalıyor, başlık kırpılıyordu ("Fed Üyesi …";
 * 1440'ta bayrak 176, 1024'te 130 piksel). Sola açılan bayrakta kural tersine
 * işler: bayrak direğin SOLUNA uzandığı için altından geçebilecek direkler
 * DAHA ERKEN olanlardır. O yüzden:
 *  1. önce sağa açılanlar yerleşir (sondan başa, yukarıdaki kural);
 *  2. sonra sola açılanlar BAŞTAN SONA yerleşir ve sağa açılan komşunun
 *     üstünde, soldan sağa YÜKSELEN bir basamak kurar: her birinin solunda
 *     kalan direkler kendi katının altında biter, bayrak engelsiz uzar.
 * Aynı dakikadaki küme yine listede ilk gelen en üstte. Kat sayısı değişmez
 * (üçlü + kapanış bilançosu: 4 → 4).
 */
export function layoutFlags(items: FlagInput[], domain: AxisDomain, flagShare: number): FlagLayout {
  const loose = items.filter((item) => item.minutes === null).map((item) => item.id);
  const timed = items.filter((item): item is { id: string; minutes: number } => item.minutes !== null);
  const sizes = new Map<number, number>();
  for (const item of timed) sizes.set(item.minutes, (sizes.get(item.minutes) ?? 0) + 1);
  const seen = new Map<number, number>();
  type Box = PlacedFlag & { lo: number; hi: number; minutes: number };
  const boxes: Box[] = timed.map((item) => {
    const at = axisShare(item.minutes, domain);
    const flip = at + flagShare > 1 + EPS;
    const index = seen.get(item.minutes) ?? 0;
    seen.set(item.minutes, index + 1);
    return {
      id: item.id, at, row: 0, flip, band: bandOf(item.minutes, domain),
      clusterSize: sizes.get(item.minutes) ?? 1, clusterIndex: index, room: flagShare,
      lo: flip ? at - flagShare : at, hi: flip ? at : at + flagShare, minutes: item.minutes,
    };
  });
  const done: Box[] = [];
  /* Yerleşim sırası: önce sağa açılanlar sondan başa, sonra sola açılanlar
     erkenden geçe (aynı dakikada listede son gelen önce: küme sırası
     korunur). Sola açılan, sağa açılan komşunun üstüne çıkar. */
  const flipped = boxes.map((box, index) => ({ box, index })).filter(({ box }) => box.flip)
    .sort((a, b) => a.box.minutes - b.box.minutes || b.index - a.index).map(({ box }) => box);
  const order = [...boxes.filter((box) => !box.flip).reverse(), ...flipped];
  for (const box of order) {
    let row = 0;
    for (let guard = 0; guard < 200; guard++) {
      const clash = done.find((other) =>
        /* aynı katta üst üste binen bayrak */
        (other.row === row && other.lo < box.hi - EPS && box.lo < other.hi - EPS) ||
        /* bu bayrağın açıklığından geçen, daha yukarı (ya da aynı kata) uzanan direk */
        (other.row >= row && Math.abs(other.at - box.at) > EPS && other.at > box.lo + EPS && other.at < box.hi - EPS));
      if (!clash) break;
      row = clash.row + 1;
    }
    box.row = row;
    done.push(box);
  }
  /* Boş yer: bayrağın açıldığı yöndeki ilk engel. Direk, kümesinin en üst
     katına kadar bütün katları keser; aynı kattaki komşu bayrak en az kendi
     eni kadar yer tutar. Önce sola açılanlar (sağa açılan komşunun en dar
     hâline kadar), sonra sağa açılanlar (sola açılanın genişlemiş kenarına
     kadar): iki yön birbirinin payına girmez. */
  for (const box of boxes) {
    if (!box.flip) continue;
    let limit = 0;
    for (const other of boxes) {
      if (other === box || other.row < box.row || other.at > box.at - EPS) continue;
      const edge = other.row === box.row ? (other.flip ? other.at : other.at + flagShare) : other.at;
      if (edge > limit) limit = edge;
    }
    box.room = Math.max(flagShare, box.at - limit);
    box.lo = box.at - box.room;
  }
  for (const box of boxes) {
    if (box.flip) continue;
    let limit = 1;
    for (const other of boxes) {
      if (other === box || other.row < box.row) continue;
      const edge = other.flip && other.row === box.row ? other.lo : other.at;
      if (edge > box.at + EPS && edge < limit) limit = edge;
    }
    box.room = Math.max(flagShare, limit - box.at);
  }
  const placed = boxes.map((box) => ({ id: box.id, at: box.at, row: box.row, flip: box.flip, band: box.band, clusterSize: box.clusterSize, clusterIndex: box.clusterIndex, room: box.room }));
  return { placed, loose, rows: placed.reduce((max, flag) => Math.max(max, flag.row + 1), 0) };
}

export type LeadEvent = {
  id: string;
  /** Olayın planlanan anı (UTC ISO); saati bilinmeyende `null`. */
  scheduledAt: string | null;
  /** `displayFlowStatus` çıktısı. */
  state: "scheduled" | "awaiting" | "live" | "held" | "released" | "analyzed" | "partial";
};

export type FlowLead =
  /** Sıradaki olay ve ona kalan tam dakika (en az 1). */
  | { kind: "next"; id: string; minutes: number }
  /** Sıradaki yok ama süren bir toplantı var. */
  | { kind: "live"; id: string }
  /** Saati geçti, sonucu bekleniyor (en son bekleyen). */
  | { kind: "awaiting"; id: string }
  /** Bugünün bütün olayları sonuçlandı. */
  | { kind: "done" }
  /** Başka gün: gelecekte ilk olay, geçmişte gün özeti. */
  | { kind: "first"; id: string }
  | { kind: "past" }
  | { kind: "empty" };

/**
 * ÇİZELGENİN BAŞLIK CÜMLESİ — "şimdi ne olacak".
 * Öncelik: sıradaki olay (kalan süresiyle) → süren toplantı → sonucu
 * beklenen → gün tamam. Saatin geçmesi sonucun geldiği anlamına gelmez
 * (`displayFlowStatus`); o yüzden "bekleniyor" ayrı bir cevaptır.
 */
export function flowLead(events: LeadEvent[], nowMs: number, day: "today" | "past" | "future"): FlowLead {
  if (!events.length) return { kind: "empty" };
  if (day === "past") return { kind: "past" };
  const timed = events.filter((event) => event.scheduledAt !== null);
  if (day === "future") return timed[0] ? { kind: "first", id: timed[0].id } : { kind: "first", id: events[0]!.id };
  const upcoming = timed
    .map((event) => ({ id: event.id, at: Date.parse(event.scheduledAt!) }))
    .filter((event) => event.at > nowMs)
    .sort((a, b) => a.at - b.at)[0];
  if (upcoming) return { kind: "next", id: upcoming.id, minutes: Math.max(1, Math.ceil((upcoming.at - nowMs) / 60_000)) };
  const live = events.find((event) => event.state === "live");
  if (live) return { kind: "live", id: live.id };
  const waiting = [...events].reverse().find((event) => event.state === "awaiting" || event.state === "partial");
  if (waiting) return { kind: "awaiting", id: waiting.id };
  /* Saati belirsiz, henüz planlı olay kaldıysa gün bitmiş sayılmaz. */
  const pending = events.find((event) => event.state === "scheduled");
  if (pending) return { kind: "awaiting", id: pending.id };
  return { kind: "done" };
}

/** Kalan süre parçaları: 100 dk → 1 sa 40 dk; 26 saat → 1 g 2 sa. Sıfır
    parça yazılmaz ("2 sa", "45 dk"). */
export function remainingParts(minutes: number): { days: number; hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  return { days, hours, minutes: days > 0 ? 0 : total % 60 };
}
