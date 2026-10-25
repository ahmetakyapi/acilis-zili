import test from "node:test";
import assert from "node:assert/strict";

import { BROKERS } from "../content/brokers";
import { costLine } from "../lib/broker-line";
import {
  brokerCardView,
  brokerMonogram,
  brokersLead,
  brokersLeadFacts,
  CARD_FEATURES,
  COMPARE_MAX,
  featureMark,
  hasCaveat,
  parseCompare,
  pctDigits,
  sortCardIds,
  toggleCompare,
} from "../lib/broker-cards";
import { brokerCardsEn, brokerCardsTr } from "../lib/i18n/dictionaries/broker-cards";

/**
 * Aracı kurum kartları: durum işareti, sıralama, adresteki seçim ve tepe
 * cümlesi. Beklenen sayılar content/brokers.ts'teki tarifelerden.
 */

const ids = BROKERS.map((broker) => broker.id);
const money = (value: number, digits = 2) =>
  `${value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} $`;

test("featureMark: belirtilmemiş ✗ değildir, var/yok sorusu ✓ olur", () => {
  assert.equal(featureMark("fractional", { kind: "unspecified" }), "unspecified");
  assert.equal(featureMark("fractional", { kind: "value", value: { tr: "Var", en: "Yes" }, src: ["x"] }), "yes");
  assert.equal(
    featureMark("options", { kind: "value", value: { tr: "Yok", en: "No" }, src: ["x"], absent: true }),
    "no",
  );
  /* Tutar kalemi bir "var" değil, bir değer. */
  assert.equal(featureMark("minimum", { kind: "value", value: { tr: "1 $", en: "$1" }, src: ["x"] }), "value");
});

test("hiçbir hücre kaynağı olmadan ✗ almıyor; bugün ✗ yok", () => {
  for (const broker of BROKERS) {
    for (const column of CARD_FEATURES) {
      assert.notEqual(featureMark(column, broker.cells[column]), "no", `${broker.id}.${column}`);
    }
  }
});

test("kesirli hisse: 8 kurumun 3 tanesi kaynağında 'var' diyor", () => {
  const yes = BROKERS.filter((broker) => featureMark("fractional", broker.cells.fractional) === "yes").map((b) => b.id);
  assert.deepEqual(yes, ["midas", "yapi-kredi-yatirim", "interactive-brokers"]);
});

test("lisans rozeti yurt içi bayrağıyla ve hücre metniyle çelişmiyor", () => {
  for (const broker of BROKERS) {
    assert.equal(broker.licence === "foreign", !broker.domestic, broker.id);
    const cell = broker.cells.license;
    assert.equal(cell.kind, "value");
    if (cell.kind !== "value") continue;
    if (broker.licence === "full") assert.match(cell.value.tr, /Geniş Yetkili/, broker.id);
    if (broker.licence === "partial") assert.match(cell.value.tr, /Kısmi Yetkili/, broker.id);
    if (broker.licence === "foreign") assert.match(cell.value.tr, /SPK listesinde yok/, broker.id);
  }
});

test("baş harf rozeti: genel sözcük düşer, iki kurum aynı rozeti taşımaz", () => {
  assert.equal(brokerMonogram("İş Yatırım"), "İş");
  assert.equal(brokerMonogram("İnfo Yatırım"), "İn");
  assert.equal(brokerMonogram("Garanti BBVA Yatırım"), "GB");
  assert.equal(brokerMonogram("Interactive Brokers"), "IB");
  assert.equal(brokerMonogram("Midas"), "Mi");
  const all = BROKERS.map((broker) => brokerMonogram(broker.name));
  assert.equal(new Set(all).size, all.length, all.join(","));
});

test("kart görünümü: kaynak numaraları tablodakiyle aynı, okunma günü en eskisi", () => {
  const midas = BROKERS.find((broker) => broker.id === "midas")!;
  const view = brokerCardView(midas, "tr", "Kaynak {n}: {title}");
  assert.deepEqual(view.tariff.refs.map((ref) => ref.n), [1]);
  assert.equal(view.tariff.refs[0].href, "#kaynak-midas-1");
  assert.equal(view.tariff.refs[0].title, "Kaynak 1: Midas, Ücretler");
  assert.deepEqual(view.licenceRefs.map((ref) => ref.n), [5]);
  assert.deepEqual(view.rows.map((row) => row.column), [...CARD_FEATURES]);
  const w8 = view.rows.find((row) => row.column === "w8ben")!;
  assert.equal(w8.mark, "unspecified");
  assert.equal(w8.value, null);
  assert.match(w8.note ?? "", /%20/);
  assert.equal(view.checked, "2026-10-24");
  assert.equal(view.counterparty?.name, "Alpaca Securities LLC");
  assert.equal(brokerCardView(midas, "en", "Source {n}: {title}").rows[3].value, "Free");
});

test("hiçbir kart bağlantısı kurum sitesine gitmiyor: yalnız sayfa içi kaynak çapası", () => {
  for (const broker of BROKERS) {
    const view = brokerCardView(broker, "tr", "{n} {title}");
    const refs = [view.tariff, ...view.rows].flatMap((row) => row.refs).concat(view.licenceRefs);
    for (const ref of refs) assert.match(ref.href, /^#kaynak-/, `${broker.id} ${ref.href}`);
  }
});

test("sıralama: ad sırası dilin alfabesiyle (Türkçede I, İ'den önce), komisyon sırası eşitlikte ada, hesaplanamayan sonda", () => {
  const line = costLine(BROKERS, 1_000);
  assert.deepEqual(sortCardIds(BROKERS, "ad", line), [
    "garanti-bbva-yatirim",
    "gedik",
    "interactive-brokers",
    "info-yatirim",
    "is-yatirim",
    "midas",
    "qnb-invest",
    "yapi-kredi-yatirim",
  ]);
  /* İngilizcede İ, I'nın aksanlı hâli: İnfo, Interactive'den önce. */
  assert.deepEqual(sortCardIds(BROKERS, "ad", line, "en").slice(2, 4), ["info-yatirim", "interactive-brokers"]);
  assert.deepEqual(sortCardIds(BROKERS, "komisyon", line), [
    "gedik",
    "interactive-brokers",
    "midas",
    "is-yatirim",
    "garanti-bbva-yatirim",
    "qnb-invest",
    "info-yatirim",
    "yapi-kredi-yatirim",
  ]);
});

test("adresteki seçim: bilinmeyen ve yinelenen düşer, en çok üç, sıra korunur", () => {
  assert.deepEqual(parseCompare(null, ids), []);
  assert.deepEqual(parseCompare("gedik,midas", ids), ["gedik", "midas"]);
  assert.deepEqual(parseCompare("gedik,yok,gedik, midas", ids), ["gedik", "midas"]);
  assert.equal(parseCompare(ids.join(","), ids).length, COMPARE_MAX);
});

test("seçim değiştirme: ekler, çıkarır, doluyken değiştirmez", () => {
  assert.deepEqual(toggleCompare([], "midas"), ["midas"]);
  assert.deepEqual(toggleCompare(["midas", "gedik"], "midas"), ["gedik"]);
  const full = ["midas", "gedik", "qnb-invest"];
  assert.deepEqual(toggleCompare(full, "is-yatirim"), full);
});

test("tepe cümlesi: 1.000 $'da 1 $ ile 25 $, kesirli 3/8, iki kurum hesaplanmadı", () => {
  const facts = brokersLeadFacts(BROKERS, costLine(BROKERS, 1_000));
  assert.deepEqual(facts, { amount: 1000, min: 1, max: 25, total: 8, fractional: 3, unpriced: 2 });
  assert.equal(
    brokersLead(facts, brokerCardsTr.lead, money),
    "1.000 $ tutarındaki tek alımda komisyon 1,00 $ ile 25,00 $ arasında değişiyor; 8 kurumun 3 tanesi kesirli hisse sunduğunu yazıyor. 2 kurumun tarifesinden tek bir komisyon çıkmıyor.",
  );
  assert.match(brokersLead({ ...facts, unpriced: 1 }, brokerCardsEn.lead, money) ?? "", /1 broker's fee schedule/);
  assert.match(brokersLead({ ...facts, max: 1 }, brokerCardsTr.lead, money) ?? "", /bütün kurumların komisyonu 1,00 \$/);
  assert.equal(brokersLead({ ...facts, min: null, max: null }, brokerCardsTr.lead, money), null);
});

test("oran ondalığı: binde birin altı sıfıra yuvarlanmıyor", () => {
  assert.equal(pctDigits((1.5 / 50_000) * 100), 3);
  assert.equal(pctDigits(0.25), 2);
  assert.equal(pctDigits(0), 2);
});

test("dürüstlük notu: çelişen, birimi belirsiz, oranı eksik ya da şirketi yazmayan kart işaretli", () => {
  const flagged = BROKERS.filter(hasCaveat).map((broker) => broker.id);
  assert.deepEqual(flagged, ["yapi-kredi-yatirim", "gedik", "info-yatirim", "interactive-brokers"]);
});
