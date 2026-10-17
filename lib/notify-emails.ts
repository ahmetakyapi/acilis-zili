import { escapeHtml, type Email } from "@/lib/email";
import { C, FONT, MONO, brandedEmailHtml, emailButton, emailMeta, emailSection, emailText } from "@/lib/email-layout";
import type { Recipient } from "@/lib/email-notify";
import { unsubscribeUrl } from "@/lib/email-notify";
import type { emailNotifyTr } from "@/lib/i18n/dictionaries/email-notify";
import type { Locale } from "@/lib/i18n/config";
import { displayZone, formatInZone } from "@/lib/session-clock";
import { SITE_URL } from "@/lib/site";
import { formatPercent, formatPrice } from "@/lib/utils";
import type { DigestData, DigestReport } from "@/lib/weekly-digest";

/**
 * Bildirim postalarının şablonları (16 Ekim) — onay, alarm, pazartesi
 * özeti. Kap lib/email-layout.ts (kenardan kenara zil bandı, koyu tema,
 * Outlook yolu); burada yalnız gövdeler. Her postanın düz metin eşi de
 * kurulur: metin istemcisi ve spam süzgeci ikisini de okur.
 */

type Copy = typeof emailNotifyTr;

const pathFor = (path: string, locale: Locale) => `${SITE_URL}${locale === "en" ? "/en" : ""}${path === "/" ? "" : path}`;

function footerFor(recipient: Pick<Recipient, "unsubToken" | "locale">, common: Copy["common"], scope: "alerts" | "weekly" | null) {
  const links = [
    { label: common.footerHome, href: pathFor("/", recipient.locale) },
    { label: common.footerSettings, href: `${pathFor("/ayarlar", recipient.locale)}#e-posta` },
    { label: common.footerPrivacy, href: pathFor("/kvkk", recipient.locale) },
  ];
  if (scope) {
    links.push(
      { label: common.unsubscribe, href: unsubscribeUrl(recipient, scope) },
      { label: common.unsubscribeAll, href: unsubscribeUrl(recipient, "all") },
    );
  }
  return links;
}

/* --------------------------------------------------------------------------
   Onay
   -------------------------------------------------------------------------- */

export function confirmEmailMessage(input: {
  to: string;
  username: string;
  locale: Locale;
  link: string;
  kinds: { alerts: boolean; weekly: boolean };
  copy: Copy;
}): Email {
  const { copy, locale } = input;
  const M = copy.confirmMail;
  const greeting = M.greeting.replace("{username}", input.username);
  const what = [input.kinds.alerts && M.alertsLabel, input.kinds.weekly && M.weeklyLabel].filter(Boolean).join(" · ") || M.alertsLabel;
  const meta = [
    { label: M.metaWhat, value: what },
    { label: M.metaValidity, value: M.metaValidityValue },
  ];
  const text = [greeting, "", M.body, "", input.link, "", ...meta.map((row) => `${row.label}: ${row.value}`), "", M.ignore, "", copy.common.signature, "", copy.common.noReply].join("\n");
  const html = brandedEmailHtml({
    lang: locale,
    preheader: M.preheader,
    title: M.heroTitle,
    lead: M.heroLead,
    brandName: copy.common.signature,
    origin: SITE_URL,
    bodyHtml: [
      emailText.greeting(greeting),
      emailText.paragraph(M.body),
      emailButton(M.button, input.link),
      emailMeta(meta),
      emailText.fallback(M.fallback, input.link),
      emailText.note(M.noteTitle, M.ignore),
    ].join("\n"),
    footerLines: [copy.common.noReply],
    footerLinks: footerFor({ unsubToken: "", locale }, copy.common, null),
  });
  return { to: input.to, subject: M.subject, text, html };
}

/* --------------------------------------------------------------------------
   Alarm
   -------------------------------------------------------------------------- */

export type AlertEmailInput =
  | { kind: "price"; symbol: string; direction: "above" | "below"; target: number; price: number; firedAt: Date }
  | { kind: "percent"; symbol: string; direction: "up" | "down"; thresholdPct: number; changePct: number; firedAt: Date };

function firedLabel(at: Date, locale: Locale, zoneName: string): string {
  const zone = displayZone(locale);
  const day = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { timeZone: zone, day: "numeric", month: "long" }).format(at);
  return `${day} · ${formatInZone(at, zone)} ${zoneName}`;
}

export function alertEmailMessage(recipient: Recipient, alert: AlertEmailInput, copy: Copy): Email {
  const { locale } = recipient;
  const A = copy.alertMail;
  const rising = alert.direction === "above" || alert.direction === "up";
  const tone = rising ? { ink: C.up, wash: C.upWash, cls: "az-up", washCls: "az-up-wash", arrow: "&#9650;" } : { ink: C.down, wash: C.downWash, cls: "az-down", washCls: "az-down-wash", arrow: "&#9660;" };
  const money = (value: number) => formatPrice(value, locale, { currency: true });

  let subject: string;
  let bigValue: string;
  let bigLabel: string;
  let sideValue: string;
  let sideLabel: string;
  let directionLabel: string;
  let lead: string;
  if (alert.kind === "price") {
    subject = (alert.direction === "above" ? A.subjectAbove : A.subjectBelow).replace("{symbol}", alert.symbol).replace("{target}", money(alert.target));
    bigValue = money(alert.price);
    bigLabel = A.priceLabel;
    sideValue = money(alert.target);
    sideLabel = A.targetLabel;
    directionLabel = alert.direction === "above" ? A.directionAbove : A.directionBelow;
    lead = A.leadPrice;
  } else {
    const threshold = formatPercent(alert.direction === "up" ? alert.thresholdPct : -alert.thresholdPct, locale, alert.thresholdPct % 1 === 0 ? 0 : 2);
    subject = (alert.direction === "up" ? A.subjectUp : A.subjectDown).replace("{symbol}", alert.symbol).replace("{threshold}", threshold);
    bigValue = formatPercent(alert.changePct, locale, 2);
    bigLabel = A.changeLabel;
    sideValue = threshold;
    sideLabel = A.thresholdLabel;
    directionLabel = alert.direction === "up" ? A.directionUp : A.directionDown;
    lead = A.leadPercent;
  }
  const stockUrl = pathFor(`/hisse/${alert.symbol}`, locale);
  const fired = firedLabel(alert.firedAt, locale, copy.common.zoneName);
  const meta = [
    { label: A.metaType, value: alert.kind === "price" ? A.typePrice : A.typePercent },
    { label: A.metaTime, value: fired },
  ];

  const tile = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px">
<tr><td class="az-sunken" style="background:${C.sunken};border:1px solid ${C.line};border-left:4px solid ${tone.ink};border-radius:18px;padding:22px 22px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="top" class="az-stack az-stack-gap" style="padding:0 12px 0 0">
<p style="margin:0;font-family:${MONO};font-size:30px;line-height:34px;font-weight:800;letter-spacing:-.01em" class="az-ink"><span style="color:${C.ink}" class="az-ink">${escapeHtml(alert.symbol)}</span></p>
<p style="margin:10px 0 0"><span class="${tone.washCls}" style="display:inline-block;padding:5px 11px;border-radius:999px;background:${tone.wash};color:${tone.ink};font-family:${FONT};font-size:12px;line-height:16px;font-weight:700">${tone.arrow}&nbsp;${escapeHtml(directionLabel)}</span></p>
</td>
<td valign="top" align="right" class="az-stack" style="text-align:right">
<p class="az-muted" style="margin:0;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${escapeHtml(bigLabel)}</p>
<p class="${tone.cls}" style="margin:2px 0 0;font-family:${FONT};font-size:30px;line-height:36px;font-weight:800;letter-spacing:-.02em;color:${tone.ink}">${escapeHtml(bigValue)}</p>
<p class="az-muted" style="margin:6px 0 0;font-family:${FONT};font-size:13px;line-height:18px;color:${C.muted}">${escapeHtml(sideLabel)}&nbsp;<strong class="az-ink" style="color:${C.ink};font-weight:700">${escapeHtml(sideValue)}</strong></p>
</td>
</tr></table>
</td></tr></table>`;

  const text = [
    `${A.kicker}: ${alert.symbol}`,
    "",
    lead,
    "",
    `${bigLabel}: ${bigValue}`,
    `${sideLabel}: ${sideValue}`,
    ...meta.map((row) => `${row.label}: ${row.value}`),
    "",
    stockUrl,
    "",
    A.honesty,
    copy.common.notAdvice,
    "",
    copy.common.whyReceived,
    `${copy.common.unsubscribe}: ${unsubscribeUrl(recipient, "alerts")}`,
  ].join("\n");

  const html = brandedEmailHtml({
    lang: locale,
    preheader: `${subject} · ${fired}`,
    title: `${A.kicker}: ${alert.symbol}`,
    lead,
    brandName: copy.common.signature,
    origin: SITE_URL,
    bodyHtml: [
      tile,
      emailButton(A.button.replace("{symbol}", alert.symbol), stockUrl),
      emailMeta(meta),
      emailText.note(copy.common.notAdvice, A.honesty),
    ].join("\n"),
    footerLines: [copy.common.whyReceived, copy.common.noReply],
    footerLinks: footerFor(recipient, copy.common, "alerts"),
  });
  return { to: recipient.email, subject, text, html };
}

/* --------------------------------------------------------------------------
   Pazar özeti (17 Ekim'de pazartesiden pazara, görsel yeniden çizim)

   Düzen sitenin ekran sırası: bant → haftanın rakamları (ölçü ızgarası) →
   geride kalan hafta (endeks çizgileri, bilanço karnesi, gelişmeler) →
   yeni hafta (takip listen, haftanın ritmi, gün gün takvim, veriler).

   GRAFİKLER TABLO. Gmail SVG'yi ve <canvas>'ı siliyor; çubuklar ölçülü
   `div`ler, yükseklik ve genişlik piksel ya da yüzde olarak satır içinde.
   Her çubuk GERÇEK bir sayıdan geliyor — süs çubuğu yok (CLAUDE.md
   "Karşılaştırılan büyüklük bir de çizgi olarak okunur"; renk yalnız
   işaretten). Gün çubuğu bir SAYI (o gün açıklayan şirket), yön değil:
   nötr mürekkep, yeşil/kırmızı değil.

   HAREKET yalnız Apple Mail'de (lib/email-layout.ts → az-grow-*, az-rise);
   başka her istemcide son kare satır içi stilin kendisi.
   -------------------------------------------------------------------------- */

const intlLocale = (locale: Locale) => (locale === "en" ? "en-US" : "tr-TR");
const utcDay = (date: string) => new Date(`${date}T12:00:00Z`);

export function weekRangeLabel(from: string, to: string, locale: Locale): string {
  const fmt = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", timeZone: "UTC" });
  return fmt.formatRange(utcDay(from), utcDay(to));
}

function dayLabel(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(utcDay(date));
}

function weekdayShort(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: "UTC" }).format(utcDay(date));
}

function dayNumber(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" }).format(utcDay(date));
}

type Tone = "up" | "down" | "flat";
const toneOf = (value: number): Tone => (value > 0 ? "up" : value < 0 ? "down" : "flat");
const TONE = {
  up: { ink: C.up, wash: C.upWash, cls: "az-up", washCls: "az-up-wash", fill: "az-up-fill" },
  down: { ink: C.down, wash: C.downWash, cls: "az-down", washCls: "az-down-wash", fill: "az-down-fill" },
  flat: { ink: C.body, wash: C.sunken, cls: "az-body", washCls: "az-flat-wash", fill: "az-flat-fill" },
} as const;
/* Nötr çubuk (sayı, yön değil) ve kulvar — sitenin --line-soft / --line-strong'u. */
const LANE = "#e9eef5";
const ZERO = "#b7c3d3";
const FLAT_FILL = "#9aa8bb";

const delay = (ms: number) => `animation-delay:${ms}ms;`;

function chip(text: string, tone: Tone): string {
  const t = TONE[tone];
  return `<span class="${t.washCls}" style="display:inline-block;padding:3px 9px;border-radius:999px;background:${t.wash};color:${t.ink};font-family:${FONT};font-size:11px;line-height:16px;font-weight:700;white-space:nowrap">${escapeHtml(text)}</span>`;
}

/**
 * Bölüm bandı — "01 · Geride Kalan Hafta". AÇIK TONLU ZEMİN, KOYU YAZI
 * (17 Ekim, sahibinin Gmail iOS ekran görüntüsü): ilk sürüm lacivert bant
 * üstünde beyaz yazıydı; Gmail iOS koyu temada sayfayı tersine çevirirken
 * koyu zemini olduğu gibi bırakıp beyaz yazıyı koyulaştırıyordu — başlık
 * okunmuyordu. Gövdede koyu zemin üstünde açık yazı YOK: tersine çeviren
 * istemcide bant koyu, yazı açık olur; Apple Mail'de az-chapter sınıfı
 * koyulaştırır. Koyu ve renkli tek yüzey bant GIF'i (görsel, çevrilmez).
 */
function chapter(index: string, title: string, range: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:40px 0 0"><tr><td class="az-chapter" bgcolor="#e8f0fb" style="background:#e8f0fb;border:1px solid #d3e0f2;border-left:4px solid ${C.primary};border-radius:16px;padding:16px 18px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" width="46" style="padding-right:14px"><span class="az-chapter-index" style="display:inline-block;width:38px;height:38px;border-radius:11px;background:#ffffff;border:1px solid #d3e0f2;font-family:${MONO};font-size:14px;line-height:38px;font-weight:800;color:#8a5f12;text-align:center">${escapeHtml(index)}</span></td>
<td valign="middle"><p class="az-ink" style="margin:0;font-family:${FONT};font-size:19px;line-height:24px;font-weight:800;letter-spacing:-.02em;color:${C.ink}">${escapeHtml(title)}</p>
<p class="az-muted" style="margin:3px 0 0;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${escapeHtml(range)}</p></td>
</tr></table>
</td></tr></table>`;
}

/* ---- Haftanın rakamları (ölçü ızgarası) ---- */

function statTile(label: string, value: string, sub: string, valueClass: string, valueColor: string, order: number, last: boolean, width: string): string {
  /* Dış kenarlar içerikle hizalı (negatif margin Outlook'ta yok); arada 8 piksel. */
  const pad = `0 ${last ? 0 : 4}px 0 ${order === 0 ? 0 : 4}px`;
  /* Eşit boy: dış tablo `height:1px`, hücre ve iç tablo %100 — üç kutudan
     birinin alt satırı kırılınca ötekiler kısa kalıyordu (640'ta ölçüldü). */
  return `<td valign="top" width="${width}" height="100%" style="padding:${pad};height:100%">
<table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" border="0" style="height:100%"><tr><td valign="top" class="az-sunken az-sunken-flat az-rise az-stat-box" style="${delay(120 * order)}background:${C.sunken};border:1px solid ${C.line};border-radius:16px;padding:16px 16px 15px">
<p class="az-muted" style="margin:0;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${escapeHtml(label)}</p>
<p class="${valueClass} az-stat-val" style="margin:6px 0 0;font-family:${FONT};font-size:26px;line-height:30px;font-weight:800;letter-spacing:-.03em;color:${valueColor};white-space:nowrap">${escapeHtml(value)}</p>
<p class="az-muted" style="margin:4px 0 0;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${escapeHtml(sub)}</p>
</td></tr></table></td>`;
}

function statsBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  const tiles: ((order: number, last: boolean, width: string) => string)[] = [];
  const lead = data.indices[0];
  if (lead) {
    const tone = TONE[toneOf(lead.changePct)];
    tiles.push((o, l, w) => statTile(lead.label, formatPercent(lead.changePct, data.locale, 2), W.statWeekly, tone.cls, tone.ink, o, l, w));
  }
  const scored = data.scorecard.beat + data.scorecard.inline + data.scorecard.miss;
  if (!data.pastFailed && scored > 0) {
    tiles.push(
      (o, l, w) => statTile(W.statBeat, `${data.scorecard.beat}/${scored}`, W.statBeatOf.replace("{n}", String(scored)), "az-ink", C.ink, o, l, w),
    );
  }
  if (!data.aheadFailed) {
    const events = data.eventsFailed || data.events.length === 0 ? "" : W.statEvents.replace("{n}", String(data.events.length));
    tiles.push((o, l, w) => statTile(W.statAhead, String(data.aheadTotal), [W.statAheadUnit, events].filter(Boolean).join(" · "), "az-ink", C.ink, o, l, w));
  }
  if (tiles.length === 0) return "";
  const cells = tiles.map((tile, i) => tile(i, i === tiles.length - 1, `${Math.floor(100 / tiles.length)}%`));
  return `${emailSection(W.statsTitle, undefined, true)}
<table role="presentation" width="100%" height="1" cellpadding="0" cellspacing="0" border="0" style="height:1px"><tr>${cells.join("")}</tr></table>`;
}

/* ---- Endeksler: haftalık değişim çizgisi + gün gün adımlar ---- */

/** Sıfırdan iki yana açılan çizgi — `share` 0..1, büyüklüğün en büyüğe oranı. */
function divergingBar(value: number, share: number, order: number): string {
  const tone = TONE[toneOf(value)];
  const pct = Math.max(2, Math.round(share * 100));
  const bar = `<div class="${tone.fill} az-grow-x" style="${delay(200 + 90 * order)}width:${pct}%;height:6px;border-radius:3px;background:${tone.ink};font-size:0;line-height:0">&nbsp;</div>`;
  const left = value < 0 ? `<div class="${tone.fill} az-grow-x" style="${delay(200 + 90 * order)}transform-origin:right center;margin-left:auto;width:${pct}%;height:6px;border-radius:3px;background:${tone.ink};font-size:0;line-height:0">&nbsp;</div>` : "&nbsp;";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0"><tr>
<td width="50%" align="right" class="az-lane" bgcolor="${LANE}" style="background:${LANE};border-radius:3px 0 0 3px;font-size:0;line-height:0;height:6px">${left}</td>
<td width="2" class="az-zero" bgcolor="${ZERO}" style="background:${ZERO};font-size:0;line-height:0;width:2px">&nbsp;</td>
<td width="50%" class="az-lane" bgcolor="${LANE}" style="background:${LANE};border-radius:0 3px 3px 0;font-size:0;line-height:0;height:6px">${value > 0 ? bar : "&nbsp;"}</td>
</tr></table>`;
}

/** Beş seansın kapanıştan kapanışa adımı — yukarı yeşil, aşağı kırmızı, sıfır çizgisi ortada. */
function stepBars(steps: DigestData["indices"][number]["steps"], maxAbs: number, order: number): string {
  /* TEK TABLO, üç satır (yukarı çubuklar · sıfır çizgisi · aşağı çubuklar).
     İlk sürüm her gün için iç içe bir tablo açıyordu ve dört endeksin
     adımları postanın ~20 KB'ını tutuyordu (Gmail 102 KB'ta kırpıyor). */
  const HALF = 16;
  const bar = (step: (typeof steps)[number], i: number) => {
    const tone = TONE[toneOf(step.changePct)];
    const h = maxAbs > 0 ? Math.max(2, Math.round((Math.abs(step.changePct) / maxAbs) * HALF)) : 2;
    return `<div class="${tone.fill} az-grow-y" style="${delay(260 + 90 * order + 50 * i)}${step.changePct < 0 ? "transform-origin:center top;" : ""}width:8px;height:${h}px;border-radius:2px;background:${tone.ink}"></div>`;
  };
  const cell = "padding:0 2px;font-size:0;line-height:0";
  const up = steps.map((step, i) => `<td valign="bottom" height="${HALF}" style="${cell};height:${HALF}px">${step.changePct >= 0 ? bar(step, i) : ""}</td>`).join("");
  const down = steps.map((step, i) => `<td valign="top" height="${HALF}" style="${cell};height:${HALF}px">${step.changePct < 0 ? bar(step, i) : ""}</td>`).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr>${up}</tr><tr><td colspan="${steps.length}" class="az-zero" bgcolor="${ZERO}" height="1" style="height:1px;background:${ZERO};font-size:0;line-height:0"></td></tr><tr>${down}</tr></table>`;
}

function indicesBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  if (data.indices.length === 0) return "";
  const maxWeek = Math.max(...data.indices.map((i) => Math.abs(i.changePct)), 0.0001);
  const maxStep = Math.max(...data.indices.flatMap((i) => i.steps.map((s) => Math.abs(s.changePct))), 0);
  const rows = data.indices
    .map((index, i) => {
      const tone = TONE[toneOf(index.changePct)];
      return `<tr><td class="az-rule" style="padding:14px 0 15px;${i ? `border-top:1px solid ${C.line};` : ""}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="font-family:${FONT};font-size:15px;line-height:20px;font-weight:800;color:${C.ink}"><span class="az-ink">${escapeHtml(index.label)}</span></td>
<td valign="middle" width="84" class="az-hide-sm" style="padding:0 12px">${index.steps.length > 1 ? stepBars(index.steps, maxStep, i) : ""}</td>
<td valign="middle" align="right" width="86" class="${tone.cls}" style="font-family:${FONT};font-size:18px;line-height:22px;font-weight:800;letter-spacing:-.02em;color:${tone.ink};white-space:nowrap">${escapeHtml(formatPercent(index.changePct, data.locale, 2))}</td>
</tr></table>
${divergingBar(index.changePct, Math.abs(index.changePct) / maxWeek, i)}
</td></tr>`;
    })
    .join("\n");
  return `${emailSection(W.marketTitle, W.marketNote)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-meta" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${rows}</table>`;
}

/* ---- Bilanço karnesi ---- */

function surpriseChip(report: DigestReport, W: Copy["weeklyMail"], locale: Locale): string {
  const parts: string[] = [];
  const one = (label: string, s: DigestReport["eps"]) => {
    if (!s) return;
    const text = s.direction === "beat" ? W.beat : s.direction === "miss" ? W.miss : W.inline;
    const pct = s.ratio !== null ? ` ${formatPercent(s.ratio * 100, locale, 1)}` : "";
    parts.push(chip(`${label} · ${text}${pct}`, s.direction === "beat" ? "up" : s.direction === "miss" ? "down" : "flat"));
  };
  one(W.epsLabel, report.eps);
  one(W.revenueLabel, report.revenue);
  return parts.join(`<span style="display:inline-block;width:4px"></span>`);
}

function scorecardBar(data: DigestData, W: Copy["weeklyMail"]): string {
  const { beat, inline, miss } = data.scorecard;
  const total = beat + inline + miss;
  if (total === 0) return "";
  const parts = (
    [
      { n: beat, tone: "up", label: W.scoreBeat },
      { n: inline, tone: "flat", label: W.scoreInline },
      { n: miss, tone: "down", label: W.scoreMiss },
    ] as const
  ).filter((p) => p.n > 0);
  const cells = parts
    .map((p, i) => {
      const color = p.tone === "flat" ? FLAT_FILL : TONE[p.tone].ink;
      const radius = `${i === 0 ? "5px" : "0"} ${i === parts.length - 1 ? "5px 5px" : "0 0"} ${i === 0 ? "5px" : "0"}`;
      return `<td width="${((p.n / total) * 100).toFixed(1)}%" class="${TONE[p.tone].fill}" bgcolor="${color}" style="background:${color};height:10px;border-radius:${radius};font-size:0;line-height:0;${i ? `border-left:2px solid ${C.card};` : ""}">&nbsp;</td>`;
    })
    .join("");
  const legend = parts
    .map(
      (p) =>
        `<span style="display:inline-block;margin:0 14px 0 0;white-space:nowrap"><span class="${TONE[p.tone].fill}" style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${p.tone === "flat" ? FLAT_FILL : TONE[p.tone].ink};vertical-align:middle;margin-right:6px"></span><strong class="az-ink" style="color:${C.ink}">${p.n}</strong> <span class="az-muted" style="color:${C.muted}">${escapeHtml(p.label)}</span></span>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 0"><tr><td class="az-grow-x" style="${delay(150)}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
</td></tr></table>
<p style="margin:10px 0 16px;font-family:${FONT};font-size:13px;line-height:20px">${legend}</p>`;
}

function reportedBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  const head = emailSection(W.reportedTitle, data.reportedTotal > data.reported.length ? W.reportedMore.replace("{total}", String(data.reportedTotal)) : undefined);
  if (data.pastFailed) return `${head}${emailText.paragraph(W.reportedFailed)}`;
  if (data.reported.length === 0) return `${head}${emailText.paragraph(W.reportedEmpty)}`;
  const rows = data.reported
    .map((report, i) => {
      const name = report.name ? escapeHtml(report.name.length > 34 ? `${report.name.slice(0, 33)}…` : report.name) : "";
      const link = report.analysisPath
        ? `<a href="${escapeHtml(pathFor(report.analysisPath, data.locale))}" target="_blank" class="az-link" style="font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;color:${C.primary};text-decoration:none;white-space:nowrap">${escapeHtml(W.readAnalysis)}&nbsp;&rarr;</a>`
        : "";
      return `<tr><td class="az-rule" style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ""}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="top" class="az-stack az-stack-gap" style="padding-right:10px">
<a href="${escapeHtml(pathFor(`/hisse/${report.symbol}`, data.locale))}" target="_blank" style="text-decoration:none"><span class="az-ink" style="font-family:${MONO};font-size:15px;line-height:20px;font-weight:800;color:${C.ink}">${escapeHtml(report.symbol)}</span></a>
<span class="az-muted" style="font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted}">&nbsp;&nbsp;${name}</span>
<br><span class="az-muted" style="font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted}">${escapeHtml(dayLabel(report.reportDate, data.locale))}</span>${link ? `&nbsp;&nbsp;·&nbsp;&nbsp;${link}` : ""}
</td>
<td valign="top" align="right" class="az-stack" style="text-align:right">${surpriseChip(report, W, data.locale)}</td>
</tr></table></td></tr>`;
    })
    .join("\n");
  return `${head}${scorecardBar(data, W)}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-meta" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${rows}</table>`;
}

/* ---- Gelişmeler ---- */

function linkList(links: DigestData["news"], locale: Locale): string {
  return links
    .map(
      (link, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px"><tr>
<td valign="top" width="34" style="padding-top:1px"><span class="az-chapter-index" style="display:inline-block;width:24px;height:24px;border-radius:8px;background:#e8f0fb;color:#8a5f12;font-family:${MONO};font-size:11px;line-height:24px;font-weight:800;text-align:center">${String(i + 1).padStart(2, "0")}</span></td>
<td valign="top"><a href="${escapeHtml(pathFor(link.path, locale))}" target="_blank" class="az-ink" style="font-family:${FONT};font-size:15px;line-height:21px;font-weight:700;color:${C.ink};text-decoration:none">${escapeHtml(link.title)}</a>${
        link.meta ? `<p class="az-muted" style="margin:3px 0 0;font-family:${FONT};font-size:12px;line-height:17px;color:${C.muted}">${escapeHtml(link.meta.length > 140 ? `${link.meta.slice(0, 139)}…` : link.meta)}</p>` : ""
      }</td></tr></table>`,
    )
    .join("\n");
}

function developmentsBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  const links = [...data.stories, ...data.news];
  const brief = data.brief
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 18px"><tr><td class="az-note" style="background:${C.sunken};border:1px solid ${C.line};border-left:3px solid ${C.brass};border-radius:14px;padding:16px 18px">
<p class="az-muted" style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${escapeHtml(W.briefTitle)}</p>
<p class="az-ink" style="margin:0 0 8px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:800;color:${C.ink}">${escapeHtml(data.brief.headline)}</p>
<a href="${escapeHtml(pathFor(data.brief.path, data.locale))}" target="_blank" class="az-link" style="font-family:${FONT};font-size:13px;line-height:18px;font-weight:700;color:${C.primary};text-decoration:none">${escapeHtml(W.briefLink)}&nbsp;&rarr;</a>
</td></tr></table>`
    : "";
  if (!brief && links.length === 0) return "";
  return `${emailSection(W.newsTitle)}${brief}${linkList(links, data.locale)}`;
}

/* ---- Yeni hafta: ritim, gün gün takvim, veriler ---- */

/** Beş günün sütunu — çubuk o gün açıklayan şirket SAYISI (nötr mürekkep). */
function rhythmBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  if (data.aheadFailed || data.ahead.length === 0) return "";
  const max = Math.max(...data.ahead.map((d) => d.total), 1);
  const BAR = 72;
  const anyEvents = data.ahead.some((d) => d.events > 0);
  const cells = data.ahead
    .map((day, i) => {
      const h = day.closed || day.total === 0 ? 0 : Math.max(4, Math.round((day.total / max) * BAR));
      const bar = day.closed
        ? `<p class="az-muted" style="margin:0;font-family:${FONT};font-size:11px;line-height:14px;color:${C.muted}">${escapeHtml(W.closed)}</p>`
        : h > 0
          ? `<div class="az-grow-y az-ink-fill" style="${delay(200 + 110 * i)}width:26px;height:${h}px;margin:0 auto;border-radius:7px 7px 3px 3px;background:${C.band};background-image:linear-gradient(180deg,#2c62ad 0%,${C.band} 100%);font-size:0;line-height:0">&nbsp;</div>`
          : "&nbsp;";
      const events = day.events > 0
        ? `<span style="display:inline-block;margin-top:5px;padding:2px 7px;border-radius:999px;background:#f6ecd9;color:#7a5512;font-family:${FONT};font-size:10px;line-height:14px;font-weight:700;white-space:nowrap" class="az-flat-wash">${escapeHtml(W.rhythmEvents.replace("{n}", String(day.events)))}</span>`
        : anyEvents
          ? `<span style="display:inline-block;margin-top:5px;font-size:10px;line-height:18px">&nbsp;</span>`
          : "";
      return `<td valign="bottom" align="center" width="20%" style="padding:0 3px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td valign="bottom" align="center" height="${BAR + 22}" style="height:${BAR + 22}px">
<p class="az-ink" style="margin:0 0 6px;font-family:${FONT};font-size:15px;line-height:16px;font-weight:800;color:${C.ink}">${day.closed ? "&nbsp;" : day.total}</p>
${bar}</td></tr>
<tr><td align="center" class="az-rule" style="padding:8px 0 0;border-top:2px solid ${ZERO}">
<p class="az-ink" style="margin:0;font-family:${FONT};font-size:13px;line-height:16px;font-weight:800;color:${C.ink}">${escapeHtml(weekdayShort(day.date, data.locale))}</p>
<p class="az-muted" style="margin:1px 0 0;font-family:${FONT};font-size:11px;line-height:14px;color:${C.muted};white-space:nowrap">${escapeHtml(dayNumber(day.date, data.locale))}</p>
${events}
</td></tr></table></td>`;
    })
    .join("");
  return `${emailSection(W.rhythmTitle, W.rhythmNote)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-sunken az-sunken-flat" style="background:${C.sunken};border:1px solid ${C.line};border-radius:18px"><tr><td style="padding:18px 10px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
</td></tr></table>`;
}

function aheadBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  const head = emailSection(W.aheadEarnings, data.aheadFailed ? undefined : W.aheadNote);
  if (data.aheadFailed) return `${head}${emailText.paragraph(W.aheadFailed)}`;
  const days = data.ahead.filter((day) => day.closed || day.items.length > 0);
  if (days.length === 0) return `${head}${emailText.paragraph(W.aheadEmpty)}`;
  const rows = days
    .map((day, i) => {
      const groups = (["bmo", "amc", "other"] as const)
        .map((timing) => {
          const items = day.items.filter((item) => item.timing === timing);
          if (items.length === 0) return "";
          const clock = timing === "bmo" ? day.bmoClock : timing === "amc" ? day.amcClock : "";
          const label = `${timing === "bmo" ? W.bmo : timing === "amc" ? W.amc : W.other}${clock ? ` · ${clock}` : ""}`;
          const pills = items
            .map(
              (item) =>
                `<a href="${escapeHtml(pathFor(`/hisse/${item.symbol}`, data.locale))}" target="_blank" class="az-sunken az-sunken-flat" style="display:inline-block;margin:0 4px 5px 0;padding:3px 8px;border:1px solid ${C.line};border-radius:8px;background:${C.sunken};font-family:${MONO};font-size:12px;line-height:17px;font-weight:700;color:${C.ink};text-decoration:none"><span class="az-ink">${escapeHtml(item.symbol)}</span></a>`,
            )
            .join("");
          return `<p class="az-muted" style="margin:0 0 5px;font-family:${FONT};font-size:11px;line-height:15px;color:${C.muted}">${escapeHtml(label)}</p>
<p style="margin:0 0 6px">${pills}</p>`;
        })
        .join("");
      return `<tr>
<td valign="top" width="86" class="az-rule" style="padding:13px 10px 6px 0;${i ? `border-top:1px solid ${C.line};` : ""}"><p class="az-ink" style="margin:0;font-family:${FONT};font-size:14px;line-height:18px;font-weight:800;color:${C.ink}">${escapeHtml(weekdayShort(day.date, data.locale))}</p><p class="az-muted" style="margin:1px 0 0;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${escapeHtml(dayNumber(day.date, data.locale))}</p></td>
<td valign="top" class="az-rule" style="padding:13px 0 6px;${i ? `border-top:1px solid ${C.line};` : ""}">${
        day.closed ? `<p style="margin:0 0 8px">${chip(`${W.closed} · ${day.closed}`, "flat")}</p>` : groups
      }</td></tr>`;
    })
    .join("\n");
  return `${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-meta" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${rows}</table>`;
}

function eventsBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  const head = emailSection(W.eventsTitle, data.eventsFailed || data.events.length === 0 ? undefined : W.eventsNote);
  if (data.eventsFailed) return `${head}${emailText.paragraph(W.eventsFailed)}`;
  if (data.events.length === 0) {
    const next = data.nextEvent
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:-12px 0 0"><tr><td class="az-note" style="background:${C.sunken};border:1px solid ${C.line};border-left:3px solid ${C.brass};border-radius:14px;padding:14px 18px">
<p class="az-muted" style="margin:0 0 3px;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${escapeHtml(W.eventsNext)}</p>
<p class="az-ink" style="margin:0;font-family:${FONT};font-size:15px;line-height:21px;font-weight:800;color:${C.ink}">${escapeHtml(data.nextEvent.title)}</p>
<p class="az-body" style="margin:2px 0 0;font-family:${FONT};font-size:13px;line-height:18px;color:${C.body}">${escapeHtml(`${dayLabel(data.nextEvent.date, data.locale)}${data.nextEvent.time ? ` · ${data.nextEvent.time}` : ""}`)}</p>
</td></tr></table>`
      : "";
    return `${head}${emailText.paragraph(W.eventsEmpty)}${next}`;
  }
  const rows = data.events
    .map(
      (event, i) => `<tr>
<td valign="top" width="86" class="az-rule" style="padding:11px 10px 11px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:12px;line-height:17px"><span class="az-muted" style="color:${C.muted}">${escapeHtml(dayLabel(event.date, data.locale))}</span><br><strong class="az-ink" style="color:${C.ink};font-size:14px">${escapeHtml(event.time ?? W.timeUnknown)}</strong></td>
<td valign="middle" class="az-ink az-rule" style="padding:11px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:14px;line-height:20px;font-weight:700;color:${C.ink}"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${C.brass};vertical-align:middle;margin-right:9px"></span>${escapeHtml(event.title)}</td>
</tr>`,
    )
    .join("\n");
  return `${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-meta" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${rows}</table>`;
}

export type DigestPersonal = { symbol: string; date: string; timing: "bmo" | "amc" | "other" }[];

function personalBlock(personal: DigestPersonal, locale: Locale, W: Copy["weeklyMail"]): string {
  if (personal.length === 0) return "";
  const rows = personal
    .slice(0, 8)
    .map(
      (p, i) => `<tr>
<td valign="middle" class="az-rule" style="padding:8px 0;${i ? `border-top:1px solid ${C.line};` : ""}"><a href="${escapeHtml(pathFor(`/hisse/${p.symbol}`, locale))}" target="_blank" style="text-decoration:none"><strong class="az-ink" style="font-family:${MONO};font-size:14px;line-height:18px;color:${C.ink}">${escapeHtml(p.symbol)}</strong></a></td>
<td valign="middle" align="right" class="az-muted az-rule" style="padding:8px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted}">${escapeHtml(`${dayLabel(p.date, locale)} · ${p.timing === "bmo" ? W.bmo : p.timing === "amc" ? W.amc : W.other}`)}</td>
</tr>`,
    )
    .join("");
  const more = personal.length > 8 ? `<p class="az-muted" style="margin:8px 0 0;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${escapeHtml(W.personalMore.replace("{n}", String(personal.length - 8)))}</p>` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0"><tr><td class="az-note az-rise" style="${delay(100)}background:${C.sunken};border:1px solid ${C.line};border-left:3px solid ${C.primary};border-radius:14px;padding:16px 18px 12px">
<p class="az-ink" style="margin:0 0 6px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:800;color:${C.ink}">${escapeHtml(W.personalTitle)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>${more}
</td></tr></table>`;
}

/** Bölüm bandının altındaki yorum paragrafı — sitenin okuma gövdesi gibi, kutusuz. */
function commentaryBlock(text: string | undefined, W: Copy["weeklyMail"], last: boolean): string {
  if (!text) return "";
  return `<p class="az-ink" style="margin:18px 0 0;font-family:${FONT};font-size:16px;line-height:26px;color:${C.ink}">${escapeHtml(text)}</p>${
    last ? `<p class="az-muted" style="margin:8px 0 0;font-family:${FONT};font-size:11px;line-height:16px;color:${C.muted}">${escapeHtml(W.commentaryNote)}</p>` : ""
  }`;
}

export function weeklyEmailMessage(recipient: Recipient, data: DigestData, personal: DigestPersonal, copy: Copy): Email {
  const W = copy.weeklyMail;
  const { locale } = recipient;
  const pastRange = weekRangeLabel(data.pastMonday, data.pastFriday, locale);
  const thisRange = weekRangeLabel(data.thisMonday, data.thisFriday, locale);
  const greeting = W.greeting.replace("{username}", recipient.username);
  const subject = W.subject.replace("{range}", thisRange);
  const calendarUrl = pathFor("/bilancolar/hafta", locale);

  const html = brandedEmailHtml({
    lang: locale,
    preheader: W.preheader,
    title: W.heroTitle,
    lead: W.heroLead.replace("{pastRange}", pastRange).replace("{thisRange}", thisRange),
    brandName: copy.common.signature,
    origin: SITE_URL,
    hero: { file: "weekly.gif", width: 560, height: 200 },
    bodyHtml: [
      emailText.greeting(greeting),
      emailText.paragraph(W.intro),
      statsBlock(data, W),
      chapter("01", W.pastSection, pastRange),
      commentaryBlock(data.commentary?.past, W, false),
      indicesBlock(data, W),
      reportedBlock(data, W),
      developmentsBlock(data, W),
      chapter("02", W.aheadSection, thisRange),
      commentaryBlock(data.commentary?.ahead, W, true),
      personalBlock(personal, locale, W),
      rhythmBlock(data, W),
      aheadBlock(data, W),
      eventsBlock(data, W),
      `<div style="height:30px;line-height:30px;font-size:0">&nbsp;</div>`,
      emailButton(W.button, calendarUrl),
      emailText.note(copy.common.notAdvice, copy.common.whyReceived),
    ].join("\n"),
    footerLines: [copy.common.noReply],
    footerLinks: footerFor(recipient, copy.common, "weekly"),
  });

  const text: string[] = [greeting, "", W.intro, "", `== ${W.pastSection} · ${pastRange} ==`];
  if (data.commentary) text.push("", data.commentary.past);
  if (data.indices.length) {
    text.push("", `${W.marketTitle} (${W.marketNote})`, ...data.indices.map((i) => `- ${i.label}: ${formatPercent(i.changePct, locale, 2)}`));
  }
  text.push("", W.reportedTitle);
  if (data.pastFailed) text.push(W.reportedFailed);
  else if (data.reported.length === 0) text.push(W.reportedEmpty);
  else {
    const { beat, inline, miss } = data.scorecard;
    if (beat + inline + miss > 0) text.push(`${beat} ${W.scoreBeat} · ${inline} ${W.scoreInline} · ${miss} ${W.scoreMiss}`);
    text.push(
      ...data.reported.map((r) => {
        const s = r.eps ?? r.revenue;
        const verdict = s ? (s.direction === "beat" ? W.beat : s.direction === "miss" ? W.miss : W.inline) : "";
        return `- ${r.symbol}${r.name ? ` (${r.name})` : ""}${verdict ? ` — ${verdict}` : ""}`;
      }),
    );
  }
  if (data.brief) text.push("", `${W.briefTitle}: ${data.brief.headline}`, pathFor(data.brief.path, locale));
  const links = [...data.stories, ...data.news];
  if (links.length) text.push("", W.newsTitle, ...links.map((l) => `- ${l.title} ${pathFor(l.path, locale)}`));
  text.push("", `== ${W.aheadSection} · ${thisRange} ==`);
  if (data.commentary) text.push("", data.commentary.ahead, `(${W.commentaryNote})`);
  if (personal.length) text.push("", W.personalTitle, ...personal.map((p) => `- ${p.symbol}: ${dayLabel(p.date, locale)}`));
  text.push("", W.aheadEarnings);
  if (data.aheadFailed) text.push(W.aheadFailed);
  else
    for (const day of data.ahead) {
      if (day.closed) text.push(`- ${dayLabel(day.date, locale)}: ${W.closed} (${day.closed})`);
      else if (day.items.length) text.push(`- ${dayLabel(day.date, locale)} (${day.total}): ${day.items.map((i) => i.symbol).join(", ")}`);
    }
  text.push("", W.eventsTitle);
  if (data.eventsFailed) text.push(W.eventsFailed);
  else if (data.events.length === 0) {
    text.push(W.eventsEmpty);
    if (data.nextEvent) text.push(`${W.eventsNext}: ${data.nextEvent.title} — ${dayLabel(data.nextEvent.date, locale)}${data.nextEvent.time ? ` ${data.nextEvent.time}` : ""}`);
  }
  else text.push(...data.events.map((e) => `- ${dayLabel(e.date, locale)} ${e.time ?? W.timeUnknown}: ${e.title}`));
  text.push("", calendarUrl, "", copy.common.notAdvice, copy.common.whyReceived, `${copy.common.unsubscribe}: ${unsubscribeUrl(recipient, "weekly")}`);

  return { to: recipient.email, subject, text: text.join("\n"), html };
}
