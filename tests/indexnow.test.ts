import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INDEXNOW_KEY, indexNowBody, indexNowUrls } from "../lib/indexnow";
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
