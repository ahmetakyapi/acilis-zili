import test from "node:test";
import assert from "node:assert/strict";

import { TITLE_BUDGET, analysisTitle, stockTitle } from "../lib/seo-titles";

/**
 * Arama sonucu başlıkları (25 Ekim) — gerekçe `lib/seo-titles.ts`.
 * Ölçülen üç şey: markasız kısım ≤ 60 karakter, dil (TR'de Türkçe, EN'de
 * İngilizce anahtar kelime) ve Türkçe tamlama ("X (SYM) Hissesi").
 */

/** Uzunluk örnekleri: kısa, orta ve sitedeki en uzun ad kalıpları. */
const NAMES = [
  ["Apple Inc", "AAPL"],
  ["NVIDIA Corp", "NVDA"],
  ["Taiwan Semiconductor Manufacturing Co Ltd", "TSM"],
  ["Pimco California Municipal Income Fund", "PCQ"],
  ["Advanced Micro Devices Incorporated", "AMD"],
] as const;

test("markasız başlık 60 karakteri aşmıyor (sığmayan ad yalnız ad + sembol)", () => {
  for (const [name, symbol] of NAMES) {
    for (const locale of ["tr", "en"] as const) {
      for (const title of [
        stockTitle(name, symbol, locale),
        stockTitle(name, symbol, locale, { fund: true }),
        analysisTitle(name, symbol, locale === "tr" ? "4Ç FY2026" : "Q4 FY2026", locale),
      ]) {
        const bare = `${name} (${symbol})`;
        // Ad + sembol tek başına bütçeyi aşıyorsa kısalacak bir şey kalmaz.
        if (bare.length > TITLE_BUDGET) continue;
        assert.ok(title.length <= TITLE_BUDGET, `${title} (${title.length})`);
        assert.ok(title.startsWith(bare), `ad ve sembol başta: ${title}`);
      }
    }
  }
});

test("hisse başlığı: Türkçe tamlama 'Hissesi', İngilizce 'Stock'", () => {
  assert.equal(
    stockTitle("NVIDIA Corp", "NVDA", "tr"),
    "NVIDIA Corp (NVDA) Hissesi: Fiyat, Grafik ve Bilanço",
  );
  assert.equal(
    stockTitle("NVIDIA Corp", "NVDA", "en"),
    "NVIDIA Corp (NVDA) Stock: Price, Chart and Earnings",
  );
  // Uzun adda kısa kalıp da tamlamayı korur.
  const mid = stockTitle("Taiwan Semiconductor Manufacturing Co Ltd", "TSM", "tr");
  assert.equal(mid, "Taiwan Semiconductor Manufacturing Co Ltd (TSM) Hissesi");
  for (const [name, symbol] of NAMES) {
    assert.doesNotMatch(stockTitle(name, symbol, "tr"), /\bHisse(:| Senedi)/);
    assert.doesNotMatch(stockTitle(name, symbol, "en"), /Hisse|Fiyat|Bilanço/);
  }
});

test("fon başlığı: 'ETF', hisse ve bilanço sözü yok; ETF iki kez yazılmaz", () => {
  assert.equal(
    stockTitle("Invesco QQQ Trust", "QQQ", "tr", { fund: true }),
    "Invesco QQQ Trust (QQQ) ETF: Fiyat ve Grafik",
  );
  assert.equal(
    stockTitle("iShares Russell 2000 ETF", "IWM", "en", { fund: true }),
    "iShares Russell 2000 ETF (IWM): Price and Chart",
  );
  for (const locale of ["tr", "en"] as const) {
    assert.doesNotMatch(
      stockTitle("Invesco QQQ Trust", "QQQ", locale, { fund: true }),
      /Hisse|Stock|Bilanço|Earnings/,
    );
  }
});

test("analiz başlığı: dilin anahtar kelimesi, dönem adla birlikte", () => {
  assert.equal(
    analysisTitle("Nebius Group", "NBIS", "2Ç 2026", "tr"),
    "Nebius Group (NBIS) 2Ç 2026 Bilanço Sonuçları",
  );
  assert.equal(
    analysisTitle("Nebius Group", "NBIS", "Q2 2026", "en"),
    "Nebius Group (NBIS) Q2 2026 Earnings Results",
  );
  const long = analysisTitle("Advanced Micro Devices Incorporated", "AMD", "Q4 FY2026", "en");
  assert.ok(long.startsWith("Advanced Micro Devices Incorporated (AMD) Q4 FY2026"));
  assert.match(long, /Earnings/);
});

test("başlıkta tavsiye çağrıştıran kelime yok", () => {
  for (const [name, symbol] of NAMES) {
    for (const locale of ["tr", "en"] as const) {
      for (const title of [
        stockTitle(name, symbol, locale),
        analysisTitle(name, symbol, "3Ç 2026", locale),
      ]) {
        assert.doesNotMatch(title, /yorum|al-sat|hedef|tavsiye|target|buy|sell|forecast/i);
      }
    }
  }
});
