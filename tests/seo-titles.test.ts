import test from "node:test";
import assert from "node:assert/strict";

import {
  BRAND_SUFFIX,
  TITLE_BUDGET,
  TITLE_LIMIT,
  analysisHeading,
  analysisTitle,
  fitTitle,
  investorTitles,
  shortCompanyName,
  stockTitle,
  technicalHeading,
  technicalHeadingParts,
  technicalTitles,
} from "../lib/seo-titles";
import { companyCopy, companyWhen } from "../lib/earnings-company";
import { earningsSeasonEn, earningsSeasonTr } from "../lib/i18n/dictionaries/earnings-season";
import { getDictionary } from "../lib/i18n";

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

/* ==========================================================================
   TAVAN: başlık + marka eki ≤ 65; aşarsa ek düşer (14 Kasım, SEO ikinci tur)
   ========================================================================== */

/** Sayfanın `<title>`ı: `fittedTitle`ın (lib/page-meta.ts) ürettiği metin. */
function rendered(candidates: string | readonly string[], locale: "tr" | "en"): string {
  const { text, branded } = fitTitle(candidates, locale);
  return branded ? text + BRAND_SUFFIX[locale] : text;
}

test("marka eki kök şablonla aynı (sözlükteki marka adı)", () => {
  for (const locale of ["tr", "en"] as const) {
    assert.equal(BRAND_SUFFIX[locale], ` · ${getDictionary(locale).brand.name}`);
  }
});

test("fitTitle: sığıyorsa ekli, sığmıyorsa eksiz, metin kesilmez", () => {
  assert.deepEqual(fitTitle("Kısa Başlık", "tr"), { text: "Kısa Başlık", branded: true });
  const edge = "x".repeat(TITLE_LIMIT - BRAND_SUFFIX.tr.length);
  assert.equal(fitTitle(edge, "tr").branded, true);
  assert.equal(fitTitle(`${edge}x`, "tr").branded, false);
  // EN eki bir karakter uzun: aynı başlık EN'de eksiz kalır.
  assert.equal(fitTitle(edge, "en").branded, false);
  const long = "y".repeat(90);
  assert.deepEqual(fitTitle(long, "tr"), { text: long, branded: false });
});

test("fitTitle aday listesi: önce ekle sığan, yoksa eksiz sığan, yoksa en kısası", () => {
  const full = "a".repeat(70);
  const mid = "b".repeat(60);
  const short = "c".repeat(40);
  assert.deepEqual(fitTitle([full, mid, short], "tr"), { text: short, branded: true });
  assert.deepEqual(fitTitle([full, mid], "tr"), { text: mid, branded: false });
  assert.deepEqual(fitTitle([full, "d".repeat(68)], "tr"), { text: "d".repeat(68), branded: false });
});

test("hisse ve analiz başlıkları tavanı aşmıyor (ad + sembol sığıyorsa)", () => {
  for (const [name, symbol] of NAMES) {
    for (const locale of ["tr", "en"] as const) {
      for (const title of [
        stockTitle(name, symbol, locale),
        stockTitle(name, symbol, locale, { fund: true }),
        analysisTitle(name, symbol, locale === "tr" ? "4Ç FY2026" : "Q4 FY2026", locale),
      ]) {
        if (`${name} (${symbol})`.length > TITLE_BUDGET) continue;
        const full = rendered(title, locale);
        assert.ok(full.length <= TITLE_LIMIT, `${full} (${full.length})`);
      }
    }
  }
  // Ölçülen vaka: 73 karakterlik hisse başlığı artık eksiz 52.
  assert.equal(rendered(stockTitle("NVIDIA Corp", "NVDA", "tr"), "tr"), "NVIDIA Corp (NVDA) Hissesi: Fiyat, Grafik ve Bilanço");
  assert.equal(rendered(stockTitle("Apple Inc", "AAPL", "tr"), "tr"), "Apple Inc (AAPL) Hissesi: Fiyat, Grafik ve Bilanço · Açılış Zili");
});

test("içerik başlıkları (mercek, bülten, günün grafiği): ek düşer, manşet kesilmez", () => {
  const headline = "Fed Tutanakları Faiz İndirimini Erteledi, Tahvil Faizleri Yeniden Yükseldi";
  assert.ok((headline + BRAND_SUFFIX.tr).length > TITLE_LIMIT);
  assert.equal(rendered(headline, "tr"), headline);
  assert.equal(rendered("Nvidia Bilançosu Beklentiyi Aştı", "tr"), "Nvidia Bilançosu Beklentiyi Aştı · Açılış Zili");
});

test("durağan sayfa: /bilancolar/analizler (ölçülen 68) tavanın altında", () => {
  for (const [title, locale] of [
    ["Bilanço Analizleri: ABD Şirketlerinin Çeyrek Sonuçları", "tr"],
    ["Earnings Analyses: US Quarterly Results Explained", "en"],
  ] as const) {
    assert.ok(rendered(title, locale).length <= TITLE_LIMIT, rendered(title, locale));
  }
});

test("yatırımcı başlığı: uzun kurum adında kısalır, tavanı aşmaz", () => {
  const cases = [
    ["Warren Buffett", "Berkshire Hathaway", "13f"],
    ["Stanley Druckenmiller", "Duquesne Family Office", "13f"],
    ["Li Lu", "Himalaya Capital", "13f"],
    ["Nancy Pelosi", "ABD Temsilciler Meclisi", "congress"],
    ["Marjorie Taylor Greene", "U.S. House of Representatives", "congress"],
  ] as const;
  for (const [name, firm, kind] of cases) {
    for (const locale of ["tr", "en"] as const) {
      const full = rendered(investorTitles(name, firm, kind, locale), locale);
      assert.ok(full.length <= TITLE_LIMIT, `${full} (${full.length})`);
      assert.ok(full.startsWith(name));
      assert.match(full, kind === "congress" ? /Hisse İşlemleri|Stock Trades/ : /Portföyü|Portfolio/);
    }
  }
  assert.equal(rendered(investorTitles("Li Lu", "Himalaya Capital", "13f", "tr"), "tr"), "Li Lu Portföyü: Himalaya Capital Hisseleri · Açılış Zili");
  // Kongre üyesinin "portföyü" ve "kurumu" başlığa girmez (25 Ekim kararı).
  assert.doesNotMatch(investorTitles("Nancy Pelosi", "ABD Temsilciler Meclisi", "congress", "tr").join(" "), /Portföy|Meclis/);
});

test("şirket bilanço sayfası (ölçülen 90): kısa kalıp, ~ ve Tahmini korunur", () => {
  const NAMES_TR = { afterClose: "Kapanış Sonrası", beforeOpen: "Açılış Öncesi", duringMarket: "Seans İçi" };
  const NAMES_EN = { afterClose: "After Close", beforeOpen: "Before Open", duringMarket: "During Market" };
  const title = (name: string, hour: string | null, locale: "tr" | "en") => {
    const when = companyWhen({ date: "2026-11-19", hour }, [], locale, locale === "tr" ? NAMES_TR : NAMES_EN);
    const copy = companyCopy({
      name,
      symbol: "X",
      when,
      dateLong: "19 Kasım Perşembe",
      dateShort: "19 Kasım",
      labels: (locale === "tr" ? earningsSeasonTr : earningsSeasonEn).company,
      windowLower: null,
    });
    return rendered([copy.metaTitle, copy.metaTitleShort], locale);
  };
  assert.equal(title("NVIDIA", "amc", "tr"), "NVIDIA Bilançosu Ne Zaman? 20 Kasım, ~00:00 TR · Açılış Zili");
  assert.equal(title("Nike", null, "tr"), "Nike Bilançosu Ne Zaman? 19 Kasım (Tahmini) · Açılış Zili");
  for (const name of ["NVIDIA", "Nike", "Advanced Micro Devices", "Home Depot", "Berkshire Hathaway"]) {
    for (const hour of ["amc", "bmo", "dmh", null]) {
      for (const locale of ["tr", "en"] as const) {
        const full = title(name, hour, locale);
        assert.ok(full.length <= TITLE_LIMIT, `${full} (${full.length})`);
        if (hour === "amc") assert.match(full, /~\d\d:\d\d/);
      }
    }
  }
});

/* ---- Teknik analiz ve bilanço raporu: h1 = aranan başlık ---- */

test("şirket adının kısa hâli: tüzel ek düşer, ad kalır", () => {
  assert.equal(shortCompanyName("NVIDIA Corp"), "NVIDIA");
  // Tek geçişte yalnız SONDAKİ ek düşer: "Technology" adın parçası kalır.
  assert.equal(shortCompanyName("Micron Technology Inc"), "Micron Technology");
  assert.equal(shortCompanyName("Arista Networks Holdings Inc"), "Arista Networks");
  assert.equal(shortCompanyName("Tesla, Inc."), "Tesla");
  assert.equal(shortCompanyName("Advanced Micro Devices Inc"), "Advanced Micro Devices");
  assert.equal(shortCompanyName("Palantir Technologies Inc"), "Palantir Technologies");
  assert.equal(shortCompanyName("Apple Inc"), "Apple");
  assert.equal(shortCompanyName(null), "");
  assert.equal(shortCompanyName("Intel"), "Intel");
});

test("teknik: h1, JSON-LD başlığı ve <title> aynı adı kullanır", () => {
  assert.equal(technicalHeading("NVIDIA Corp", "NVDA", "tr"), "NVIDIA (NVDA) Teknik Analiz");
  assert.equal(technicalHeading("NVIDIA Corp", "NVDA", "en"), "NVIDIA (NVDA) Technical Analysis");
  // Ad yoksa ya da sembolün kendisiyse parantez yok.
  assert.equal(technicalHeading(null, "MU", "tr"), "MU Teknik Analiz");
  assert.equal(technicalHeading("AMD Inc", "AMD", "tr"), "AMD Teknik Analiz");
  for (const locale of ["tr", "en"] as const) {
    const [first] = technicalTitles("NVIDIA Corp", "NVDA", locale);
    assert.ok(first.startsWith("NVIDIA (NVDA) "));
    for (const name of ["NVIDIA Corp", "Advanced Micro Devices Inc", "Taiwan Semiconductor Manufacturing Co Ltd", null]) {
      const full = rendered(technicalTitles(name, "TSM", locale), locale);
      assert.ok(full.length <= TITLE_LIMIT, `${full} (${full.length})`);
    }
  }
});

test("teknik h1 parçaları: görünen sembol + ekran dışı önü ve arkası = başlık", () => {
  for (const [name, symbol] of [["NVIDIA Corp", "NVDA"], [null, "MU"], ["AMD Inc", "AMD"], ["GE Vernova Inc", "GEV"], ["Meta Platforms Inc", "META"]] as const) {
    for (const locale of ["tr", "en"] as const) {
      const [before, after] = technicalHeadingParts(name, symbol, locale);
      assert.equal(before + symbol + after, technicalHeading(name, symbol, locale));
    }
  }
  assert.deepEqual(technicalHeadingParts("NVIDIA Corp", "NVDA", "tr"), ["NVIDIA (", ") Teknik Analiz"]);
});

test("bilanço raporu h1'i: ad + dönem + 'Bilanço Analizi'", () => {
  assert.equal(analysisHeading("NVIDIA", "1Ç FY2027", "tr"), "NVIDIA 1Ç FY2027 Bilanço Analizi");
  assert.equal(analysisHeading("NVIDIA", "Q1 FY2027", "en"), "NVIDIA Q1 FY2027 Earnings Analysis");
  // Kapak adı görünür basıyor, gerisini ekran dışı ekliyor: ad başta olmalı.
  assert.ok(analysisHeading("Nebius Group", "2Ç 2026", "tr").startsWith("Nebius Group "));
});
