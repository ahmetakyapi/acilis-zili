import { cache } from "react";
import { secUserAgent } from "@/lib/investors";
import { matchOwner, parseForm4Owners, type OwnerRelationship } from "@/lib/insider-people";
import { withTimeout } from "./timeout";
import { SEC_MIN_GAP_MS, secTurn } from "./sec-gate";

/**
 * SEC EDGAR — Form 4 dosyasından bildirim sahibinin görevi (28 Eylül).
 *
 * Finnhub'ın içeriden işlem satırı görev taşımıyor ama `id`'si dosya
 * numarası; gerekçe lib/insider-people.ts başında. İki adres:
 *
 *   1. `www.sec.gov/files/company_tickers.json` — sembol → ihraççı CIK
 *      (~800 KB, haftalık). Dosyanın arşiv adresi bir CIK istiyor ve dosya
 *      numarasının önekindeki CIK her zaman işe yaramıyor: şirket kendi
 *      yöneticileri adına dosyalıyorsa (MSFT, AMD, TSM) önek şirketin CIK'i
 *      ve adres açılıyor, bir dosyalama ajanı kullanıyorsa (KLAC, AAPL:
 *      0001193125 / 0001140361) önek ajanın ve adres 404 (28 Eylül,
 *      ölçüldü). İhraççının CIK'i her Form 4'te taraf, her zaman açılıyor.
 *   2. `Archives/edgar/data/{cik}/{numara}/{numara}.txt` — dosyanın tam
 *      gönderimi, Form 4 XML'i içinde. `index.json` + XML iki tur olurdu;
 *      tam gönderim tek tur ve Form 4'te birkaç kilobayt.
 *
 * MALİYET: kişi başına bir dosya (tablodaki en yeni), en fazla tablo satırı
 * kadar. Dosyalar DEĞİŞMEZ (düzeltme yeni bir dosya numarasıyla gelir), o
 * yüzden veri önbelleğinde uzun tutuluyor; soğuk önbellekte istekler beşerli
 * gruplarla ve ortak SEC sırasından, bekleme bütçesiyle gidiyor
 * (`filingOwners`, 20 Ekim) — SEC'in saniyede on istek sınırının altında.
 *
 * DÜŞERSE: görev bir süs değil ama sayfanın taşıyıcısı da değil. Herhangi bir
 * hata ya da süre aşımında sonuç boş eşleme — satırlar yalnızca isimle kalır,
 * panel hata göstermez.
 */

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const DAY_S = 24 * 60 * 60;
/** Sembol → CIK tablosu yavaş değişiyor; yeni halka arz bir hafta içinde düşer. */
const TICKERS_REVALIDATE_S = 7 * DAY_S;
/** Dosya değişmez; süre yalnızca önbellek büyümesin diye var. */
const FILING_REVALIDATE_S = 30 * DAY_S;
/** Aynı anda en fazla kaç dosya — SEC sınırı saniyede on istek. */
const FILING_BATCH = 5;
/** Görevler için toplam bekleme — panelin geri kalanını tutmasın. */
const ROLES_TIMEOUT_MS = 4_000;

async function secGet(url: string, revalidate: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": secUserAgent(), Accept: "application/json, text/plain, text/xml" },
      next: { revalidate },
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Sembol → ihraççı CIK. SEC tablosu sınıf ayracında tire kullanıyor (BRK-B).
    İSTEKLER ARASI MEMO (15 Ekim taraması): React cache() yalnız istek
    kapsamında tekilliyor; gövde Next veri önbelleğinden gelse de ~800 KB
    JSON.parse + 12 bin kayıtlık Map kurulumu HER hisse sayfası
    görüntülemesinde tekrar ediyordu — hepsi tek `map.get` için. Süreç uzun
    ömürlü (VPS), tablo haftada bir değişiyor; `lastPersisted` desenindeki
    gibi modül seviyesinde TTL'li tutulur. Başarısız okuma SAKLANMAZ. */
let tickerMemo: { at: number; map: Map<string, number> } | null = null;
const tickerTable = cache(async (): Promise<Map<string, number> | null> => {
  if (tickerMemo && Date.now() - tickerMemo.at < TICKERS_REVALIDATE_S * 1000) return tickerMemo.map;
  const text = await secGet(TICKERS_URL, TICKERS_REVALIDATE_S);
  if (!text) return null;
  try {
    const json = JSON.parse(text) as Record<string, { cik_str?: number; ticker?: string }>;
    const map = new Map<string, number>();
    for (const row of Object.values(json)) {
      if (row.ticker && typeof row.cik_str === "number") map.set(row.ticker.toUpperCase(), row.cik_str);
    }
    tickerMemo = { at: Date.now(), map };
    return map;
  } catch {
    return null;
  }
});

async function issuerCik(symbol: string): Promise<number | null> {
  const table = await tickerTable();
  return table?.get(symbol.toUpperCase().replace(/\./g, "-")) ?? null;
}

/* SIRA VE HAFIZA (20 Ekim). Beşerli gruplar arka arkaya, aralıksız
   gidiyordu: soğuk önbellekte hız ~5/gidiş-dönüş, yani sınırın altında
   ancak her grup yarım saniyeden uzun sürerse. Her dosya isteği artık ortak
   SEC sırasından geçiyor (`sec-gate.ts`, ≤ 4/sn). Sıra, veri önbelleğinden
   dönecek okumayı da bekletir; o yüzden önce süreç hafızasına bakılıyor —
   dosya değişmez, sahipleri bir kez alındıktan sonra sırasız döner (aynı
   anda açılan iki sayfa da tek istek bekler). Başarısız okuma saklanmaz.

   BÜTÇE VE SON TARİH (20 Ekim). Hafıza her dağıtımda boş ve sıra veri
   önbelleği isabetini ayırt edemiyor; sınırsız sırada soğuk hisse sayfası
   dalgası (tarayıcı) sıranın boşalttığından hızlı boşluk ayırıp gün
   akışını ve 13F'i arkasında bekletiyordu (gerekçe `sec-gate.ts`). Dosya
   isteği sırayı en çok `FILING_WAIT_MS` bekler; sıra daha uzunsa boşluk
   ayrılmadan boş döner ve SAKLANMAZ — görev bir sonraki görüntülemede
   yeniden sorulur. `loadRoles` da süre dolunca yeni grup başlatmıyor:
   `withTimeout` yalnız beklemeyi bırakıyor, döngü arkada boşluk ayırmayı
   sürdürüyordu.

   Hafıza tavana gelince EN ESKİ kayıt düşer (eklenme sırası). Önceden
   tamamı siliniyordu ve ~800 sembol × 10'a dek kişi ≈ 8 bin dosya, 2 binlik
   tavanı durmadan boşaltıp sırayı yeniden dolduruyordu; kayıtlar küçük
   (birkaç sahip nesnesi), tavan 10 bin. */
const OWNERS_MEMO_MAX = 10_000;
/** Dosya isteğinin ortak SEC sırasında en uzun bekleyişi — görev süresinin
    (`ROLES_TIMEOUT_MS`) içinde, iki tam grubun sığacağı pay. Aralıktan
    türüyor (20 Ekim): sabit 1,5 sn 125 ms'lik aralıkta 12 boşluktu, 275
    ms'de 5'e düşüp önde tek bir grup varken ilk dosyadan sonrasını geri
    çevirirdi. 275 ms'de 2,75 sn. */
const FILING_WAIT_MS = 2 * FILING_BATCH * SEC_MIN_GAP_MS;
const ownersMemo = new Map<string, Promise<OwnerRelationship[]>>();

/** Dosyanın sahipleri; sıra dolu, okuma ya da ayrıştırma başarısızsa null. */
async function readOwners(cik: number, accession: string): Promise<OwnerRelationship[] | null> {
  if (!(await secTurn(FILING_WAIT_MS))) return null;
  const folder = accession.replace(/-/g, "");
  const text = await secGet(
    `https://www.sec.gov/Archives/edgar/data/${cik}/${folder}/${accession}.txt`,
    FILING_REVALIDATE_S,
  );
  if (!text) return null;
  try {
    return parseForm4Owners(text);
  } catch {
    /* Ayrıştırılamayan dosya da başarısız okuma: saklanmaz. */
    return null;
  }
}

function filingOwners(cik: number, accession: string): Promise<OwnerRelationship[]> {
  const held = ownersMemo.get(accession);
  if (held) return held;
  const pending: Promise<OwnerRelationship[]> = readOwners(cik, accession).then((owners) => {
    if (owners) return owners;
    /* Saklanmaz. Kimlik sorulur ki tavandan düşüp yeniden açılmış kaydı silmesin. */
    if (ownersMemo.get(accession) === pending) ownersMemo.delete(accession);
    return [];
  });
  if (ownersMemo.size >= OWNERS_MEMO_MAX) ownersMemo.delete(ownersMemo.keys().next().value!);
  ownersMemo.set(accession, pending);
  return pending;
}

async function loadRoles(
  symbol: string,
  people: readonly { name: string; filing: string | null }[],
  deadline: number,
): Promise<Map<string, OwnerRelationship>> {
  const roles = new Map<string, OwnerRelationship>();
  /* Kişi başına tek dosya: listedeki ilk (en yeni) geçişi. */
  const byName = new Map<string, string>();
  for (const person of people) {
    if (person.filing && /^\d{10}-\d{2}-\d{6}$/.test(person.filing) && !byName.has(person.name)) {
      byName.set(person.name, person.filing);
    }
  }
  if (byName.size === 0) return roles;
  const cik = await issuerCik(symbol);
  if (cik === null) return roles;

  const entries = [...byName.entries()];
  for (let i = 0; i < entries.length; i += FILING_BATCH) {
    /* Süre dolduysa çağıran gitti: yeni grup sıraya boşluk ayırmasın. */
    if (Date.now() >= deadline) break;
    const batch = entries.slice(i, i + FILING_BATCH);
    const owners = await Promise.all(batch.map(([, filing]) => filingOwners(cik, filing)));
    batch.forEach(([name], index) => {
      const owner = matchOwner(name, owners[index]!);
      if (owner) roles.set(name, owner);
    });
  }
  return roles;
}

/**
 * Tablodaki kişilerin görevleri, Finnhub'daki ad anahtarıyla. Hata ya da
 * süre aşımında boş eşleme döner — hiçbir zaman atmaz.
 */
export async function getInsiderRoles(
  symbol: string,
  people: readonly { name: string; filing: string | null }[],
): Promise<Map<string, OwnerRelationship>> {
  try {
    return await withTimeout(loadRoles(symbol, people, Date.now() + ROLES_TIMEOUT_MS), ROLES_TIMEOUT_MS);
  } catch {
    return new Map();
  }
}
