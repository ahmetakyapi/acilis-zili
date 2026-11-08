import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { dailyCharts, stories } from "../lib/schema";
import {
  damgaBeklentisi,
  damgaEsit,
  nextAuthor,
  type ContentType,
  type DailyChartSource,
} from "../lib/content-write";

/* Künye devri (`nextAuthor`) ve koşullu yazmanın saf parçaları (8 Kasım,
   durum taraması 3 ve 6). Veritabanı yok: SQL metni Drizzle'ın kendi
   lehçesiyle çıkarılıp okunuyor. */

type Satir = [ContentType, string | null, DailyChartSource, string];

const TABLO: Satir[] = [
  /* mercek: yalnız ilk yazımda, hiç devrilmez */
  ["mercek", null, "claude", "claude"],
  ["mercek", null, "admin", "admin"],
  ["mercek", "claude", "admin", "claude"],
  ["mercek", "admin", "claude", "admin"],
  ["mercek", "claude", "claude", "claude"],
  /* bülten: rutin her yazımda devralır, panel hiç */
  ["bulten", null, "claude", "claude"],
  ["bulten", null, "admin", "admin"],
  ["bulten", "rules", "claude", "claude"],
  ["bulten", "admin", "claude", "claude"],
  ["bulten", "rules", "admin", "rules"],
  ["bulten", "claude", "admin", "claude"],
  /* grafik: yalnız yedek devrilir, yalnız rutin devralır */
  ["grafik", null, "auto", "auto"],
  ["grafik", null, "claude", "claude"],
  ["grafik", null, "admin", "admin"],
  ["grafik", "auto", "claude", "claude"],
  ["grafik", "auto", "admin", "auto"],
  ["grafik", "auto", "auto", "auto"],
  ["grafik", "claude", "admin", "claude"],
  ["grafik", "admin", "claude", "admin"],
];

for (const [tur, current, source, beklenen] of TABLO) {
  test(`nextAuthor: ${tur} · ${current ?? "yeni"} + ${source} → ${beklenen}`, () => {
    assert.equal(nextAuthor(tur, current, source), beklenen);
  });
}

test("panelin yedek düzeltmesi rutini susturmaz: künye auto kalır, bağlam onu yazılmamış görür", () => {
  /* `/api/grafik/context` → existing_locales auto dilleri hariç tutuyor. */
  const kunye = nextAuthor("grafik", "auto", "admin");
  assert.equal(kunye, "auto");
  const satirlar = [{ locale: "tr", generatedBy: kunye }, { locale: "en", generatedBy: "claude" }];
  const autoLocales = satirlar.filter((s) => s.generatedBy === "auto").map((s) => s.locale);
  const existing = satirlar.map((s) => s.locale).filter((l) => !autoLocales.includes(l));
  assert.deepEqual(existing, ["en"]);
  assert.deepEqual(autoLocales, ["tr"]);
});

test("damgaBeklentisi: boş dize yeni kayıt, kanonik ISO damga, gerisi çakışma", () => {
  assert.deepEqual(damgaBeklentisi(""), { yeni: true });
  assert.deepEqual(damgaBeklentisi("2026-11-08T10:00:00.123Z"), { yeni: false, iso: "2026-11-08T10:00:00.123Z" });
  for (const bozuk of ["dün", "2026-11-08", "2026-11-08T10:00:00Z", "2026-11-08T10:00:00.123+03:00", "0", "x'; drop"]) {
    assert.equal(damgaBeklentisi(bozuk), null, bozuk);
  }
});

test("damgaEsit: sütun milisaniyeye kırpılıp parametreyle karşılaştırılır", () => {
  const dialect = new PgDialect();
  const story = dialect.sqlToQuery(damgaEsit(stories.updatedAt, "2026-11-08T10:00:00.123Z"));
  assert.equal(story.sql, `date_trunc('milliseconds', "stories"."updated_at") = $1::timestamptz`);
  assert.deepEqual(story.params, ["2026-11-08T10:00:00.123Z"]);
  const chart = dialect.sqlToQuery(damgaEsit(dailyCharts.updatedAt, "2026-11-08T10:00:00.123Z"));
  assert.match(chart.sql, /date_trunc\('milliseconds', "daily_charts"\."updated_at"\)/);
});

test("okuma yolu mikrosaniyeyi keser (yuvarlamaz) — date_trunc ile aynı değer", () => {
  /* neon-http damgayı dize döndürüyor, Drizzle `new Date(dize)` diyor. */
  const okunan = stories.updatedAt.mapFromDriverValue("2026-11-08 10:00:00.123999+00") as Date;
  assert.equal(okunan.toISOString(), "2026-11-08T10:00:00.123Z");
  assert.equal(
    (stories.updatedAt.mapFromDriverValue("2026-11-08 12:59:59.9999+03") as Date).toISOString(),
    "2026-11-08T09:59:59.999Z",
  );
});
