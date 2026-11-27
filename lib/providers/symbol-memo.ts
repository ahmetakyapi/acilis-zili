/**
 * SEMBOL BAŞINA BELLEK ÖNBELLEĞİ VE ORTAK İSTEK BÜTÇESİ (27 Kasım, sahibinin
 * isteği: "Alpaca limiti doluyor, tekrar yaşanmasın"; gerekçenin ilk yarısı
 * lib/providers/quota-guard.ts).
 *
 * NEDEN. Anlık görüntü (`/snapshots`) ve gerçek zamanlı IEX barı
 * (`/bars/latest`) Next'in veri önbelleğindeydi; o önbellek ADRES başına:
 * "MU,NVDA,AMD" ile "MU,AAPL" iki ayrı kayıt, MU iki kez soruluyor. Ana sayfa,
 * hisse sayfaları (sayfa başına kendi eş listesi), teknik pano, şirketler
 * dizini ve tarayıcı her gün yüzlerce farklı kombinasyon üretiyor. Üstelik
 * süresi dolan kaydı Next arka planda yeniden çekiyor ve bu istekler
 * kodumuzun eline hiç geçmiyor: ne sağlık izinde sayılıyorlardı ne de kota
 * korumasında görünüyorlardı (27 Kasım ölçümünde site "6 dakikada 8 istek"
 * gösterirken kota sıfırlanıyordu).
 *
 * ÇÖZÜM. Bu iki uç önbelleksiz (`no-store`) çağrılıyor ve sonuç SEMBOL
 * başına burada tutuluyor:
 * - Taze kayıt (yaşı `ttl`den küçük) sağlayıcıya gitmeden dönüyor; yalnız
 *   eksik semboller tek istekte soruluyor. Hiç dönmeyen sembol de (geçersiz,
 *   işlem görmemiş) "yok" olarak aynı süre tutuluyor ki her çizimde yeniden
 *   sorulmasın.
 * - Aynı sembol zaten uçuştaysa ikinci istek açılmıyor, uçuş bekleniyor.
 * - İstek düşerse (429, ağ, bütçe) elde `STALE_MAX_MS`ten genç kayıt varsa o
 *   kendi eski damgasıyla dönüyor: çağıranın tazelik kuralı (`packCurrent`)
 *   paketi bayat görür ve künyesini ona göre basar.
 * - `fresh` istek tazeliği atlıyor (yazma katmanı, bayat paketin tekrarı)
 *   ama sonucu yine buraya yazıyor; uçuştaki istek onu da besliyor.
 * Damga: sembolün çekildiği an (yanıtın `Date` başlığı). Paket damgası
 * EN ESKİ sembolün damgası — `getSnapshots`in 20 Ekim kuralıyla aynı.
 *
 * BÜTÇE (`RequestBudget`): sağlayıcıya KESİN giden her istek (önbelleksiz)
 * dakikada `ALPACA_BUDGET_PER_MINUTE` ile sınırlı. Ücretsiz plan 200; pay
 * Next önbelleğinden geçen bar istekleri ve kurumsal işlem/opsiyon kapıları
 * için. Bütçe bitince istek atılmıyor, çağıran eldekine düşüyor.
 *
 * Süreç belleğinde: sunucu tek süreç (lib/providers/usage.ts ile aynı
 * gerekçe). Testler tests/symbol-memo.test.ts.
 */

/** Sağlayıcıya kesin giden istek bütçesi (dakikada). */
export const ALPACA_BUDGET_PER_MINUTE = 150;
/** İstek düşünce dönülebilecek en eski kayıt. */
export const STALE_MAX_MS = 10 * 60_000;
/** Bellek tavanı: bunu aşınca bir saatten eski kayıtlar atılır. */
const MAX_ENTRIES = 6000;
const PRUNE_AGE_MS = 60 * 60_000;

export class RequestBudget {
  private stamps: number[] = [];
  constructor(
    readonly limit: number,
    readonly windowMs = 60_000,
  ) {}
  /** Pencerede yer varsa bir hak alır. */
  take(now: number): boolean {
    this.stamps = this.stamps.filter((at) => now - at < this.windowMs);
    if (this.stamps.length >= this.limit) return false;
    this.stamps.push(now);
    return true;
  }
  clear(): void {
    this.stamps = [];
  }
  used(now: number): number {
    return this.stamps.filter((at) => now - at < this.windowMs).length;
  }
}

/** `at`: sağlayıcının damgası (pakete yazılan yaş); `storedAt`: bizde
    saklandığı an (süre ve eskilik buradan — sağlayıcının saati ya da Next
    önbelleğinden gelmiş eski bir `Date` kaydı erken düşürmesin). */
type Entry<V> = { value: V | null; at: number; storedAt: number };

export type FetchOutcome<V, F> = { ok: true; data: Record<string, V>; at: number } | { ok: false; failure: F };

export type MemoResult<V, F> = {
  data: Record<string, V>;
  /** Dönen sembollerin en eski damgası (ms); hiç sembol yoksa null. */
  oldestAt: number | null;
  /** Eksik semboller istendiyse ve istek düştüyse sebebi. */
  failure: F | null;
};

export class SymbolMemo<V, F> {
  private entries = new Map<string, Entry<V>>();
  private inflight = new Map<string, Promise<void>>();

  async get(
    symbols: readonly string[],
    ttlMs: number,
    fetcher: (missing: string[]) => Promise<FetchOutcome<V, F>>,
    opts: { fresh?: boolean; now?: () => number } = {},
  ): Promise<MemoResult<V, F>> {
    const now = opts.now ?? Date.now;
    const start = now();
    const waits: Promise<void>[] = [];
    const missing: string[] = [];
    for (const symbol of new Set(symbols)) {
      const entry = this.entries.get(symbol);
      if (!opts.fresh && entry && start - entry.storedAt < ttlMs) continue;
      const flying = this.inflight.get(symbol);
      if (flying) waits.push(flying);
      else missing.push(symbol);
    }

    let failure: F | null = null;
    if (missing.length > 0) {
      const flight = fetcher(missing).then(
        (outcome) => {
          if (outcome.ok) {
            const storedAt = now();
            for (const symbol of missing) this.entries.set(symbol, { value: outcome.data[symbol] ?? null, at: outcome.at, storedAt });
            this.prune(now());
          } else failure = outcome.failure;
        },
        () => {
          /* Ağ hatası gibi beklenmeyen ret: kayıt yazılmaz, eldeki döner. */
        },
      );
      const done = flight.finally(() => {
        for (const symbol of missing) if (this.inflight.get(symbol) === done) this.inflight.delete(symbol);
      });
      for (const symbol of missing) this.inflight.set(symbol, done);
      waits.push(done);
    }
    await Promise.all(waits);

    const end = now();
    const data: Record<string, V> = {};
    let oldestAt: number | null = null;
    for (const symbol of new Set(symbols)) {
      const entry = this.entries.get(symbol);
      if (!entry || end - entry.storedAt >= STALE_MAX_MS || entry.value === null) continue;
      data[symbol] = entry.value;
      if (oldestAt === null || entry.at < oldestAt) oldestAt = entry.at;
    }
    return { data, oldestAt, failure };
  }

  private prune(now: number) {
    if (this.entries.size <= MAX_ENTRIES) return;
    for (const [symbol, entry] of this.entries) if (now - entry.storedAt >= PRUNE_AGE_MS) this.entries.delete(symbol);
  }

  /** Testler için. */
  size(): number {
    return this.entries.size;
  }
  clear(): void {
    this.entries.clear();
    this.inflight.clear();
  }
}
