import "server-only";

import { unstable_cache } from "next/cache";
import { karneMarks, runKarneRound, type KarneFetch, type KarneMark, type KarneRound } from "@/lib/earnings-horizon";
import { getEarningsSurprises } from "@/lib/providers/finnhub";

/**
 * Ufuk karolarının beklenti karnesi — hisse sayfasının "Beklenti Karnesi"
 * ile AYNI kaynak (`getEarningsSurprises`, `UpcomingEarnings` → `karneler`)
 * ve aynı kural (`karneMarks`). Aynı şirketin karnesi iki ekranda iki
 * farklı sonuç göstermesin (CLAUDE.md "Veri dürüstlüğü" 3).
 *
 * Neden takvim tablosu değil: tablo geçmiş tarafında sembol başına tek
 * satır tutuyor; dört çeyrek ancak sağlayıcının sürpriz geçmişinde var.
 *
 * KOTA (25 Ekim, sunucu incelemesi). İlk sürüm 30 sembolü tek
 * `Promise.all`la aynı anda soruyordu. Finnhub ücretsiz katmanı saniyede 30,
 * dakikada 60 istek; Next'in veri önbelleği yalnız 200 yanıtı saklıyor
 * (`patch-fetch`), yani 429 alan sembol önbelleğe girmiyor ve SONRAKİ HER
 * görüntüleme (botlar dahil) aynı 30 çağrıyı yeniden atıyordu: kota sürekli
 * tükenir, aynı anahtardaki öbür paneller (analist, haber, profil) de düşer.
 * Şimdi dört kat:
 *   1. Eşzamanlılık 4 (`KARNE_CONCURRENCY`), 429 görülünce tur kesilir
 *      (`runKarneRound`); kalan karolar o turda karnesiz.
 *   2. Bütün tur sembol listesine bağlı TEK `unstable_cache` kaydı (altı
 *      saat, hisse sayfasının `revalidate`iyle aynı). Yalnız TAM tur
 *      saklanır: eksik tur içeride FIRLATILIR, önbelleğin dışında yakalanıp
 *      eldeki kısmi sonuç gösterilir (`loadSymbolTable` kalıbı). Süresi
 *      dolan kayıt eskisiyle hizmet edip arkada tazelenir; okuyucu beklemez.
 *   3. 429 sonrası süreç içi SOĞUMA (`COOLDOWN_MS`, Finnhub'ın dakikalık
 *      penceresi): bu sürede tur hiç istek atmadan boş döner. Uygulama
 *      VPS'te tek süreç, modül değişkeni yeter.
 *   4. Aynı listeyi aynı anda isteyen iki görüntüleme tek turu paylaşır
 *      (`inflight`); `unstable_cache` eşzamanlı ıskaları birleştirmiyor.
 *
 * Günlük cron'da önceden doldurma değerlendirildi, yapılmadı:
 * `/api/cron/daily`ın Finnhub bütçesi zaten ~84 istek / 120 sn (dakikada
 * 60 sınırının hemen altında, dosyadaki BÜTÇE notu) ve 30 istek daha onu
 * kotaya dayıyor; `bilanco` cron'u bildirim işi ve haftanın seçimini
 * (`getEarningsWeek`) bilmiyor. Seçim gün içinde değişebildiği için cron'un
 * doldurduğu anahtar sayfanınkini tutmayabilirdi. Altı saatlik tek kayıt +
 * arkada tazeleme, altı saatte en çok bir tur (≤30 istek, dörderli) demek.
 *
 * Sayfa bu sözü BEKLEMİYOR: karneler istemciye söz olarak gidiyor ve her
 * karonun çentik satırı kendi `Suspense`inde, aynı yüksekliği tutan bir
 * yedekle doluyor (CLS yok).
 */

/** Önbellek anahtarının sürümü: dönen ŞEKLİ değiştiren artırır (önbellek
    dağıtımlar arası ortak — CLAUDE.md "İstekler arası önbellek"). */
const KARNE_CACHE_KEY = "horizon-karne-v1";
/** Hisse sayfasındaki `getEarningsSurprises` `revalidate`iyle aynı. */
const KARNE_REVALIDATE_S = 21_600;
/** 429 sonrası bu süre sağlayıcıya karne isteği gitmez. */
const COOLDOWN_MS = 60_000;

let cooldownUntil = 0;
const inflight = new Map<string, Promise<KarneRound>>();

async function fetchKarne(symbol: string): Promise<KarneFetch> {
  const result = await getEarningsSurprises(symbol);
  if (result.ok) return { kind: "ok", marks: karneMarks(result.data) };
  /* "Geçmiş yok" ve "anahtar yok" kesin cevap: karnesiz karo doğru durum,
     tekrar sormak bir şey değiştirmez. Kalan hatalar geçici. */
  if (result.reason === "empty" || result.reason === "missing-key" || result.reason === "not-found") {
    return { kind: "ok", marks: [] };
  }
  return { kind: "retry", limited: result.reason === "rate-limited" };
}

/** Eksik tur önbelleğe girmesin diye fırlatılan hata; kısmi sonucu taşır. */
class PartialKarne extends Error {
  constructor(readonly round: KarneRound) {
    super("horizon karne: eksik tur");
  }
}

async function runRound(key: string, symbols: readonly string[]): Promise<KarneRound> {
  if (Date.now() < cooldownUntil) {
    return { marks: Object.fromEntries(symbols.map((s) => [s, [] as KarneMark[]])), complete: false, limited: true, calls: 0 };
  }
  const running = inflight.get(key);
  if (running) return running;
  const round = runKarneRound(symbols, fetchKarne).then((result) => {
    if (result.limited) cooldownUntil = Date.now() + COOLDOWN_MS;
    return result;
  });
  inflight.set(key, round);
  try {
    return await round;
  } finally {
    inflight.delete(key);
  }
}

const cachedKarne = unstable_cache(
  async function cachedKarne(key: string): Promise<Record<string, KarneMark[]>> {
    const symbols = key ? key.split(",") : [];
    const round = await runRound(key, symbols);
    if (!round.complete) throw new PartialKarne(round);
    return round.marks;
  },
  [KARNE_CACHE_KEY],
  { revalidate: KARNE_REVALIDATE_S },
);

export async function loadHorizonKarne(symbols: readonly string[]): Promise<Record<string, KarneMark[]>> {
  /* Sıralanmış dize anahtar: aynı küme aynı kayda düşsün. */
  const key = [...new Set(symbols)].sort().join(",");
  if (!key) return {};
  try {
    return await cachedKarne(key);
  } catch (error) {
    if (error instanceof PartialKarne) return error.round.marks;
    return {};
  }
}
