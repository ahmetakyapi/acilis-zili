import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INDEXNOW_KEY, analysisChanged, firstEditionSymbols, indexNowBody, indexNowUrls } from "../lib/indexnow";
import { SITE_URL } from "../lib/site";

test("IndexNow adresleri: yol × dil, tekrarsız ve dil önekli", () => {
  const urls = indexNowUrls(["/mercek/ornek", "/mercek/ornek"], ["tr", "en"]);
  assert.deepEqual(urls, [`${SITE_URL}/en/mercek/ornek`, `${SITE_URL}/mercek/ornek`].sort());
});

test("IndexNow gövdesi protokolün dört alanını taşır", () => {
  const body = indexNowBody([`${SITE_URL}/mercek/ornek`]);
  assert.equal(body.host, new URL(SITE_URL).host);
  assert.equal(body.key, INDEXNOW_KEY);
  assert.equal(body.keyLocation, `${SITE_URL}/${INDEXNOW_KEY}.txt`);
  assert.deepEqual(body.urlList, [`${SITE_URL}/mercek/ornek`]);
});

test("anahtar dosyası public/ altında ve içeriği anahtarın kendisi", () => {
  assert.equal(readFileSync(`public/${INDEXNOW_KEY}.txt`, "utf8").trim(), INDEXNOW_KEY);
});

/* ---- 14 Kasım: bilanço analizi ve teknik analiz kapsamda ---- */

const ANALYSIS = {
  headline: "Gelir beklentiyi aştı",
  summary: ["Gelir yıllık %20 arttı."],
  analysis: [{ title: "Gelir", body: "Veri merkezi büyüdü." }],
  verdict: "AL",
  score: 78,
};

test("bilanço analizi: yeni kayıt ve değişen metin bildirilir, aynı gövde bildirilmez", () => {
  assert.equal(analysisChanged(null, ANALYSIS), true);
  assert.equal(analysisChanged(undefined, ANALYSIS), true);
  // Rutinin aynı gövdeyi yeniden göndermesi (yeni nesne, aynı içerik).
  assert.equal(analysisChanged(structuredClone(ANALYSIS), ANALYSIS), false);
  assert.equal(analysisChanged({ ...ANALYSIS, headline: "Başka" }, ANALYSIS), true);
  assert.equal(analysisChanged({ ...ANALYSIS, summary: ["Başka."] }, ANALYSIS), true);
  assert.equal(analysisChanged({ ...ANALYSIS, analysis: [] }, ANALYSIS), true);
  assert.equal(analysisChanged({ ...ANALYSIS, verdict: "TUT" }, ANALYSIS), true);
  assert.equal(analysisChanged({ ...ANALYSIS, score: 70 }, ANALYSIS), true);
});

test("teknik analiz: sembol başına günde en çok bir bildirim", () => {
  // İlk nöbet: o gün hiçbirinin yayını yok, hepsi bildirilir.
  assert.deepEqual(firstEditionSymbols(["NVDA", "AMD", "MU"], new Set()), ["NVDA", "AMD", "MU"]);
  // İkinci nöbet: aynı semboller yeniden yazılıyor, bildirim yok.
  assert.deepEqual(firstEditionSymbols(["NVDA", "AMD", "MU"], new Set(["NVDA", "AMD", "MU"])), []);
  // Sonradan eklenen sembol o gün ilk kez yazılıyor.
  assert.deepEqual(firstEditionSymbols(["NVDA", "TSLA"], new Set(["NVDA"])), ["TSLA"]);
  // Aynı koşuda tekrar eden sembol bir kez.
  assert.deepEqual(firstEditionSymbols(["NVDA", "NVDA"], new Set()), ["NVDA"]);
});
