import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SIGN_GAP,
  etDateParts,
  formatChange,
  formatCompact,
  formatEtDateCompact,
  formatEtDateLong,
  formatEtDateMedium,
  formatPercent,
  formatPercentPlain,
  formatPeriodLabel,
  formatPrice,
  formatVolume,
  staleMark,
} from "../lib/utils";

/**
 * Intl biçimlendirici önbelleği (lib/utils.ts → numberFormat / dateFormat,
 * 20 Ekim): çıktı, her çağrıda TAZE kurulan biçimlendiriciyle bayt bayt aynı
 * kalmalı. Referanslar önbellek öncesi kodun seçeneklerini birebir kurar;
 * çağrılar dil ve hane sayısı karışık sırayla gelir — yanlış bir anahtar bir
 * dilin biçimini ötekine sızdırırsa burada görünür.
 */
const tag = (locale: string) => (locale === "tr" ? "tr-TR" : "en-US");
const fresh = (locale: string, digits: number) =>
  new Intl.NumberFormat(tag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (body: string, locale: string, sign: string) => {
  const lead = sign ? `${sign}${SIGN_GAP}` : "";
  return locale === "tr" ? `${lead}%${body}` : `${lead}${body}%`;
};
const signOf = (value: number) => (value > 0 ? "+" : value < 0 ? "−" : "");

const VALUES = [
  0, 1, -1, 0.004, 0.005, 0.015, 0.125, 1.005, 2.675, 9.995, 99.95, 999.995, 1234.5678, -1234.5678,
  999_500, 3.21e9, -54.3e9, 875e9, 1.11e12, 123456789.987,
];
const LOCALES = ["tr", "en", "de"];

test("sayı biçimleri taze Intl ile aynı (dil ve hane karışık sırada)", () => {
  for (const value of VALUES) {
    for (const locale of LOCALES) {
      for (const digits of [2, 0, 4, 1]) {
        const nf = fresh(locale, digits);
        assert.equal(formatPrice(value, locale, { digits }), nf.format(value));
        assert.equal(formatPercent(value, locale, digits), percent(nf.format(Math.abs(value)), locale, signOf(value)));
        assert.equal(formatPercentPlain(value, locale, digits), percent(nf.format(Math.abs(value)), locale, ""));
      }
      const two = fresh(locale, 2).format(Math.abs(value));
      assert.equal(formatChange(value, locale), signOf(value) ? `${signOf(value)}${SIGN_GAP}${two}` : two);
      assert.equal(
        formatVolume(value, locale),
        new Intl.NumberFormat(tag(locale), { maximumFractionDigits: 0 }).format(value),
      );
    }
  }
});

test("kısaltılmış tutar: üç anlamlı hane, iki dil", () => {
  const tr = [1e12, 4.32e12, 875e9, 54.3e9, 3.21e9, 612e6, 999.996e9].map((v) => formatCompact(v, "tr"));
  assert.deepEqual(tr, ["1,00 T", "4,32 T", "875 Mr", "54,3 Mr", "3,21 Mr", "612 Mn", "1,00 T"]);
  assert.equal(formatCompact(54.3e9, "en"), "54.3 B");
  assert.equal(formatCompact(12.5, "tr"), "12,5");
});

test("tarih biçimleri taze Intl ile aynı", () => {
  const utc = (locale: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(tag(locale), { ...options, timeZone: "UTC" });
  for (let month = 1; month <= 12; month += 1) {
    for (const day of [1, 9, 28]) {
      const ds = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const at = new Date(`${ds}T12:00:00Z`);
      for (const locale of LOCALES) {
        const long =
          locale === "tr"
            ? `${utc("tr", { day: "numeric", month: "long" }).format(at)} ${utc("tr", { weekday: "long" }).format(at)}`
            : utc(locale, { weekday: "long", month: "long", day: "numeric" }).format(at);
        assert.equal(formatEtDateLong(ds, locale), long);
        assert.equal(formatEtDateMedium(ds, locale), utc(locale, { day: "numeric", month: "short", year: "numeric" }).format(at));
        assert.equal(formatEtDateCompact(ds, locale), utc(locale, { day: "numeric", month: "short" }).format(at));
        const parts = utc(locale, { day: "numeric", month: "short" }).formatToParts(at);
        assert.deepEqual(etDateParts(ds, locale), {
          day: parts.find((p) => p.type === "day")?.value ?? "",
          month: parts.find((p) => p.type === "month")?.value.replace(/\.$/, "") ?? "",
        });
        assert.equal(
          formatPeriodLabel(ds.slice(0, 7), locale),
          utc(locale, { month: "long", year: "numeric" }).format(new Date(`${ds.slice(0, 7)}-15T12:00:00Z`)),
        );
      }
    }
  }
  assert.equal(formatEtDateLong("2026-08-06", "tr"), "6 Ağustos Perşembe");
  assert.equal(formatEtDateLong("2026-08-06", "en"), "Thursday, August 6");
});

test("bayat işareti: İstanbul günü, tarih dile göre", () => {
  const at = new Date("2026-10-18T21:30:00Z"); // İstanbul'da 19 Ekim 00:30
  assert.equal(staleMark("Eski", at, "tr", new Date("2026-10-19T08:00:00Z")), "Eski");
  assert.equal(staleMark("Eski", at, "tr", new Date("2026-10-20T08:00:00Z")), "Eski · 19 Eki");
  assert.equal(staleMark("Stale", at, "en", new Date("2026-10-20T08:00:00Z")), "Stale · Oct 19");
});
