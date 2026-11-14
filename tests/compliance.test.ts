import test from "node:test";
import assert from "node:assert/strict";

import { ALL_MEMBERS, indexMemberOf } from "../db/seed/indices";
import { COMPLIANCE_THRESHOLD, screenCompliance } from "../lib/compliance";

/**
 * Katılım ön taraması. Kartın üç hükmü var ve yanlış olanı sessizdir:
 * elenmesi gereken şirkete "geçiyor" demek taramanın var olma sebebini
 * boşa çıkarır; verisi olmayana "geçiyor" demek uydurma kesinliktir.
 *
 * Beklentiler `lib/compliance.ts`nin başlık yorumundan ve tip
 * künyelerindeki karar kayıtlarından (DKNG/SOFI, SKHY/PDD/TSM, BRK.B).
 */

type Inputs = Parameters<typeof screenCompliance>[0];

/** Her iki oranı da eşiğin çok altında, temiz bir dolar hissesi. */
const CLEAN: Omit<Inputs, "symbol"> = {
  price: 100,
  currency: "USD",
  bookValuePerShare: 10,
  debtToEquity: 0.5, // borç/PD %5
  cashPerShare: 4, // nakit/PD %4
  low52: 80,
  high52: 120,
};

const screen = (symbol: string, over: Partial<Inputs> = {}) =>
  screenCompliance({ symbol, ...CLEAN, ...over });

/** Tohumda alt sektörü temiz (elenmeyen, gri olmayan) bir hisse. */
const PLAIN = "MSFT";
/** Tohumda HİÇ olmayan sembol. */
const UNKNOWN = "ZZZYOK";

test("varsayım: örnek semboller tohumda beklenen alt sektörde", () => {
  assert.equal(indexMemberOf(PLAIN)?.sub, "Systems Software");
  assert.equal(indexMemberOf(UNKNOWN), null);
  assert.equal(COMPLIANCE_THRESHOLD, 33);
});

test("temiz hisse: geçiyor, oranlar hesaplanmış", () => {
  const result = screen(PLAIN);
  assert.equal(result.verdict, "pass");
  assert.equal(result.businessReasonKey, null);
  assert.equal(result.ratiosKnown, true);
  assert.equal(result.businessKnown, true);
  assert.ok(Math.abs(result.debtRatio! - 5) < 1e-9, `borç oranı ${result.debtRatio}`);
  assert.ok(Math.abs(result.cashRatio! - 4) < 1e-9, `nakit oranı ${result.cashRatio}`);
});

/* ---- A. Faaliyet alanı ---- */

const EXCLUDED_EXAMPLES: [symbol: string, sub: string, reason: string][] = [
  ["JPM", "Diversified Banks", "banking"],
  ["KEY", "Regional Banks", "banking"],
  ["COF", "Consumer Finance", "banking"],
  ["FIS", "Transaction & Payment Processing Services", "banking"],
  ["CME", "Financial Exchanges & Data", "banking"],
  ["BLK", "Asset Management & Custody Banks", "banking"],
  ["GS", "Investment Banking & Brokerage", "banking"],
  ["BRK.B", "Multi-Sector Holdings", "banking"],
  ["AON", "Insurance Brokers", "insurance"],
  ["AFL", "Life & Health Insurance", "insurance"],
  ["AIG", "Multi-line Insurance", "insurance"],
  ["ALL", "Property & Casualty Insurance", "insurance"],
  ["EG", "Reinsurance", "insurance"],
  ["TAP", "Brewers", "alcohol"],
  ["STZ", "Distillers & Vintners", "alcohol"],
  ["MO", "Tobacco", "tobacco"],
  ["LVS", "Casinos & Gaming", "gambling"],
  ["GD", "Aerospace & Defense", "weapons"],
];

for (const [symbol, sub, reason] of EXCLUDED_EXAMPLES) {
  test(`elenen alt sektör: ${sub} (${symbol}) → geçemiyor, gerekçe ${reason}`, () => {
    assert.equal(indexMemberOf(symbol)?.sub, sub, "tohum değişmiş: örnek sembolü güncelle");
    const result = screen(symbol);
    assert.equal(result.verdict, "fail");
    assert.equal(result.businessReasonKey, reason);
    assert.equal(result.businessKnown, true);
  });
}

test("elenen alanda oranlar temiz olsa da, hiç olmasa da hüküm aynı", () => {
  const withRatios = screen("JPM");
  assert.equal(withRatios.verdict, "fail");
  assert.equal(withRatios.ratiosKnown, true);

  const noData = screenCompliance({
    symbol: "JPM",
    price: null,
    currency: null,
    bookValuePerShare: null,
    debtToEquity: null,
    cashPerShare: null,
    low52: null,
    high52: null,
  });
  assert.equal(noData.verdict, "fail");
  assert.equal(noData.businessReasonKey, "banking");
  assert.equal(noData.ratiosKnown, false);
  assert.equal(noData.debtRatio, null);
  assert.equal(noData.cashRatio, null);
});

test("tohumdaki HER elenen alt sektör üyesi: temiz oranlarla bile 'geçiyor' almaz", () => {
  const excluded = new Set(EXCLUDED_EXAMPLES.map(([, sub]) => sub));
  const members = ALL_MEMBERS.filter((member) => member.sub && excluded.has(member.sub));
  assert.ok(members.length > 50, `beklenenden az üye: ${members.length}`);
  const wrong = members.filter((member) => screen(member.symbol).verdict !== "fail").map((m) => m.symbol);
  assert.deepEqual(wrong, []);
});

const REVIEW_EXAMPLES: [symbol: string, sub: string, reason: string | null][] = [
  ["DIS", "Movies & Entertainment", "adult"],
  ["HRL", "Packaged Foods & Meats", "pork"],
  ["MCD", "Restaurants", null],
  ["HLT", "Hotels, Resorts & Cruise Lines", null],
  ["FOXA", "Broadcasting", null],
  ["META", "Interactive Media & Services", null],
];

for (const [symbol, sub, reason] of REVIEW_EXAMPLES) {
  test(`gri alt sektör: ${sub} (${symbol}) → inceleme, elenmez ama geçmez`, () => {
    assert.equal(indexMemberOf(symbol)?.sub, sub, "tohum değişmiş: örnek sembolü güncelle");
    const result = screen(symbol);
    assert.equal(result.verdict, "review");
    assert.equal(result.businessReasonKey, reason);
    assert.equal(result.businessKnown, true);
    assert.equal(result.ratiosKnown, true);
  });
}

test("gri alanda finansal eşik aşılırsa yine geçemiyor, gerekçe faaliyet değil", () => {
  const result = screen("DIS", { cashPerShare: 40 });
  assert.equal(result.verdict, "fail");
  assert.equal(result.businessReasonKey, null);
});

test("tohumun tamamı: 'geçiyor' alan hiçbir hisse elenen ya da gri alt sektörde değil", () => {
  const flagged = new Set([...EXCLUDED_EXAMPLES, ...REVIEW_EXAMPLES].map(([, sub]) => sub));
  const leaked = ALL_MEMBERS.filter(
    (member) => screen(member.symbol).verdict === "pass" && (!member.sub || flagged.has(member.sub)),
  ).map((member) => `${member.symbol} (${member.sub ?? "alt sektör yok"})`);
  assert.deepEqual(leaked, []);
});

/* ---- Alt sektör bilinmiyor: DKNG / SOFI vakası ---- */

test("alt sektörü bilinmeyen sembol temiz oranlarla bile 'geçiyor' almaz", () => {
  const result = screen(UNKNOWN);
  assert.equal(result.verdict, "review");
  assert.equal(result.businessKnown, false);
  assert.equal(result.businessReasonKey, null);
  assert.equal(result.ratiosKnown, true, "oranlar hesaplandı; eksik olan A kriteri");
});

for (const symbol of ["DKNG", "SOFI"]) {
  test(`${symbol}: bahis/faizli kredi vakası — 'Ön Elemeyi Geçiyor' DENMEZ`, () => {
    const result = screen(symbol);
    assert.notEqual(result.verdict, "pass");
    if (indexMemberOf(symbol) === null) {
      /* Bugünkü durum: tohumda yok, alt sektör bilinmiyor. */
      assert.equal(result.verdict, "review");
      assert.equal(result.businessKnown, false);
    } else {
      /* Tohuma girerse alt sektörü gereği elenmeli. */
      assert.equal(result.verdict, "fail");
      assert.notEqual(result.businessReasonKey, null);
    }
  });
}

test("alt sektör bilinmiyor ama finansal eşik aşılmış: geçemiyor (eşik A'dan bağımsız)", () => {
  const result = screen(UNKNOWN, { bookValuePerShare: 50, debtToEquity: 1 });
  assert.equal(result.verdict, "fail");
  assert.equal(result.businessKnown, false);
  assert.equal(result.businessReasonKey, null);
});

test("sembol eşleşmesi birebir: küçük harf ya da farklı yazım 'bilinmiyor'dur, geçmez", () => {
  assert.equal(screen("jpm").verdict, "review");
  assert.equal(screen("jpm").businessKnown, false);
  assert.equal(screen("BRK-B").businessKnown, false);
  assert.notEqual(screen("BRK-B").verdict, "pass");
});

/* ---- B ve C. %33 eşikleri ---- */

/* fiyat 100 ve borç/özkaynak 1: defter değeri doğrudan borç yüzdesi. */
const debt = (pct: number) => screen(PLAIN, { price: 100, bookValuePerShare: pct, debtToEquity: 1 });
const cash = (pct: number) => screen(PLAIN, { price: 100, cashPerShare: pct });

test("borç eşiği: hemen altı geçer", () => {
  const result = debt(32.99);
  assert.equal(result.verdict, "pass");
  assert.ok(result.debtRatio! < COMPLIANCE_THRESHOLD);
});

test("borç eşiği: TAM %33 geçemez (kural '< %33')", () => {
  const result = debt(33);
  assert.equal(result.debtRatio, 33);
  assert.equal(result.verdict, "fail");
  assert.equal(result.businessReasonKey, null);
});

test("borç eşiği: hemen üstü geçemez", () => {
  assert.equal(debt(33.01).verdict, "fail");
});

test("nakit eşiği: hemen altı geçer", () => {
  const result = cash(32.99);
  assert.equal(result.verdict, "pass");
  assert.ok(result.cashRatio! < COMPLIANCE_THRESHOLD);
});

test("nakit eşiği: TAM %33 geçemez (kural '< %33')", () => {
  const result = cash(33);
  assert.equal(result.cashRatio, 33);
  assert.equal(result.verdict, "fail");
  assert.equal(result.businessReasonKey, null);
});

test("nakit eşiği: hemen üstü geçemez", () => {
  assert.equal(cash(33.01).verdict, "fail");
});

test("eşikler ayrı ayrı uygulanır: biri aşılmışsa öteki temiz olsa da geçemez", () => {
  assert.equal(screen(PLAIN, { bookValuePerShare: 50, debtToEquity: 1, cashPerShare: 0 }).verdict, "fail");
  assert.equal(screen(PLAIN, { bookValuePerShare: 1, debtToEquity: 0, cashPerShare: 50 }).verdict, "fail");
});

test("iki oran da eşiğin hemen altında: geçer (oranlar toplanmaz)", () => {
  const result = screen(PLAIN, { price: 100, bookValuePerShare: 32.99, debtToEquity: 1, cashPerShare: 32.99 });
  assert.equal(result.verdict, "pass");
});

test("borçsuz ve nakitsiz şirket: %0 bilinen bir orandır, geçer", () => {
  const result = screen(PLAIN, { debtToEquity: 0, cashPerShare: 0 });
  assert.equal(result.debtRatio, 0);
  assert.equal(result.cashRatio, 0);
  assert.equal(result.ratiosKnown, true);
  assert.equal(result.verdict, "pass");
});

test("oran fiyata göre: aynı bilanço, fiyat düşünce eşiği aşar", () => {
  const inputs = { bookValuePerShare: 30, debtToEquity: 1, cashPerShare: 0, low52: 50, high52: 120 };
  assert.equal(screen(PLAIN, { ...inputs, price: 100 }).verdict, "pass");
  assert.equal(screen(PLAIN, { ...inputs, price: 80 }).verdict, "fail");
});

/* ---- Eksik veri ---- */

test("fiyat yok: oranlar hesaplanmaz, inceleme", () => {
  for (const price of [null, 0, -5]) {
    const result = screen(PLAIN, { price });
    assert.equal(result.verdict, "review", `fiyat ${price}`);
    assert.equal(result.ratiosKnown, false);
    assert.equal(result.debtRatio, null);
    assert.equal(result.cashRatio, null);
  }
});

test("nakit ölçüsü yok: borç temiz olsa da 'geçiyor' denmez", () => {
  const result = screen(PLAIN, { cashPerShare: null });
  assert.equal(result.verdict, "review");
  assert.equal(result.ratiosKnown, false);
  assert.equal(result.cashRatio, null);
  assert.notEqual(result.debtRatio, null);
});

test("borç ölçülerinden biri yok: nakit temiz olsa da 'geçiyor' denmez", () => {
  for (const over of [{ bookValuePerShare: null }, { debtToEquity: null }]) {
    const result = screen(PLAIN, over);
    assert.equal(result.verdict, "review");
    assert.equal(result.ratiosKnown, false);
    assert.equal(result.debtRatio, null);
    assert.notEqual(result.cashRatio, null);
  }
});

test("eksi ya da sıfır defter değeri: borç oranı uydurulmaz, inceleme", () => {
  for (const bookValuePerShare of [0, -12]) {
    const result = screen(PLAIN, { bookValuePerShare, debtToEquity: 2 });
    assert.equal(result.debtRatio, null, `defter değeri ${bookValuePerShare}`);
    assert.equal(result.verdict, "review");
  }
});

test("yarım veride bilinen oran eşiği aşıyorsa hüküm yine geçemiyor", () => {
  const result = screen(PLAIN, { bookValuePerShare: null, cashPerShare: 40 });
  assert.equal(result.verdict, "fail");
  assert.equal(result.ratiosKnown, false);
});

test("hiç veri yok, alt sektör de bilinmiyor: inceleme", () => {
  const result = screenCompliance({
    symbol: UNKNOWN,
    price: null,
    currency: null,
    bookValuePerShare: null,
    debtToEquity: null,
    cashPerShare: null,
    low52: null,
    high52: null,
  });
  assert.deepEqual(result, {
    verdict: "review",
    businessReasonKey: null,
    debtRatio: null,
    cashRatio: null,
    ratiosKnown: false,
    businessKnown: false,
  });
});

/* ---- Para birimi kapısı (SKHY / PDD / NTES / TSM vakası) ---- */

test("USD dışı para birimi: oran hesaplanmaz, ne geçer ne elenir", () => {
  /* KRW ölçüleri dolar fiyatına bölünürse nakit/PD %47.685 çıkıyordu. */
  for (const currency of ["KRW", "CNY", "TWD", "EUR"]) {
    const result = screen(PLAIN, { currency, cashPerShare: 47_685, bookValuePerShare: 90_000 });
    assert.equal(result.verdict, "review", currency);
    assert.equal(result.debtRatio, null);
    assert.equal(result.cashRatio, null);
    assert.equal(result.ratiosKnown, false);
  }
});

test("para birimi bilinmiyorsa (null) USD varsayılmaz", () => {
  const result = screen(PLAIN, { currency: null });
  assert.equal(result.verdict, "review");
  assert.equal(result.ratiosKnown, false);
});

test("para birimi kodu birebir 'USD': küçük harf USD sayılmaz, uydurma oran çıkmaz", () => {
  const result = screen(PLAIN, { currency: "usd" });
  assert.equal(result.ratiosKnown, false);
  assert.notEqual(result.verdict, "pass");
});

test("USD dışı hisse elenen alandaysa faaliyetten yine elenir", () => {
  const result = screen("JPM", { currency: "EUR" });
  assert.equal(result.verdict, "fail");
  assert.equal(result.businessReasonKey, "banking");
});

/* ---- Ölçüler bu hisseye mi ait (BRK.B vakası) ---- */

test("fiyat 52 hafta bandının çok dışındaysa ölçüler kullanılmaz: haksız 'geçemiyor' yok", () => {
  /* BRK.B: fiyat 506 $, sağlayıcının bandı A sınıfının 698.000–806.102 $. */
  const result = screen(PLAIN, {
    price: 506,
    low52: 698_000,
    high52: 806_102,
    bookValuePerShare: 440_000,
    debtToEquity: 0.2,
    cashPerShare: 28_000,
  });
  assert.equal(result.debtRatio, null);
  assert.equal(result.cashRatio, null);
  assert.equal(result.ratiosKnown, false);
  assert.equal(result.verdict, "review");
});

test("band yoksa sınama yapılamaz: oranlar yine hesaplanır", () => {
  for (const over of [{ low52: null, high52: null }, { low52: null }, { high52: null }]) {
    const result = screen(PLAIN, over);
    assert.equal(result.ratiosKnown, true);
    assert.equal(result.verdict, "pass");
  }
});

test("band payı %30: gün içi taşma ölçüleri geçersiz kılmaz", () => {
  assert.equal(screen(PLAIN, { price: 100, low52: 110, high52: 140 }).ratiosKnown, true, "bandın %10 altı");
  assert.equal(screen(PLAIN, { price: 100, low52: 60, high52: 90 }).ratiosKnown, true, "bandın %11 üstü");
  assert.equal(screen(PLAIN, { price: 100, low52: 200, high52: 300 }).ratiosKnown, false, "bandın yarısı");
  assert.equal(screen(PLAIN, { price: 100, low52: 20, high52: 50 }).ratiosKnown, false, "bandın iki katı");
});
