import { withBody } from "./timeout";
import {
  ELECTION_DAY_ET,
  fedMoveOf,
  priceOf,
  SNAPSHOT_VERSION,
  type ProbabilitySnapshot,
  type ProbEvent,
  type ProbEventKind,
  type ProbHistoryPoint,
  type ProbOutcome,
} from "../probabilities";

/**
 * Kalshi — tahmin piyasası verisi (25 Ekim, /olasiliklar).
 *
 * NEDEN KALSHI. ABD'de CFTC'nin düzenlediği bir borsa (Designated Contract
 * Market); Fed kararı, Kongre kontrolü, resesyon ve TÜFE için sürekli ve
 * derin piyasası var. Pazar verisi uçları (`/events`, `/markets`,
 * `/candlesticks`) ANAHTARSIZ okunuyor; anahtar yalnız işlem için. Polymarket
 * de anahtarsız (Gamma API) ama kripto teminatlı ve düzenlemesiz; CME
 * FedWatch'un API'si ücretli (aylık 25 dolardan), FRED'de vadeli fed funds
 * fiyatı yok. Gerekçe ve kaynaklar /olasiliklar raporunda.
 *
 * TÜRKİYE'DEN ERİŞİM YOK (ölçüldü, 25 Ekim): alan adı TR çözümleyicilerinde
 * engel sayfasına (195.175.254.2) çözülüyor, gerçek adrese gidince de SNI
 * düzeyinde kesiliyor. Üretim sunucusu yurt dışında (Oracle Cloud), istek
 * oradan çıkıyor; yerelde geliştirme için `KALSHI_API_BASE` yerel bir
 * yansıya yönlendirilebilir (`.env.example`). Engel AŞILMIYOR: uygulama
 * kendi çözümleyicisini değiştirmez.
 *
 * BAHİS BAĞLANTISI YOK. Bu modül kontrat sayfası adresi üretmez ve
 * döndürdüğü şekilde adres alanı yoktur (gerekçe lib/probabilities.ts).
 *
 * Sayılar ham dolar fiyatı (0–1); olasılığa çevirme ve normalize etme saf
 * modülde (`lib/probabilities.ts`, testli).
 */

const DEFAULT_BASE = "https://api.elections.kalshi.com/trade-api/v2";
/** Tek çağrının üst sınırı — anlık görüntü günde bir alınıyor, acele yok. */
const CALL_TIMEOUT_MS = 12_000;
/** Çizginin uzunluğu: son 30 gün, günlük mum. */
const HISTORY_DAYS = 30;
const DAY_SECONDS = 86_400;
/** Patikada en çok kaç toplantı okunur (sayfa altısını gösteriyor). */
const FED_EVENT_LIMIT = 10;

/* Olayların kimliği. Seri kodları Kalshi'nin; değişirse burası değişir. */
const FED_SERIES = "KXFEDDECISION";
const SENATE_EVENT = { series: "CONTROLS", event: "CONTROLS-2026" } as const;
const HOUSE_EVENT = { series: "CONTROLH", event: "CONTROLH-2026" } as const;
/** 2027 resesyonu: 2026'nınki iki ay kala neredeyse kapanmış bir soru. */
const RECESSION_EVENT = { series: "KXRECSSNBER", event: "KXRECSSNBER-27" } as const;
const CPI_SERIES = "KXCPI";

function baseUrl(): string {
  const configured = process.env.KALSHI_API_BASE?.trim();
  return configured && /^https?:\/\//.test(configured) ? configured.replace(/\/$/, "") : DEFAULT_BASE;
}

type RawMarket = {
  ticker: string;
  custom_strike?: Record<string, string> | null;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
  previous_yes_bid_dollars?: string;
  previous_yes_ask_dollars?: string;
  previous_price_dollars?: string;
  open_interest_fp?: string;
  volume_24h_fp?: string;
  /* Eski sürüm alanları (sent ve tam sayı) — yenisi yoksa okunur. */
  yes_bid?: number;
  yes_ask?: number;
  last_price?: number;
  previous_yes_bid?: number;
  previous_yes_ask?: number;
  previous_price?: number;
  open_interest?: number;
  volume_24h?: number;
  result?: string;
  close_time?: string;
  status?: string;
};

type RawEvent = {
  event_ticker: string;
  series_ticker?: string;
  strike_date?: string | null;
  markets?: RawMarket[];
};

type RawCandle = {
  end_period_ts: number;
  price?: { close_dollars?: string | null };
  yes_bid?: { close_dollars?: string | null };
  yes_ask?: { close_dollars?: string | null };
};

async function getJson<T>(path: string): Promise<T> {
  const { res, body } = await withBody(
    fetch(`${baseUrl()}${path}`, { headers: { accept: "application/json" }, cache: "no-store" }),
    (r) => (r.ok ? r.json() : r.text()),
    CALL_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`kalshi ${res.status} ${path}`);
  return body as T;
}

function dollars(text: string | undefined | null, cents?: number | null): number | null {
  if (typeof text === "string" && text !== "") {
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }
  return typeof cents === "number" && Number.isFinite(cents) ? cents / 100 : null;
}

function count(text: string | undefined, plain?: number): number {
  const value = typeof text === "string" ? Number(text) : plain;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function outcomeOf(market: RawMarket, key: string): ProbOutcome {
  return {
    key,
    ticker: market.ticker,
    bid: dollars(market.yes_bid_dollars, market.yes_bid),
    ask: dollars(market.yes_ask_dollars, market.yes_ask),
    last: dollars(market.last_price_dollars, market.last_price),
    prevBid: dollars(market.previous_yes_bid_dollars, market.previous_yes_bid),
    prevAsk: dollars(market.previous_yes_ask_dollars, market.previous_yes_ask),
    prevLast: dollars(market.previous_price_dollars, market.previous_price),
    openInterest: count(market.open_interest_fp, market.open_interest),
    volume24h: count(market.volume_24h_fp, market.volume_24h),
    result: market.result === "yes" || market.result === "no" ? market.result : null,
  };
}

/** Parti kontratı: kodun son eki (-D / -R). */
function partyKey(ticker: string): string | null {
  if (/-D$/.test(ticker)) return "dem";
  if (/-R$/.test(ticker)) return "rep";
  return null;
}

/** TÜFE merdiveni: "KXCPI-26OCT-T0.2" → "0.2", "-T-0.1" → "-0.1". */
function thresholdKey(ticker: string): string | null {
  const match = /-T(-?\d+(?:\.\d+)?)$/.exec(ticker);
  return match ? match[1] : null;
}

function toEvent(
  kind: ProbEventKind,
  raw: RawEvent,
  keyOf: (market: RawMarket) => string | null,
  strikeAt: string | null = raw.strike_date ?? null,
): ProbEvent | null {
  const outcomes: ProbOutcome[] = [];
  let closesAt: string | null = null;
  for (const market of raw.markets ?? []) {
    const key = keyOf(market);
    if (!key) continue;
    outcomes.push(outcomeOf(market, key));
    if (market.close_time && (!closesAt || market.close_time < closesAt)) closesAt = market.close_time;
  }
  if (outcomes.length === 0) return null;
  return { kind, eventTicker: raw.event_ticker, strikeAt, closesAt, outcomes, history: [] };
}

/** Bir sonucun günlük mumları → { t, fiyat }. Hata çizgiyi siler, olayı değil. */
async function candles(series: string, ticker: string, now: number): Promise<Map<number, number>> {
  const start = now - HISTORY_DAYS * DAY_SECONDS;
  const data = await getJson<{ candlesticks?: RawCandle[] }>(
    `/series/${encodeURIComponent(series)}/markets/${encodeURIComponent(ticker)}/candlesticks?start_ts=${start}&end_ts=${now}&period_interval=1440`,
  );
  const out = new Map<number, number>();
  for (const candle of data.candlesticks ?? []) {
    const price = priceOf(
      dollars(candle.yes_bid?.close_dollars ?? null),
      dollars(candle.yes_ask?.close_dollars ?? null),
      dollars(candle.price?.close_dollars ?? null),
    );
    if (price !== null && Number.isFinite(candle.end_period_ts)) out.set(candle.end_period_ts, price);
  }
  return out;
}

async function withHistory(event: ProbEvent, series: string, now: number): Promise<ProbEvent> {
  try {
    const lines = await Promise.all(event.outcomes.map((o) => candles(series, o.ticker, now)));
    const times = new Set<number>();
    for (const line of lines) for (const t of line.keys()) times.add(t);
    const history: ProbHistoryPoint[] = [...times]
      .sort((a, b) => a - b)
      .map((t) => ({
        t,
        values: Object.fromEntries(
          event.outcomes.flatMap((o, i) => {
            const value = lines[i].get(t);
            return value === undefined ? [] : [[o.key, value]];
          }),
        ),
      }));
    return { ...event, history };
  } catch {
    return event;
  }
}

async function fedMeetings(now: number): Promise<ProbEvent[]> {
  const data = await getJson<{ events?: RawEvent[] }>(
    `/events?series_ticker=${FED_SERIES}&status=open&with_nested_markets=true&limit=${FED_EVENT_LIMIT}`,
  );
  const meetings = (data.events ?? [])
    .map((raw) => toEvent("fed", raw, (m) => fedMoveOf(m.custom_strike)))
    .filter((e): e is ProbEvent => e !== null)
    .sort((a, b) => (a.strikeAt ?? "").localeCompare(b.strikeAt ?? ""));
  /* Çizgi yalnız sıradaki toplantı için: sayfa onu büyük çiziyor. */
  if (meetings[0]) meetings[0] = await withHistory(meetings[0], FED_SERIES, now);
  return meetings;
}

async function singleEvent(
  kind: ProbEventKind,
  ref: { series: string; event: string },
  keyOf: (m: RawMarket) => string | null,
  now: number,
  strikeAt?: string | null,
): Promise<ProbEvent | null> {
  const data = await getJson<{ event?: RawEvent; markets?: RawMarket[] }>(
    `/events/${encodeURIComponent(ref.event)}?with_nested_markets=true`,
  );
  /* Uç iki biçimde dönebiliyor: piyasalar olayın içinde ya da yanında. */
  const raw: RawEvent | undefined = data.event
    ? { ...data.event, markets: data.event.markets ?? data.markets }
    : undefined;
  const event = raw ? toEvent(kind, raw, keyOf, strikeAt === undefined ? raw.strike_date ?? null : strikeAt) : null;
  return event ? withHistory(event, ref.series, now) : null;
}

/** Sıradaki aylık TÜFE: açık olayların en erken kapananı. Merdivenin çizgisi yok. */
async function nextCpi(): Promise<ProbEvent | null> {
  const data = await getJson<{ events?: RawEvent[] }>(
    `/events?series_ticker=${CPI_SERIES}&status=open&with_nested_markets=true&limit=4`,
  );
  const events = (data.events ?? [])
    .map((raw) => toEvent("cpi", raw, (m) => thresholdKey(m.ticker)))
    .filter((e): e is ProbEvent => e !== null)
    .map((e) => ({ ...e, strikeAt: e.strikeAt ?? e.closesAt }))
    .sort((a, b) => (a.closesAt ?? "").localeCompare(b.closesAt ?? ""));
  return events[0] ?? null;
}

/** İlk sandıkların kapandığı an (18:00 ET = 23:00 UTC) — Kongre olaylarında Kalshi `strike_date` vermiyor. */
const ELECTION_STRIKE = `${ELECTION_DAY_ET}T23:00:00Z`;

/**
 * Bütün sayfanın tek anlık görüntüsü. Parçalardan biri düşerse o bölüm
 * boş kalır; HİÇBİRİ okunamazsa hata fırlatılır (önbelleğe ve tabloya boş
 * görüntü girmesin — CLAUDE.md "hata önbelleğin dışında").
 */
export async function fetchKalshiSnapshot(now: Date = new Date()): Promise<ProbabilitySnapshot> {
  const nowSec = Math.floor(now.getTime() / 1000);
  const settle = <T,>(promise: Promise<T>) => promise.then((value) => ({ ok: true as const, value }), () => ({ ok: false as const }));
  const [fed, senate, house, recession, cpi] = await Promise.all([
    settle(fedMeetings(nowSec)),
    settle(singleEvent("senate", SENATE_EVENT, (m) => partyKey(m.ticker), nowSec, ELECTION_STRIKE)),
    settle(singleEvent("house", HOUSE_EVENT, (m) => partyKey(m.ticker), nowSec, ELECTION_STRIKE)),
    settle(singleEvent("recession", RECESSION_EVENT, () => "yes", nowSec)),
    settle(nextCpi()),
  ]);
  if (!fed.ok && !senate.ok && !house.ok && !recession.ok && !cpi.ok) {
    throw new Error("kalshi: hiçbir olay okunamadı");
  }
  const present = <T,>(result: { ok: true; value: T } | { ok: false }): T | null => (result.ok ? result.value : null);
  return {
    v: SNAPSHOT_VERSION,
    source: "kalshi",
    takenAt: now.toISOString(),
    fed: present(fed) ?? [],
    congress: [present(house), present(senate)].filter((e): e is ProbEvent => e !== null),
    macro: [present(recession), present(cpi)].filter((e): e is ProbEvent => e !== null),
  };
}
