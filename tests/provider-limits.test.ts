import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { TimeoutError, withBody } from "../lib/providers/timeout";
import { SEC_MIN_GAP_MS, secTurn } from "../lib/providers/sec-gate";
import { getUsdTryOn } from "../lib/providers/tcmb";

/**
 * Dış kaynaklara konan sınırlar (20 Ekim). Her test bir üretim olayına
 * karşılık geliyor: başlıktan sonra duran gövde, SEC'e aynı anda açılan
 * istekler, her çağrıda yeniden taranan TCMB tatil günleri.
 */

test("süre sınırı gövde okumasını da kapsar", async () => {
  /* Başlık geldi, gövde hiç bitmiyor: eski `withTimeout(fetch())` burada
     undici'nin 300 sn'lik gövde süresine dek bekliyordu. */
  const stalled = new Response(new ReadableStream({ start() {} }));
  await assert.rejects(withBody(Promise.resolve(stalled), (r) => r.text(), 30), TimeoutError);

  const { res, body } = await withBody(Promise.resolve(new Response("tamam")), (r) => r.text(), 1_000);
  assert.equal(res.status, 200);
  assert.equal(body, "tamam");
});

test("SEC sırası aynı anda gelen çağrıları da aralıklar", async () => {
  /* Eski kapı beklemeden SONRA yazıyordu; eşzamanlı çağrılar aynı boşluğu
     hesaplayıp birlikte çıkıyordu. */
  const start = Date.now();
  const at: number[] = [];
  await Promise.all([0, 1, 2, 3].map(async () => {
    await secTurn();
    at.push(Date.now() - start);
  }));
  at.sort((a, b) => a - b);
  /* Zamanlayıcı birkaç milisaniye erken düşebiliyor; pay o kadar. */
  for (let i = 1; i < at.length; i++) assert.ok(at[i]! - at[i - 1]! >= SEC_MIN_GAP_MS - 10, `${at}`);
});

test("SEC sırası bütçeyi aşan çağrıyı boşluk ayırmadan geri çevirir", async () => {
  /* Form 4 çizim yolunda bütçeyle soruyor (20 Ekim): sıra uzunsa beklemez,
     vazgeçen çağrı da sırayı uzatmaz — eskiden her ayırma vazgeçilse de
     yaşıyor, soğuk sayfa dalgasında sıra sınırsız uzuyordu. */
  const start = Date.now();
  const queued = Array.from({ length: 8 }, () => secTurn());
  const refusals = await Promise.all(Array.from({ length: 40 }, () => secTurn(SEC_MIN_GAP_MS * 2)));
  assert.ok(refusals.every((granted) => granted === false));
  assert.ok(Date.now() - start < SEC_MIN_GAP_MS, "geri çevirmek beklemez");
  assert.ok((await Promise.all(queued)).every(Boolean));
  /* 40 geri çevrilen boşluk ayırsaydı sıradaki ~11 sn sonra çıkardı; sıra
     yalnız 8 + önceki testten kalan bir boşluk kadar. */
  assert.equal(await secTurn(), true);
  assert.ok(Date.now() - start < SEC_MIN_GAP_MS * 10 + 250, `${Date.now() - start} ms`);
});

/** Turbopack'in ikinci çalışma zamanı gibi: kapı modülünün kendi `nextSlot`u
    olan bağımsız bir örneği (ölçüm `lib/day-flow-data.ts` → `loadSharedDayFlow`). */
const loadFresh = createRequire(__filename);
function runtimeGate(): { secTurn: typeof secTurn } {
  const path = loadFresh.resolve("../lib/providers/sec-gate");
  delete loadFresh.cache[path];
  return loadFresh(path) as { secTurn: typeof secTurn };
}

test("SEC: iki çalışma zamanının sırası birlikte hiçbir saniyede 10'a varmaz", async () => {
  /* Sıra çalışma zamanı başına (sayfa ve `/api`) ve 8-K yoklaması ikisinde de
     koşuyor (20 Ekim). İlk sürümün 125 ms'si iki sıra dolunca ~16/sn
     veriyordu; 250 ms bile kapalı bir saniyeye (0 … 1000) sıra başına beş,
     ikisine on istek sığdırırdı. Saat sahte: zamanlayıcı gecikmesi yok,
     ölçülen yalnız ayrılan boşluklar. */
  const page = runtimeGate();
  const api = runtimeGate();
  assert.notEqual(page.secTurn, api.secTurn, "iki ayrı sıra");
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
  try {
    const at: number[][] = [[], []];
    const calls = [page, api].flatMap((gate, runtime) =>
      Array.from({ length: 12 }, () => gate.secTurn().then(() => at[runtime]!.push(Date.now()))),
    );
    for (let clock = 0; clock <= 12 * SEC_MIN_GAP_MS; clock += 5) {
      await new Promise((resolve) => setImmediate(resolve));
      mock.timers.tick(5);
    }
    await Promise.all(calls);

    for (const times of at) {
      assert.equal(times.length, 12);
      for (let i = 1; i < times.length; i++) assert.ok(times[i]! - times[i - 1]! >= SEC_MIN_GAP_MS, `${times}`);
    }
    const all = at.flat().sort((a, b) => a - b);
    const busiest = Math.max(...all.map((from) => all.filter((t) => t >= from && t <= from + 1_000).length));
    assert.ok(busiest <= 8, `en yoğun saniyede ${busiest} istek: ${all}`);
  } finally {
    mock.timers.reset();
  }
});

const bulletin = (tarih: string) => `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="${tarih}" Date="" Bulten_No="">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit><ForexBuying>36.1000</ForexBuying><ForexSelling>36.2000</ForexSelling>
  </Currency>
</Tarih_Date>`;

/** `fetch`i sayaçlı bir sahteyle değiştirir; yalnız `found` adresi 200 döner. */
function stubTcmb(found: string, tarih: string): { calls: string[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return url.endsWith(found) ? new Response(bulletin(tarih)) : new Response("", { status: 404 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test("TCMB arşivinin 404'ü hatırlanır: hafta sonu ikinci soruda taranmaz", async () => {
  /* Next'in veri önbelleği yalnız 200'ü saklıyor; 404 her çağrıda yeniden
     TCMB'ye gidiyordu. 16 Mart 2025 pazar → cuma bülteni. */
  const stub = stubTcmb("/202503/14032025.xml", "14.03.2025");
  try {
    const first = await getUsdTryOn("2025-03-16", "2026-10-20");
    assert.equal(first.ok && first.data.bulletinDate, "2025-03-14");
    assert.equal(stub.calls.length, 3);

    stub.calls.length = 0;
    const second = await getUsdTryOn("2025-03-16", "2026-10-20");
    assert.equal(second.ok && second.data.bulletinDate, "2025-03-14");
    assert.deepEqual(stub.calls, ["https://www.tcmb.gov.tr/kurlar/202503/14032025.xml"]);
  } finally {
    stub.restore();
  }
});

test("hepsi 404 dönen tarama hatırlanmaz: kesinti bir ay sürmez", async () => {
  /* On bir günün hepsi 404 ise tatil değil kesinti; hafızaya yazılsaydı o
     günler süreç boyunca bir ay "bülten yok" kalırdı. */
  const stub = stubTcmb("/yok.xml", "");
  try {
    const first = await getUsdTryOn("2024-06-12", "2026-10-20");
    assert.equal(first.ok, false);
    assert.equal(stub.calls.length, 11);

    stub.calls.length = 0;
    await getUsdTryOn("2024-06-12", "2026-10-20");
    assert.equal(stub.calls.length, 11);
  } finally {
    stub.restore();
  }
});

test("bugünün 404'ü kısa hatırlanır: 15:30 bülteni ay boyu gizlenmez", async () => {
  const stub = stubTcmb("/202610/19102026.xml", "19.10.2026");
  const realNow = Date.now;
  try {
    await getUsdTryOn("2026-10-20", "2026-10-20");
    assert.equal(stub.calls.length, 2);

    stub.calls.length = 0;
    await getUsdTryOn("2026-10-20", "2026-10-20");
    assert.equal(stub.calls.length, 1, "yirmi dakika içinde bugün yeniden sorulmaz");

    stub.calls.length = 0;
    Date.now = () => realNow() + 21 * 60_000;
    await getUsdTryOn("2026-10-20", "2026-10-20");
    assert.ok(stub.calls.some((url) => url.endsWith("/202610/20102026.xml")), "süre dolunca bugün yeniden denenir");
  } finally {
    Date.now = realNow;
    stub.restore();
  }
});
