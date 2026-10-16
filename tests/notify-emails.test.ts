import test from "node:test";
import assert from "node:assert/strict";
import { hashEmailToken, isUnsubscribeScope, looksLikeEmailToken, newEmailToken, unsubscribeUrl, type Recipient } from "../lib/email-notify";
import { alertEmailMessage, confirmEmailMessage, weekRangeLabel, weeklyEmailMessage } from "../lib/notify-emails";
import { digestWeek, type DigestData } from "../lib/weekly-digest";
import tr from "../lib/i18n/dictionaries/tr";
import en from "../lib/i18n/dictionaries/en";

/** Bildirim postalarının saf kısmı (lib/email-notify.ts, lib/notify-emails.ts, lib/weekly-digest.ts). */

/** Intl ince/dar boşlukları (U+2009, U+202F, U+00A0) düz boşluğa. */
const plain = (value: string) => value.replace(/[\u2009\u202f\u00a0]/g, " ");

const recipient: Recipient = {
  userId: "u1",
  email: "okur@example.com",
  username: "okur<b>",
  locale: "tr",
  unsubToken: newEmailToken(),
};

export const sampleDigest = (overrides: Partial<DigestData> = {}): DigestData => ({
  locale: "tr",
  pastMonday: "2026-10-12",
  pastFriday: "2026-10-16",
  thisMonday: "2026-10-19",
  thisFriday: "2026-10-23",
  indices: [
    { symbol: "SPY", label: "S&P 500", changePct: 1.24, price: 640 },
    { symbol: "QQQ", label: "Nasdaq 100", changePct: -0.42, price: 560 },
  ],
  reported: [
    { symbol: "JPM", name: "JPMorgan Chase & Co.", reportDate: "2026-10-14", eps: { direction: "beat", ratio: 0.083 }, revenue: { direction: "miss", ratio: -0.012 }, analysisPath: "/bilancolar/jpm/2026q3" },
  ],
  reportedTotal: 14,
  pastFailed: false,
  brief: { headline: "Bankalar Haftayı Taşıdı", path: "/bulten/haftalik/2026-10-12" },
  stories: [],
  news: [{ title: "Haber <script>", meta: "JPM — Reuters", path: "/haberler/1" }],
  ahead: [
    { date: "2026-10-19", closed: null, items: [], bmoClock: "~15:00", amcClock: "~23:00" },
    { date: "2026-10-21", closed: null, items: [{ symbol: "TSLA", name: "Tesla", timing: "amc" }], bmoClock: "~15:00", amcClock: "~23:00" },
  ],
  aheadFailed: false,
  aheadAll: new Map([["TSLA", { date: "2026-10-21", timing: "amc" as const }]]),
  events: [{ date: "2026-10-22", time: "15:30", title: "Tüketici Fiyatları" }],
  eventsFailed: false,
  ...overrides,
});

test("belirteç 43 karakter base64url, özeti 64 hex", () => {
  const token = newEmailToken();
  assert.equal(looksLikeEmailToken(token), true);
  assert.equal(looksLikeEmailToken(`${token}x`), false);
  assert.equal(looksLikeEmailToken("../../etc"), false);
  assert.match(hashEmailToken(token), /^[0-9a-f]{64}$/);
});

test("çıkış kapsamı yalnız üç değer", () => {
  assert.equal(isUnsubscribeScope("weekly"), true);
  assert.equal(isUnsubscribeScope("all"), true);
  assert.equal(isUnsubscribeScope("hepsi"), false);
  assert.equal(isUnsubscribeScope(undefined), false);
});

test("çıkış bağlantısı dilin önekini taşır", () => {
  assert.match(unsubscribeUrl(recipient, "weekly"), /\/e-posta\/ayril\?anahtar=[A-Za-z0-9_-]{43}&kapsam=weekly$/);
  assert.match(unsubscribeUrl({ ...recipient, locale: "en" }, "all"), /\/en\/e-posta\/ayril\?/);
});

test("hafta aralığı Türkçe ve İngilizce", () => {
  assert.equal(plain(weekRangeLabel("2026-10-12", "2026-10-16", "tr")), "12 – 16 Ekim");
  assert.equal(plain(weekRangeLabel("2026-10-12", "2026-10-16", "en")), "October 12 – 16");
  assert.equal(plain(weekRangeLabel("2026-09-28", "2026-10-02", "tr")), "28 Eylül – 2 Ekim");
});

test("özetin haftası: pazartesi bugün, hafta sonu gelen pazartesi", () => {
  /* 19 Ekim 2026 pazartesi 11:15 UTC = 07:15 ET */
  assert.deepEqual(digestWeek(new Date("2026-10-19T11:15:00Z")), { thisMonday: "2026-10-19", pastMonday: "2026-10-12" });
  assert.deepEqual(digestWeek(new Date("2026-10-18T15:00:00Z")), { thisMonday: "2026-10-19", pastMonday: "2026-10-12" });
  assert.deepEqual(digestWeek(new Date("2026-10-21T15:00:00Z")), { thisMonday: "2026-10-19", pastMonday: "2026-10-12" });
});

test("onay postası: bağlantı, açılan postalar, kaçışlanmış ad", () => {
  const mail = confirmEmailMessage({
    to: recipient.email,
    username: recipient.username,
    locale: "tr",
    link: "https://aciliszili.com/e-posta/onay?anahtar=abc",
    kinds: { alerts: true, weekly: true },
    copy: tr.emailNotify,
  });
  assert.equal(mail.subject, tr.emailNotify.confirmMail.subject);
  assert.match(mail.html, /e-posta\/onay\?anahtar=abc/);
  assert.match(mail.html, /Alarm E-postası · Pazartesi Özeti/);
  assert.ok(!mail.html.includes("okur<b>"));
  assert.match(mail.text, /okur<b>/);
});

test("alarm postası: konu, yön rengi, çıkış bağlantısı", () => {
  const mail = alertEmailMessage(
    recipient,
    { kind: "price", symbol: "NVDA", direction: "below", target: 180, price: 179.5, firedAt: new Date("2026-10-16T14:05:00Z") },
    tr.emailNotify,
  );
  assert.equal(plain(mail.subject), "NVDA 180,00 $ hedefinin altına indi");
  assert.match(mail.html, /#c01a3d/);
  assert.match(mail.html, /kapsam=alerts/);
  assert.match(mail.html, /16 Ekim · 17:05 İstanbul/);
  const pct = alertEmailMessage(
    { ...recipient, locale: "en" },
    { kind: "percent", symbol: "AMD", direction: "up", thresholdPct: 5, changePct: 6.31, firedAt: new Date() },
    en.emailNotify,
  );
  assert.equal(plain(pct.subject), "AMD passed its + 5% gain threshold today");
  assert.match(plain(pct.html), /\+ 6\.31%/);
});

test("haftalık posta: bölümler, kaçış, kişisel satır", () => {
  const mail = weeklyEmailMessage(recipient, sampleDigest(), [{ symbol: "TSLA", date: "2026-10-21", timing: "amc" }], tr.emailNotify);
  assert.equal(plain(mail.subject), "Açılış Zili · Haftanın Özeti · 19 – 23 Ekim");
  for (const part of ["Endeksler", "Açıklanan Bilançolar", "HBK · Beklentiyi Aştı + %8,3", "Gelir · Beklentinin Altında − %1,2", "Bankalar Haftayı Taşıdı", "Takip Listende Bu Hafta", "Tüketici Fiyatları", "kapsam=weekly"]) {
    assert.ok(plain(mail.html).includes(part), part);
  }
  assert.ok(!mail.html.includes("<script>"));
  assert.match(mail.text, /- TSLA: /);
});

test("okunamayan takvim boş hafta diye yazılmaz", () => {
  const mail = weeklyEmailMessage(recipient, sampleDigest({ pastFailed: true, aheadFailed: true, eventsFailed: true, indices: [] }), [], tr.emailNotify);
  assert.ok(mail.html.includes(tr.emailNotify.weeklyMail.reportedFailed));
  assert.ok(mail.html.includes(tr.emailNotify.weeklyMail.aheadFailed));
  assert.ok(!mail.html.includes(tr.emailNotify.weeklyMail.reportedEmpty));
  assert.ok(!mail.html.includes("Endeksler"));
});
