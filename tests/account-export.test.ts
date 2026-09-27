import test from "node:test";
import assert from "node:assert/strict";
import {
  accountExportCsv,
  csvCell,
  exportFileName,
  type AccountExport,
} from "../lib/account-export-format";

/** Verilerimi İndir — CSV biçimi ve kaçışı (lib/account-export-format.ts). */

const SAMPLE: AccountExport = {
  format: "acilis-zili/account-export",
  version: 1,
  exportedAt: "2026-09-28T10:00:00.000Z",
  account: {
    username: "okur",
    email: "okur@example.com",
    locale: "tr",
    theme: "light",
    createdAt: "2026-08-01T10:00:00.000Z",
    lastSeenAt: null,
  },
  avatar: null,
  portfolio: null,
  watchlists: [
    {
      name: "Büyüme, Teknoloji",
      color: "primary",
      sortOrder: 0,
      createdAt: "2026-08-01T10:00:00.000Z",
      items: [
        { symbol: "NVDA", note: 'Hedef "200"', sortOrder: 0, addedAt: "2026-08-02T10:00:00.000Z" },
        { symbol: "AMD", note: "=HYPERLINK(\"x\")", sortOrder: 1, addedAt: "2026-08-03T10:00:00.000Z" },
      ],
    },
    { name: "Boş", color: "brass", sortOrder: 1, createdAt: "2026-08-05T10:00:00.000Z", items: [] },
  ],
};

test("virgül ve tırnak RFC 4180'e göre kaçıyor", () => {
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('Hedef "200"'), '"Hedef ""200"""');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(3), "3");
});

test("formül gibi başlayan not metin olarak kalıyor", () => {
  assert.equal(csvCell("=1+1"), "'=1+1");
  assert.equal(csvCell("-5"), "'-5");
  assert.equal(csvCell(-5), "-5");
});

test("her sembol bir satır, boş liste sembolsüz bir satır, BOM başta", () => {
  const csv = accountExportCsv(SAMPLE);
  assert.ok(csv.startsWith("﻿list_name,"));
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 4);
  assert.equal(lines[1], '"Büyüme, Teknoloji",primary,0,NVDA,"Hedef ""200""",0,2026-08-02T10:00:00.000Z');
  assert.ok(lines[2].includes(`"'=HYPERLINK(""x"")"`));
  assert.equal(lines[3], "Boş,brass,1,,,,");
});

test("dosya adı günü taşıyor", () => {
  assert.equal(exportFileName("2026-09-28", "csv"), "acilis-zili-verilerim-2026-09-28.csv");
});
