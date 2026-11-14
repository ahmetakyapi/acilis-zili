import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIcs,
  escapeIcsText,
  foldIcsLine,
  FOLD_LIMIT,
  type IcsEvent,
} from "../lib/ics";

/**
 * `.ics` üreticisinin saf katmanı. Her test bir takvim uygulamasında
 * görülebilecek bozulmaya karşılık geliyor: sınırı aşan satır (Outlook
 * dosyayı reddeder), ortadan bölünen harf, kaçmayan virgül, açıklamanın
 * içinden sızan yeni özellik, dengesiz BEGIN/END.
 */

const octets = (line: string) => Buffer.byteLength(line, "utf8");

/** Katlanmış gövdeyi RFC 5545 § 3.1'e göre geri açar. */
const unfold = (text: string) => text.replace(/\r\n /g, "");

const NOW = new Date("2026-11-14T12:00:00Z");

const timed: IcsEvent = {
  uid: "olay-cpi-2026-12-10@acilis-zili",
  summary: "Kasım TÜFE Verisi",
  description: "Ekonomik veri açıklaması. Önem: Yüksek.",
  url: "https://aciliszili.com/takvim",
  start: new Date("2026-12-10T13:30:00Z"),
};

const allDay: IcsEvent = {
  uid: "bilanco-NVDA-2026-11-19@acilis-zili",
  summary: "NVDA Bilanço · Kapanış Sonrası",
  description: "NVIDIA 2026-11-19 tarihinde çeyrek sonuçlarını açıklıyor.",
  url: "https://aciliszili.com/hisse/NVDA",
  date: "2026-11-19",
  lastModified: new Date("2026-11-13T06:00:00Z"),
};

test("kısa satır katlanmaz, boş satır kaybolmaz", () => {
  assert.equal(foldIcsLine("SUMMARY:NVDA"), "SUMMARY:NVDA");
  assert.equal(foldIcsLine(""), "");
  const exact = `X:${"a".repeat(FOLD_LIMIT - 2)}`;
  assert.equal(octets(exact), FOLD_LIMIT);
  assert.equal(foldIcsLine(exact), exact);
});

test("katlama oktet sayar: Türkçe satır 75 okteti aşmaz ve geri açılınca aynıdır", () => {
  const line =
    "DESCRIPTION:Şirket çeyrek sonuçlarını açıklıyor. Sağlayıcı kesin saat vermiyor\\; açıklama kapanış sonrası bekleniyor. Önümüzdeki günlerde güncellenir.";
  const folded = foldIcsLine(line);
  const parts = folded.split("\r\n");
  assert.ok(parts.length > 1);
  for (const part of parts) assert.ok(octets(part) <= FOLD_LIMIT, `${octets(part)} oktet: ${part}`);
  for (const part of parts.slice(1)) assert.equal(part[0], " ");
  assert.equal(unfold(folded), line);
  /* Karakterle sayan eski hâlin kaçırdığı durum: 74 karakter ama 75'ten
     çok oktet. */
  const turkish = `X:${"ş".repeat(60)}`;
  assert.ok(turkish.length < FOLD_LIMIT && octets(turkish) > FOLD_LIMIT);
  for (const part of foldIcsLine(turkish).split("\r\n")) assert.ok(octets(part) <= FOLD_LIMIT);
});

test("katlama çok oktetli karakteri ortadan bölmez", () => {
  /* 74 ASCII + dört oktetlik emoji: sınır tam emojinin içine düşüyor. */
  const line = `X:${"a".repeat(72)}📈📈 son`;
  const folded = foldIcsLine(line);
  const parts = folded.split("\r\n");
  assert.equal(parts[0], `X:${"a".repeat(72)}`);
  assert.ok(parts[1].startsWith(" 📈📈"));
  /* Bölünmüş bir vekil çift UTF-8'e U+FFFD olarak yazılırdı. */
  assert.equal(Buffer.from(folded, "utf8").toString("utf8").includes("�"), false);
  assert.equal(unfold(folded), line);
  /* Sayım gerçek baytlarla aynı: üç oktetli (€) ve iki oktetli (ö) harfler. */
  for (const sample of ["€".repeat(40), "ö".repeat(80), "𝄞".repeat(30)]) {
    for (const part of foldIcsLine(`X:${sample}`).split("\r\n")) assert.ok(octets(part) <= FOLD_LIMIT);
  }
});

test("metin kaçışı: virgül, noktalı virgül, ters bölü ve satır sonu", () => {
  assert.equal(escapeIcsText("Alphabet, Inc.; A\\B"), "Alphabet\\, Inc.\\; A\\\\B");
  assert.equal(escapeIcsText("bir\r\niki\nüç\rdört"), "bir\\niki\\nüç\\ndört");
  /* C0 denetim karakterleri atılır; sekme kalır. */
  assert.equal(escapeIcsText("a\u0000b\u0007c\td\u007f"), "abc\td");
});

test("açıklamadaki satır sonu dosyaya yeni özellik sokamaz", () => {
  const body = buildIcs(
    [{ ...allDay, summary: "Kötü\r\nDTSTART:19700101T000000Z", description: "x\rURL:https://example.com" }],
    { now: NOW },
  );
  const lines = unfold(body).split("\r\n");
  assert.equal(lines.filter((l) => l.startsWith("DTSTART")).length, 1);
  assert.equal(lines.filter((l) => l.startsWith("URL:")).length, 1);
  assert.ok(lines.includes("SUMMARY:Kötü\\nDTSTART:19700101T000000Z"));
});

test("tüm gün olayı: VALUE=DATE ve dışlayıcı ertesi gün", () => {
  const lines = buildIcs([allDay], { now: NOW }).split("\r\n");
  assert.ok(lines.includes("DTSTART;VALUE=DATE:20261119"));
  assert.ok(lines.includes("DTEND;VALUE=DATE:20261120"));
  assert.equal(lines.some((l) => /^DTSTART:\d{8}T/.test(l)), false);
  /* Ay ve yıl sonu. */
  const edge = buildIcs([{ ...allDay, date: "2026-12-31" }], { now: NOW });
  assert.ok(edge.includes("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101"));
  const leap = buildIcs([{ ...allDay, date: "2028-02-28" }], { now: NOW });
  assert.ok(leap.includes("DTEND;VALUE=DATE:20280229"));
});

test("zamanlı olay UTC yazılır, bitişi varsayılan otuz dakika sonra", () => {
  const lines = buildIcs([timed], { now: NOW }).split("\r\n");
  assert.ok(lines.includes("DTSTART:20261210T133000Z"));
  assert.ok(lines.includes("DTEND:20261210T140000Z"));
  const long = buildIcs([{ ...timed, durationMinutes: 90 }], { now: NOW });
  assert.ok(long.includes("DTEND:20261210T150000Z"));
});

test("damga: kayıt tarihi varsa o, yoksa üretim anı", () => {
  const lines = buildIcs([timed, allDay], { now: NOW }).split("\r\n");
  assert.ok(lines.includes("DTSTAMP:20261114T120000Z"));
  assert.ok(lines.includes("DTSTAMP:20261113T060000Z"));
  assert.deepEqual(lines.filter((l) => l.startsWith("LAST-MODIFIED")), ["LAST-MODIFIED:20261113T060000Z"]);
});

test("kayıt tarihli akış üretim anından bağımsızdır (ETag'in dayanağı)", () => {
  const first = buildIcs([allDay], { now: NOW });
  const later = buildIcs([allDay], { now: new Date("2026-11-15T09:30:00Z") });
  assert.equal(first, later);
});

test("akış: takvim adı, yenileme aralığı, dengeli BEGIN/END, CRLF, tekil UID", () => {
  const body = buildIcs([timed, allDay], {
    now: NOW,
    calendar: { name: "Açılış Zili · Ekonomik Takvim", description: "Veri, saatleriyle; her gün.", refreshHours: 6 },
  });
  assert.ok(body.endsWith("END:VCALENDAR\r\n"));
  assert.equal(/[^\r]\n/.test(body), false, "yalın LF yok");
  const lines = body.split("\r\n").filter(Boolean);
  assert.equal(lines[0], "BEGIN:VCALENDAR");
  assert.equal(lines[1], "VERSION:2.0");
  assert.ok(lines.includes("X-WR-CALNAME:Açılış Zili · Ekonomik Takvim"));
  assert.ok(lines.includes("X-WR-CALDESC:Veri\\, saatleriyle\\; her gün."));
  assert.ok(lines.includes("REFRESH-INTERVAL;VALUE=DURATION:PT6H"));
  assert.ok(lines.includes("X-PUBLISHED-TTL:PT6H"));
  for (const name of ["VCALENDAR", "VEVENT"]) {
    assert.equal(
      lines.filter((l) => l === `BEGIN:${name}`).length,
      lines.filter((l) => l === `END:${name}`).length,
    );
  }
  assert.equal(lines.filter((l) => l === "BEGIN:VEVENT").length, 2);
  /* Takvim başlığı ilk etkinlikten önce. */
  assert.ok(lines.indexOf("X-PUBLISHED-TTL:PT6H") < lines.indexOf("BEGIN:VEVENT"));
  const uids = lines.filter((l) => l.startsWith("UID:"));
  assert.equal(new Set(uids).size, uids.length);
  for (const line of lines) assert.ok(octets(line) <= FOLD_LIMIT, line);
});

test("tek olay dosyası takvim adı taşımaz; boş akış yine geçerli bir kabuktur", () => {
  const single = buildIcs([timed], { now: NOW });
  assert.equal(single.includes("X-WR-CALNAME"), false);
  assert.equal(single.includes("REFRESH-INTERVAL"), false);
  const empty = buildIcs([], { now: NOW, calendar: { name: "Boş" } });
  assert.ok(empty.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(empty.endsWith("END:VCALENDAR\r\n"));
  assert.equal(empty.includes("VEVENT"), false);
});
