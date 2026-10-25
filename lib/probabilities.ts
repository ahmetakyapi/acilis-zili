/**
 * Olasılıklar (25 Ekim) — saf mantık: sağlayıcı fiyatından olasılığa,
 * olasılıktan faiz patikasına, veriden tepedeki cümleye.
 *
 * NE GÖSTERİYORUZ. Bir tahmin piyasasında "Evet" kontratı olay gerçekleşirse
 * 1 dolar öder; 0,63 dolardan işlem görüyorsa piyasa olaya kabaca %63
 * olasılık biçiyor demektir. Sayfa YALNIZ bu okumayı gösterir: kaynak ve
 * saatiyle, kendi tahminimiz ya da Claude'un ürettiği bir sayı olmadan.
 *
 * BAHİS DEĞİL, KAYNAK. Türkiye'de bahis siteleri yasaklı ve Kalshi ile
 * Polymarket'in alan adlarına Türkiye'den erişim engelli (ölçüldü, 25 Ekim:
 * iki alan adı da 195.175.254.2 engel sayfasına çözülüyor; Polymarket için
 * Milli Piyango İdaresi'nin 16 Temmuz 2026 tarihli kararı). Kural kodda ve
 * ekranda: sayfa hiçbir koşulda bir işlem/bahis bağlantısı, kontrat sayfası
 * adresi ya da "işlem yap" çağrısı basmaz. Kaynak ADIYLA anılır, bağlantıyla
 * değil. `tests/probabilities.test.ts` sözlükte ve bu modülde adres
 * olmadığını sınar.
 *
 * SAYILAR CLAUDE'DAN GELMEZ. Olasılıkları sağlayıcının API'si verir; model
 * web aramasıyla sayı çekerse uydurma riski var (CLAUDE.md "Veri
 * dürüstlüğü"). Tepedeki cümle şablon + veridir (`leadFacts`).
 */

/* ---- Tipler: anlık görüntü (veritabanına JSON olarak yazılan şekil) ---- */

/** Bir sonucun (kontratın) okunmuş hâli. Fiyatlar 0–1, dolar. */
export type ProbOutcome = {
  /** Sonucun dilden bağımsız anahtarı — "hold", "cut25", "dem", "yes"… */
  key: string;
  ticker: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  prevBid: number | null;
  prevAsk: number | null;
  prevLast: number | null;
  /** Açık pozisyon (kontrat adedi ≈ dolar). Likiditenin ölçüsü. */
  openInterest: number;
  volume24h: number;
  /** Piyasa sonuçlandıysa "yes"/"no"; açıksa null. */
  result: "yes" | "no" | null;
};

export type ProbHistoryPoint = {
  /** Unix saniye — günlük mumun kapanışı. */
  t: number;
  /** Sonuç anahtarı → o günün okunmuş fiyatı (0–1, normalize EDİLMEMİŞ). */
  values: Record<string, number>;
};

export type ProbEventKind = "fed" | "senate" | "house" | "recession" | "cpi";

export type ProbEvent = {
  kind: ProbEventKind;
  eventTicker: string;
  /** Olayın kararı/açıklanma anı (ISO) — Fed toplantısı, TÜFE günü. */
  strikeAt: string | null;
  /** İşlemin kapandığı an (ISO). */
  closesAt: string | null;
  outcomes: ProbOutcome[];
  /** Son 30 günün günlük okuması — kaynak vermediyse boş. */
  history: ProbHistoryPoint[];
};

export const SNAPSHOT_VERSION = 1;

export type ProbabilitySnapshot = {
  v: typeof SNAPSHOT_VERSION;
  source: "kalshi";
  /** Sağlayıcıdan okunduğu an (ISO). */
  takenAt: string;
  fed: ProbEvent[];
  congress: ProbEvent[];
  macro: ProbEvent[];
};

/* ---- Fiyattan olasılığa ---- */

/**
 * Alış-satış aralığı bu kadar dar ise ORTA fiyat kullanılır. Daha genişse
 * orta fiyat bir okuma değil, iki tarafın pazarlığıdır; son işlem fiyatı
 * (varsa) gerçekleşmiş tek sayıdır.
 */
export const MAX_MID_SPREAD = 0.1;

/** Tek kontratın fiyatından okunan ham olasılık (0–1) ya da null. */
export function priceOf(bid: number | null, ask: number | null, last: number | null): number | null {
  const hasBook = bid !== null && ask !== null && ask >= bid && ask > 0;
  if (hasBook && ask - bid <= MAX_MID_SPREAD) return clamp01((bid + ask) / 2);
  if (last !== null && last > 0) return clamp01(last);
  if (hasBook) return clamp01((bid + ask) / 2);
  return null;
}

export function currentPrice(o: ProbOutcome): number | null {
  return priceOf(o.bid, o.ask, o.last);
}

export function previousPrice(o: ProbOutcome): number | null {
  return priceOf(o.prevBid, o.prevAsk, o.prevLast);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Birbirini dışlayan sonuçların fiyatları toplamı 1 etmez (alış-satış payı,
 * yuvarlama): 0,94 + 0,06 + 0,01 + 0,01 + 0,01 = 1,03. Gösterilen olasılık
 * toplamı 1'e ölçeklenmiş hâldir; aksi hâlde yığın çubuk taşar ve
 * "sonuçlardan biri kesin olur" bilgisi kaybolur.
 */
export function normalize(values: Record<string, number | null>): Record<string, number> | null {
  const entries = Object.entries(values).filter((entry): entry is [string, number] => entry[1] !== null);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (entries.length === 0 || total <= 0) return null;
  return Object.fromEntries(entries.map(([key, value]) => [key, value / total]));
}

export function eventProbabilities(event: ProbEvent, which: "now" | "prev" = "now"): Record<string, number> | null {
  if (event.outcomes.length === 1) {
    /* Tek kontratlı ikili olay (resesyon): "Evet"in fiyatı doğrudan olasılık,
       "Hayır" tümleyeni. Normalize edilecek ikinci fiyat yok. */
    const only = event.outcomes[0];
    const price = which === "now" ? currentPrice(only) : previousPrice(only);
    return price === null ? null : { [only.key]: price, no: 1 - price };
  }
  const read = which === "now" ? currentPrice : previousPrice;
  return normalize(Object.fromEntries(event.outcomes.map((o) => [o.key, read(o)])));
}

/* ---- Likidite ---- */

/** Bu kadar açık pozisyonun altındaki olay HİÇ gösterilmez — fiyat birkaç kişinin pazarlığı. */
export const HIDE_BELOW_OPEN_INTEREST = 2_000;
/** Bu kadarın altı gösterilir ama "Az İşlem" künyesiyle. */
export const THIN_BELOW_OPEN_INTEREST = 20_000;

export type Liquidity = "liquid" | "thin" | "hidden";

export function liquidityOf(event: ProbEvent): Liquidity {
  const open = event.outcomes.reduce((sum, o) => sum + o.openInterest, 0);
  if (open < HIDE_BELOW_OPEN_INTEREST) return "hidden";
  /* En olası sonucun aralığı da bakılır: açık pozisyonu yüksek ama defteri
     boşalmış bir olayda orta fiyat okunacak bir sayı değil. */
  /* Tek kontratlı olayda bakılacak defter o kontratın kendisi ("Hayır"ın
     ayrı defteri yok; önceden "en olası sonuç" Hayır çıkınca aralık
     bulunamıyor ve derin bir piyasa "Az İşlem" sayılıyordu). */
  const probs = eventProbabilities(event);
  const lead = probs ? topOutcome(probs) : null;
  const leadOutcome =
    event.outcomes.length === 1 ? event.outcomes[0] : lead ? event.outcomes.find((o) => o.key === lead.key) : undefined;
  const spread =
    leadOutcome && leadOutcome.bid !== null && leadOutcome.ask !== null ? leadOutcome.ask - leadOutcome.bid : null;
  if (open < THIN_BELOW_OPEN_INTEREST || spread === null || spread > MAX_MID_SPREAD) return "thin";
  return "liquid";
}

export function topOutcome(probs: Record<string, number>): { key: string; p: number } | null {
  let best: { key: string; p: number } | null = null;
  for (const [key, p] of Object.entries(probs)) if (!best || p > best.p) best = { key, p };
  return best;
}

/** 24 saatlik değişim, yüzde PUANI (0,63 → 0,67 = +4). */
export function change24h(event: ProbEvent, key: string): number | null {
  const now = eventProbabilities(event, "now");
  const prev = eventProbabilities(event, "prev");
  if (!now || !prev || now[key] === undefined || prev[key] === undefined) return null;
  return Math.round((now[key] - prev[key]) * 100);
}

/**
 * Sonuçlanmış olay: kaynağın kendisi bir sonucu "evet" diye kapattıysa
 * olasılık değil SONUÇ yazılır (seçim gecesi). Fiyat 0,99'a gelse bile
 * kaynak kapatmadıysa sonuç ilan edilmez.
 */
export function resolvedOutcome(event: ProbEvent): string | null {
  if (event.outcomes.length === 1) {
    const only = event.outcomes[0];
    return only.result === "yes" ? only.key : only.result === "no" ? "no" : null;
  }
  return event.outcomes.find((o) => o.result === "yes")?.key ?? null;
}

/* ---- Fed: karar seçenekleri ve faiz patikası ---- */

/**
 * Kalshi'nin karar kontratları — sıra çubuğun soldan sağa sırası (en büyük
 * indirimden en büyük artışa). "25 baz puandan büyük" adım patikada 50
 * sayılır: kontrat büyüklüğü söylemiyor, 50 en olası büyük adım ve bu
 * varsayım künyede yazılı.
 */
export const FED_MOVES = ["cut50", "cut25", "hold", "hike25", "hike50"] as const;
export type FedMove = (typeof FED_MOVES)[number];

export const FED_MOVE_BPS: Record<FedMove, number> = {
  cut50: -50,
  cut25: -25,
  hold: 0,
  hike25: 25,
  hike50: 50,
};

/** Kalshi `custom_strike` ({"Cut": ">25"}) → sonuç anahtarı. */
export function fedMoveOf(strike: Record<string, string> | null | undefined): FedMove | null {
  if (!strike) return null;
  const [side, size] = Object.entries(strike)[0] ?? [];
  if (!side || size === undefined) return null;
  const big = size.trim().startsWith(">");
  const amount = Number(size.replace(/[^0-9.]/g, ""));
  if (side === "Hike" && amount === 0) return "hold";
  if (side === "Cut") return big ? "cut50" : amount === 25 ? "cut25" : null;
  if (side === "Hike") return big ? "hike50" : amount === 25 ? "hike25" : null;
  return null;
}

/** Üç kümeli okuma: indirim / sabit / artış (çizgi ve patika sütunu). */
export type FedSide = "cut" | "hold" | "hike";

export function fedSides(probs: Record<string, number>): Record<FedSide, number> {
  return {
    cut: (probs.cut50 ?? 0) + (probs.cut25 ?? 0),
    hold: probs.hold ?? 0,
    hike: (probs.hike25 ?? 0) + (probs.hike50 ?? 0),
  };
}

/** Toplantıda beklenen değişim, baz puan (olasılık ağırlıklı ortalama). */
export function expectedMoveBps(probs: Record<string, number>): number {
  let sum = 0;
  for (const move of FED_MOVES) sum += (probs[move] ?? 0) * FED_MOVE_BPS[move];
  return sum;
}

export type PathStep = {
  eventTicker: string;
  strikeAt: string | null;
  sides: Record<FedSide, number>;
  /** Bu toplantıdaki beklenen değişim (bp). */
  moveBps: number;
  /** Bugünden bu toplantının sonuna birikmiş beklenen değişim (bp). */
  cumulativeBps: number;
  /** Hedef aralığın orta noktasının beklenen düzeyi (%); bugünkü aralık yoksa null. */
  expectedMid: number | null;
  liquidity: Liquidity;
};

/**
 * Beklenen faiz patikası. Her toplantının olasılıkları KENDİ kontratından
 * (koşulsuz) okunuyor; beklenen düzey = bugünkü orta nokta + toplantıların
 * beklenen değişimlerinin toplamı. Beklenen değerin doğrusallığı yüzünden
 * toplantılar arası bağımlılık bu toplamı bozmaz (E[ΣΔ] = ΣE[Δ]); bozan tek
 * şey "25'ten büyük" adımın 50 sayılması, o da künyede.
 *
 * Gizlenecek kadar sığ toplantı patikayı KESER: arkasındaki toplantılar
 * onun beklenen değişimini de taşıdığı için birikim yanlış olurdu.
 */
export function ratePath(
  meetings: ProbEvent[],
  current: { lower: number; upper: number } | null,
  limit = 6,
): PathStep[] {
  const steps: PathStep[] = [];
  let cumulative = 0;
  const mid = current ? (current.lower + current.upper) / 2 : null;
  for (const meeting of sortByStrike(meetings)) {
    if (steps.length >= limit) break;
    const liquidity = liquidityOf(meeting);
    if (liquidity === "hidden") break;
    const probs = eventProbabilities(meeting);
    if (!probs) break;
    const move = expectedMoveBps(probs);
    cumulative += move;
    steps.push({
      eventTicker: meeting.eventTicker,
      strikeAt: meeting.strikeAt,
      sides: fedSides(probs),
      moveBps: move,
      cumulativeBps: cumulative,
      expectedMid: mid === null ? null : mid + cumulative / 100,
      liquidity,
    });
  }
  return steps;
}

export function sortByStrike(events: ProbEvent[]): ProbEvent[] {
  return [...events].sort((a, b) => (a.strikeAt ?? "").localeCompare(b.strikeAt ?? ""));
}

/** Henüz kararı açıklanmamış en yakın toplantı. */
export function nextMeeting(meetings: ProbEvent[], now: Date = new Date()): ProbEvent | null {
  return (
    sortByStrike(meetings).find(
      (m) => resolvedOutcome(m) === null && (!m.strikeAt || Date.parse(m.strikeAt) > now.getTime() - SETTLE_GRACE_MS),
    ) ?? null
  );
}

/** Karar saatinden sonra kontratın kapanması birkaç dakika sürüyor. */
const SETTLE_GRACE_MS = 3 * 60 * 60 * 1000;

/* ---- 30 günlük çizgi ---- */

export type LinePoint = { t: number; p: number };

/**
 * Bir sonucun (ya da sonuç kümesinin) günlük çizgisi, normalize edilmiş.
 * Fed'de kümeler (indirim = iki indirim kontratının toplamı); ikili olayda
 * tek anahtar. Eksik gün atlanır, uydurulmaz.
 */
export function historyLine(event: ProbEvent, keys: readonly string[]): LinePoint[] {
  const all = event.outcomes.map((o) => o.key);
  const line: LinePoint[] = [];
  for (const point of event.history) {
    const present = all.filter((key) => typeof point.values[key] === "number");
    if (event.outcomes.length > 1 && present.length < all.length) continue;
    const total = event.outcomes.length > 1 ? present.reduce((sum, key) => sum + point.values[key], 0) : 1;
    if (total <= 0) continue;
    const value = keys.reduce((sum, key) => sum + (point.values[key] ?? 0), 0) / total;
    line.push({ t: point.t, p: clamp01(value) });
  }
  return line;
}

/* ---- TÜFE merdiveni ---- */

export type LadderStep = { threshold: number; above: number; openInterest: number };

/**
 * "Aylık TÜFE %X'in üstünde mi" kontratları bir merdiven. Her basamak
 * BAĞIMSIZ fiyatlanıyor; alış-satış payı yüzünden komşu iki basamak
 * kimi zaman ters sırada (eşik yükselirken olasılık da yükseliyor). Ekrana
 * giden merdiven tekdüze hâle getirilir (her basamak bir öncekinden büyük
 * olamaz) — dağılımın kendisi tekdüze, ters sıra fiyatın gürültüsü.
 */
export function cpiLadder(event: ProbEvent, minOpenInterest = 5_000): LadderStep[] {
  const raw = event.outcomes
    .map((o) => ({ threshold: Number(o.key), above: currentPrice(o), openInterest: o.openInterest }))
    .filter((s): s is LadderStep => Number.isFinite(s.threshold) && s.above !== null && s.openInterest >= minOpenInterest)
    .sort((a, b) => a.threshold - b.threshold);
  let ceiling = 1;
  return raw.map((step) => {
    ceiling = Math.min(ceiling, step.above);
    return { ...step, above: ceiling };
  });
}

/**
 * Merdivenin ortancası: "üstünde" olasılığının %50'yi kestiği eşik, iki
 * basamak arasında doğrusal. Kesişme merdivenin içinde değilse null —
 * uç basamağın ötesine taşınmaz.
 */
export function ladderMedian(steps: LadderStep[]): number | null {
  for (let i = 1; i < steps.length; i++) {
    const a = steps[i - 1];
    const b = steps[i];
    if (a.above >= 0.5 && b.above < 0.5) {
      if (a.above === b.above) return a.threshold;
      return a.threshold + ((a.above - 0.5) / (a.above - b.above)) * (b.threshold - a.threshold);
    }
  }
  return null;
}

/* ---- Tepedeki cümle ---- */

/** `p` burada TAM SAYI yüzde (`percentShares`): panelin büyük sayısıyla aynı. */
export type LeadFacts = {
  fed: { move: FedMove; p: number; strikeAt: string | null } | null;
  house: { party: string; p: number } | null;
  senate: { party: string; p: number } | null;
  /** Seçim sonuçlandıysa ilgili meclisin kazananı (olasılık değil). */
  houseResult: string | null;
  senateResult: string | null;
};

export function leadFacts(snapshot: ProbabilitySnapshot, now: Date = new Date()): LeadFacts {
  const meeting = nextMeeting(snapshot.fed, now);
  const meetingProbs = meeting && liquidityOf(meeting) !== "hidden" ? eventProbabilities(meeting) : null;
  const fedTop = meetingProbs ? topOutcome(meetingProbs) : null;
  const shareOf = (probs: Record<string, number>, order: readonly string[], key: string) =>
    percentShares(order.map((k) => probs[k] ?? 0))[order.indexOf(key)];
  const chamber = (kind: "house" | "senate") => {
    const event = snapshot.congress.find((e) => e.kind === kind);
    if (!event || liquidityOf(event) === "hidden") return { lead: null, result: null };
    const result = resolvedOutcome(event);
    if (result) return { lead: null, result };
    const probs = eventProbabilities(event);
    const top = probs ? topOutcome(probs) : null;
    return { lead: top && probs ? { party: top.key, p: shareOf(probs, ["dem", "rep"], top.key) } : null, result: null };
  };
  const house = chamber("house");
  const senate = chamber("senate");
  return {
    fed:
      fedTop && meeting && meetingProbs
        ? { move: fedTop.key as FedMove, p: shareOf(meetingProbs, FED_MOVES, fedTop.key), strikeAt: meeting.strikeAt }
        : null,
    house: house.lead,
    senate: senate.lead,
    houseResult: house.result,
    senateResult: senate.result,
  };
}

export type LeadTemplates = {
  /** Yer tutucular: {date} {move} {p} */
  fed: string;
  /** İki meclis aynı partide önde: {party} {house} {senate} */
  congressSame: string;
  /** Meclisler farklı partilerde: {houseParty} {house} {senateParty} {senate} */
  congressSplit: string;
  /** Yalnız bir meclisin verisi var: {chamber} {party} {p} */
  congressOne: string;
  /** Kaynak sonuçlandırdı: {chamber} {party} */
  congressResult: string;
  /** Fed ve Kongre parçalarının arası. */
  join: string;
  /** İki sonucun arası ("; " değil "ve"). */
  joinResults: string;
};

/**
 * Cümle kuralları (testli): Fed parçası ve Kongre parçası; ikisi varsa
 * birleştirici ile tek cümle. Olasılık TAM SAYI yüzdeyle yazılır — piyasa
 * fiyatı bir kuruş adımla oynuyor, ondalık uydurma kesinlik olur.
 */
export function composeLead(
  facts: LeadFacts,
  t: LeadTemplates,
  fmt: {
    /** Tam sayı yüzde (0–100) → "%94" / "94%". */
    percent: (p: number) => string;
    date: (iso: string) => string;
    move: (move: FedMove) => string;
    /** Cümle içindeki biçim (TR'de ilgi hâli: "Demokratların"). */
    party: (key: string) => string;
    /** Yalın ad (sonuç cümlesinde özne: "Demokratlar"). */
    partyName: (key: string) => string;
    /** Meclisin cümledeki biçimi (TR'de belirtme hâli: "Senato'yu"). */
    chamber: (kind: "house" | "senate") => string;
  },
): string | null {
  const parts: string[] = [];
  if (facts.fed && facts.fed.strikeAt) {
    parts.push(
      t.fed
        .replace("{date}", fmt.date(facts.fed.strikeAt))
        .replace("{move}", fmt.move(facts.fed.move))
        .replace("{p}", fmt.percent(facts.fed.p)),
    );
  }
  if (facts.houseResult || facts.senateResult) {
    const results = (["house", "senate"] as const)
      .map((kind) => {
        const winner = kind === "house" ? facts.houseResult : facts.senateResult;
        return winner ? t.congressResult.replace("{chamber}", fmt.chamber(kind)).replace("{party}", fmt.partyName(winner)) : null;
      })
      .filter((part): part is string => part !== null);
    parts.push(results.join(t.joinResults));
  } else if (facts.house && facts.senate) {
    parts.push(
      facts.house.party === facts.senate.party
        ? t.congressSame
            .replace("{party}", fmt.party(facts.house.party))
            .replace("{house}", fmt.percent(facts.house.p))
            .replace("{senate}", fmt.percent(facts.senate.p))
        : t.congressSplit
            .replace("{houseParty}", fmt.partyName(facts.house.party))
            .replace("{house}", fmt.percent(facts.house.p))
            .replace("{senateParty}", fmt.partyName(facts.senate.party))
            .replace("{senate}", fmt.percent(facts.senate.p)),
    );
  } else {
    const one = facts.house ? { kind: "house" as const, ...facts.house } : facts.senate ? { kind: "senate" as const, ...facts.senate } : null;
    if (one) {
      parts.push(
        t.congressOne
          .replace("{chamber}", fmt.chamber(one.kind))
          .replace("{party}", fmt.party(one.party))
          .replace("{p}", fmt.percent(one.p)),
      );
    }
  }
  if (parts.length === 0) return null;
  const sentence = parts.join(t.join);
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

/** Yüzde tam sayıya; %0 ve %100 yalnız gerçekten öyleyse (yuvarlama "kesin" demesin). */
export function wholePercent(p: number): number {
  const value = Math.round(p * 100);
  if (value === 0 && p > 0) return 1;
  if (value === 100 && p < 1) return 99;
  return value;
}

/**
 * Bir yığının yüzdeleri, toplamı TAM 100 (en büyük kalan yöntemi). Ayrı
 * ayrı yuvarlanınca "Evet %21 · Hayır %80" gibi 101 eden künyeler
 * çıkıyordu (ölçüldü, resesyon kartı). Sıfıra yuvarlanan ama sıfır
 * olmayan dilim ekranda "<%1" yazılır; %1'e zorlamak fazlayı en büyük
 * dilimden düşürür ve asıl sayıyı (%93 → %92) bozardı.
 */
export function percentShares(values: readonly number[]): number[] {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((v) => (Math.max(0, v) / total) * 100);
  const out = exact.map((v) => Math.floor(v));
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r || exact[b.i] - exact[a.i]);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

/* ---- Tazeleme kararı (cron) ---- */

/** Günde bir: bir önceki kayıt bu kadar eskiyse yenisi alınır. */
export const DAILY_REFRESH_MS = 20 * 60 * 60 * 1000;
/** Özel pencerede (seçim gecesi, Fed karar saati) saatte bir. */
export const WATCH_REFRESH_MS = 50 * 60 * 1000;

/**
 * Seçim gecesi penceresi: ilk sandıkların kapandığı 3 Kasım 18:00 ET
 * (23:00 UTC) öncesinden, sonuçların büyük kısmının netleştiği 5 Kasım
 * sabahına (UTC). Kaynak meclis kontrolünü medyanın ortak ilanıyla erken
 * kapatabiliyor; pencere o anı yakalamak için.
 */
export const ELECTION_DAY_ET = "2026-11-03";
export const ELECTION_WATCH = { from: "2026-11-03T22:00:00Z", to: "2026-11-05T12:00:00Z" } as const;
/** İlk sandıkların kapandığı saat (Indiana ve Kentucky'nin doğu kesimi), ET. */
export const FIRST_POLLS_CLOSE_ET = "18:00";

/** İlk sandıklar kapandı mı (sonuç gecesi başladı mı). */
export function pollsClosed(now: Date = new Date()): boolean {
  return now.getTime() >= Date.parse(`${ELECTION_DAY_ET}T23:00:00Z`);
}

export function shouldRefresh(
  now: Date,
  lastTakenAt: Date | null,
  watch: readonly { from: string; to: string }[],
): boolean {
  if (!lastTakenAt) return true;
  const age = now.getTime() - lastTakenAt.getTime();
  if (age >= DAILY_REFRESH_MS) return true;
  const watching = watch.some((w) => now.getTime() >= Date.parse(w.from) && now.getTime() <= Date.parse(w.to));
  return watching && age >= WATCH_REFRESH_MS;
}

/** Fed karar saatinin çevresi: açıklamadan yarım saat önce, üç saat sonra. */
export function fedWatchWindow(strikeAt: string | null): { from: string; to: string } | null {
  if (!strikeAt) return null;
  const at = Date.parse(strikeAt);
  if (!Number.isFinite(at)) return null;
  return { from: new Date(at - 30 * 60 * 1000).toISOString(), to: new Date(at + 3 * 60 * 60 * 1000).toISOString() };
}

/* ---- Bir anlık görüntünün kabul edilebilirliği ---- */

/** Ekranda gösterilecek en eski kayıt: bundan eskisi "bayat" (CLAUDE.md veri dürüstlüğü 2). */
export const SNAPSHOT_MAX_AGE_MS = 36 * 60 * 60 * 1000;

export function isSnapshot(value: unknown): value is ProbabilitySnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ProbabilitySnapshot>;
  return v.v === SNAPSHOT_VERSION && typeof v.takenAt === "string" && Array.isArray(v.fed) && Array.isArray(v.congress) && Array.isArray(v.macro);
}

export function isFresh(snapshot: ProbabilitySnapshot, now: Date = new Date()): boolean {
  const at = Date.parse(snapshot.takenAt);
  return Number.isFinite(at) && now.getTime() - at <= SNAPSHOT_MAX_AGE_MS;
}
