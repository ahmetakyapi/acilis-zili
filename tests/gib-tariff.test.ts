import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTariffText, parseTariffText } from "../lib/providers/gib-tariff";
import { TAX_YEARS, withFetchedTariffs } from "../lib/tax";

/* GİB'in yayımladığı tarife PDF'lerinin metni, `pdfTextLines`in verdiği
   biçimde (sayıların içine düşen boşluklar ve bölünmüş ücret parantezleri
   dahil) — kamuya açık resmî metin. */
const GIB_2026 = "Gelir Vergisi Tarifesi 202 6 193 sayılı Kanunun 103 üncü maddesinin birinci fıkrasında yer alan gelir vergisine tabi gelirlerin vergilendirilmesinde esas alınan tarife, 202 6 takvim yılı gelirlerinin vergilendirilmesinde uygulanmak üzere aşağıdaki şekilde yeniden belirlenmiştir. 190 .000 TL'ye kadar % 15 400.000 TL'nin 190.000 TL'si için 28 . 5 00 TL, fazlası % 20 1.000.000 TL'nin 400.000 TL'si için 70 . 500 TL (ücret gelirlerinde 1.500.000 % 27 TL'nin 40 0.000 TL 'si için 70 . 5 00 TL), fazlası 5.300.000 TL'nin 1.0 00.000 TL'si için 232 . 500 TL (ücret gelirlerinde % 35 5.300.000 TL'nin 1.5 00.000 TL'si için 367 . 5 00 TL), fazlası 5 .300.000 TL'd en fazlasının 5 .300.000 TL'si için 1. 737 . 5 00 TL (ücret gelirlerinde 5 .300.000 TL'den fazlasının 5 .300.000 TL'si için 1. 697 . 5 00 TL), % 40 fa zlası";
const GIB_2025 = "Gelir Vergisi Tarifesi 2025 193 sayılı Kanunun 103 üncü maddesinin birinci fıkrasında yer alan gelir vergisine tabi gelirlerin vergilendirilmesinde esas alınan tarife, 2025 takvim yılı gelirlerinin vergilendirilmesinde uygulanmak üzere aşağıdaki şekilde yeniden belirlenmiştir . 158.000 TL'ye kadar % 15 330.000 TL'nin 158.000 TL'si için 23.700 TL, fazlası % 20 800.000 TL'nin 330.000 TL'si için 58.100 TL (ücret gelirlerinde % 27 1.200.000 TL'nin 330.000 TL'si için 58.100 TL), fazlası 4.300.000 TL'nin 800.000 TL'si için 185.000 TL (ücret gelirlerinde 4.300.000 TL'nin 1.200.000 TL'si için 293.000 TL), fazlası % 35 4.300.000 TL'den fazlasının 4.300.000 TL'si için 1.410.000 TL (ücret gelirlerinde 4.300.00 0 TL'den fazlasının 4.300.000 TL'si için % 4 0 1.378.000 TL), fazlası";
const GIB_2024 = "Gelir Vergisi Tarifesi 2024 193 sayılı Kanunun 103 üncü maddesinin birinci fıkrasında yer alan gelir vergisine tabi gelirlerin vergilendirilmesinde esas alınan tarife, 2024 takvim yılı gelirlerinin vergilendirilmesinde uygulanmak üzere aşağıdaki şekilde yeniden belirlenmiştir. 110.000 TL'ye kadar % 15 230.000 TL'nin 110.000 TL'si için 16.500 TL, fazlası % 20 580.000 TL'nin 230.000 TL'si için 40.500 TL (ücret gelirlerinde % 27 870.000 TL'nin 230.000 TL'si için 40.500 TL), fazlası 3.000.000 TL'nin 580.000 TL'si için 135.000 TL, (ücret gelirlerinde % 35 3.000.000 TL'nin 870.000 TL'si için 213.300 TL), fazlası 3.000.000 TL'den fazlasının 3.000.000 TL'si için 982.000 TL, (ücret gelirlerinde 3.000.000 TL'den fazlasının 3.000.000 TL'si için % 40 958.800 TL), fazlası";

test("GİB PDF metni: 2026 ve 2025 tarifesi koddaki elle doğrulanmış tarifeyle birebir", () => {
  for (const [text, year] of [[GIB_2026, 2026], [GIB_2025, 2025]] as const) {
    const parsed = parseTariffText(text);
    assert.ok(parsed.ok, parsed.ok ? "" : parsed.reason);
    assert.deepEqual(parsed.brackets, TAX_YEARS[year].brackets);
  }
});

test("GİB PDF metni: 2024 tarifesi (üst dilim 3 milyon)", () => {
  const parsed = parseTariffText(GIB_2024);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.brackets.map((b) => b.upTo), [110000, 230000, 580000, 3000000, null]);
  assert.deepEqual(parsed.brackets.map((b) => b.ratePct), [15, 20, 27, 35, 40]);
});

test("oran eşiğe yapışmıyor: '% 15 ⏎ 400.000' iki ayrı sayı", () => {
  const s = normalizeTariffText("190 .000 TL'ye kadar % 15 400.000 TL'nin");
  assert.ok(s.includes("190.000 TL"));
  assert.ok(s.includes("%15 400.000"));
});

test("sağlama: tek bir sayısı bozulmuş tarife reddediliyor", () => {
  const tampered = GIB_2026.replace("28 . 5 00 TL", "29 . 5 00 TL");
  assert.notEqual(tampered, GIB_2026);
  const parsed = parseTariffText(tampered);
  assert.equal(parsed.ok, false);
});

test("GİB'den gelen yeni yıl: tarife eklenir, temettü sınırı taşınır ve işaretlenir", () => {
  const merged = withFetchedTariffs(TAX_YEARS, [{ year: 2027, brackets: TAX_YEARS[2026].brackets.map((b) => ({ ...b, upTo: b.upTo && b.upTo * 1.2 })) }]);
  assert.ok(merged[2027]);
  assert.equal(merged[2027].filingYear, 2028);
  assert.equal(merged[2027].dividendThreshold, TAX_YEARS[2026].dividendThreshold);
  assert.equal(merged[2027].thresholdCarriedFrom, 2026);
  /* Kodda olan yıl GİB'den gelenle ezilmez. */
  const same = withFetchedTariffs(TAX_YEARS, [{ year: 2026, brackets: [] }]);
  assert.deepEqual(same[2026].brackets, TAX_YEARS[2026].brackets);
});
