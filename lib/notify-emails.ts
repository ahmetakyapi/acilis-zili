import { randomUUID } from "node:crypto";
import { escapeHtml, type Email } from "@/lib/email";
import { C, FONT, MONO, brandedEmailHtml, emailButton, emailMeta, emailSection, emailText, keepTogetherHtml } from "@/lib/email-layout";
import type { Recipient } from "@/lib/email-notify";
import { unsubscribeUrl } from "@/lib/email-notify";
import type { emailNotifyTr } from "@/lib/i18n/dictionaries/email-notify";
import type { Locale } from "@/lib/i18n/config";
import { displayZone, formatInZone } from "@/lib/session-clock";
import { SITE_URL } from "@/lib/site";
import { formatMoneyCompact, formatPercent, formatPrice } from "@/lib/utils";

/**
 * Postadaki yüzde — işaretle yüzde bitişik: "+%8,3", "−%1,97". Sitenin
 * formatPercent'i işaretten sonra ince boşluk bırakıyor; postada sistem
 * fontuna düşen istemcide (Gmail) o boşluk tam boşluk genişliğinde
 * basılıp "+ %8,3" gibi kopuk duruyordu (17 Ekim, sahibinin itirazı).
 * Yorum istemi de bu biçimi görür ki Claude aynısını kopyalasın.
 */
export function emailPercent(value: number, locale: Locale, digits = 2): string {
  return formatPercent(value, locale, digits).replace(/^([+\u2212])\s+/u, "$1");
}
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
    const threshold = emailPercent(alert.direction === "up" ? alert.thresholdPct : -alert.thresholdPct, locale, alert.thresholdPct % 1 === 0 ? 0 : 2);
    subject = (alert.direction === "up" ? A.subjectUp : A.subjectDown).replace("{symbol}", alert.symbol).replace("{threshold}", threshold);
    bigValue = emailPercent(alert.changePct, locale, 2);
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
/* Pirinç künye mürekkebi — C.brass beyaz zeminde 3:1'in altında kalıyor;
   koyu temada az-brass açar. */
const BRASS_INK = "#8a5f12";

const delay = (ms: number) => `animation-delay:${ms}ms;`;

function chip(text: string, tone: Tone): string {
  const t = TONE[tone];
  return `<span class="${t.washCls}" style="display:inline-block;padding:3px 9px;border-radius:999px;background:${t.wash};color:${t.ink};font-family:${FONT};font-size:11px;line-height:16px;font-weight:700;white-space:nowrap">${escapeHtml(text)}</span>`;
}

/**
 * Bölüm başlığı — "01 · 12 – 16 Ekim" künyesi üstte, büyük başlık altta.
 * ZEMİNSİZ (17 Ekim, ikinci tur): Gmail iOS koyu temada zemini ve yazıyı
 * birbirinden bağımsız çeviriyor — önce lacivert bant beyaz yazıyı, sonra
 * açık bant koyu yazıyı okunmaz bıraktı (sahibinin iki ayrı ekran
 * görüntüsü). Zemin yoksa çevrilecek tek şey yazı ve her temada okunur.
 * Ağırlığı puntodan ve alttaki 3 piksellik marka çizgisinden alıyor; çizgi
 * az-rule taşımaz, koyu temada da mavi kalır.
 */
function chapter(index: string, title: string, range: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:48px 0 0"><tr><td style="padding:0 0 14px;border-bottom:3px solid ${C.primary}">
<p class="az-brass" style="margin:0 0 6px;font-family:${MONO};font-size:13px;line-height:16px;font-weight:800;letter-spacing:.06em;color:${BRASS_INK}">${escapeHtml(index)}&nbsp;&nbsp;&middot;&nbsp;&nbsp;<span style="font-family:${FONT};letter-spacing:0">${escapeHtml(range)}</span></p>
<p class="az-ink" style="margin:0;font-family:${FONT};font-size:26px;line-height:31px;font-weight:800;letter-spacing:-.03em;color:${C.ink}">${keepTogetherHtml(title)}</p>
</td></tr></table>`;
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
<td valign="middle" align="right" width="86" class="${tone.cls}" style="font-family:${FONT};font-size:18px;line-height:22px;font-weight:800;letter-spacing:-.02em;color:${tone.ink};white-space:nowrap">${escapeHtml(emailPercent(index.changePct, data.locale, 2))}</td>
</tr></table>
${divergingBar(index.changePct, Math.abs(index.changePct) / maxWeek, i)}
</td></tr>`;
    })
    .join("\n");
  return `${emailSection(W.marketTitle, W.marketNote)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-meta" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${rows}</table>`;
}

/* ---- Büyük şirketlerin bilançoları ----
   Sayaç YOK (17 Ekim, sahibinin isteği): "kaç şirket açıkladı / kaçı aştı"
   karnesi ve ölçü kutuları kalktı; odak tek tek büyük şirketler. Şirket
   ADI başlık puntosunda, sembol künyede. Sapma iki kutuda: hisse başı kâr
   ve gelir, rakam büyük, yargı altında. */

function surpriseCell(label: string, s: DigestReport["eps"], W: Copy["weeklyMail"], locale: Locale, first: boolean, last: boolean): string {
  if (!s) return "";
  const tone = TONE[s.direction === "beat" ? "up" : s.direction === "miss" ? "down" : "flat"];
  const verdict = s.direction === "beat" ? W.beat : s.direction === "miss" ? W.miss : W.inline;
  const value = s.ratio !== null ? emailPercent(s.ratio * 100, locale, 1) : verdict;
  /* Sol şerit yön rengi; az-sunken koyu temada yalnız öteki üç kenarı koyultur. */
  return `<td valign="top" width="50%" style="padding:0 ${last ? 0 : 4}px 0 ${first ? 0 : 4}px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="az-sunken" style="background:${C.sunken};border:1px solid ${C.line};border-left:3px solid ${tone.ink};border-radius:12px;padding:10px 12px 11px">
<p class="az-muted" style="margin:0;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${escapeHtml(label)}</p>
<p class="${tone.cls}" style="margin:3px 0 0;font-family:${FONT};font-size:21px;line-height:26px;font-weight:800;letter-spacing:-.02em;color:${tone.ink};white-space:nowrap">${escapeHtml(value)}</p>${
    s.ratio !== null ? `<p class="${tone.cls}" style="margin:1px 0 0;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;color:${tone.ink}">${escapeHtml(verdict)}</p>` : ""
  }
</td></tr></table></td>`;
}

function reportedBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  const head = emailSection(W.reportedTitle, data.pastFailed || data.reported.length === 0 ? undefined : W.reportedNote);
  if (data.pastFailed) return `${head}${emailText.paragraph(W.reportedFailed)}`;
  if (data.reported.length === 0) return `${head}${emailText.paragraph(W.reportedEmpty)}`;
  const rows = data.reported
    .map((report, i) => {
      const name = report.name ? (report.name.length > 44 ? `${report.name.slice(0, 43)}…` : report.name) : report.symbol;
      const link = report.analysisPath
        ? `<span class="az-muted" style="color:${C.muted}">&nbsp;&nbsp;&middot; </span><a href="${escapeHtml(pathFor(report.analysisPath, data.locale))}" target="_blank" class="az-link" style="font-weight:700;color:${C.primary};text-decoration:none;white-space:nowrap">${escapeHtml(W.readAnalysis)}&nbsp;&rarr;</a>`
        : "";
      const cells = [
        report.eps ? (first: boolean, last: boolean) => surpriseCell(W.epsLabel, report.eps, W, data.locale, first, last) : null,
        report.revenue ? (first: boolean, last: boolean) => surpriseCell(W.revenueLabel, report.revenue, W, data.locale, first, last) : null,
      ].filter((cell) => cell !== null);
      const grid = cells.length
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:12px 0 0"><tr>${cells.map((cell, j) => cell(j === 0, j === cells.length - 1)).join("")}${cells.length === 1 ? `<td width="50%"></td>` : ""}</tr></table>`
        : "";
      const week = report.week
        ? (() => {
            const tone = TONE[toneOf(report.week.changePct)];
            return `<td valign="top" align="right" width="112" style="padding-left:12px">
<p class="${tone.cls}" style="margin:0;font-family:${FONT};font-size:21px;line-height:24px;font-weight:800;letter-spacing:-.02em;color:${tone.ink};white-space:nowrap">${escapeHtml(emailPercent(report.week.changePct, data.locale, 1))}</p>
<p class="az-muted" style="margin:3px 0 0;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted};white-space:nowrap">${escapeHtml(W.weekMove)}</p>
</td>`;
          })()
        : "";
      return `<tr><td class="az-rule" style="padding:18px 0;${i ? `border-top:1px solid ${C.line};` : ""}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="top">
<a href="${escapeHtml(pathFor(`/hisse/${report.symbol}`, data.locale))}" target="_blank" class="az-ink" style="font-family:${FONT};font-size:19px;line-height:24px;font-weight:800;letter-spacing:-.02em;color:${C.ink};text-decoration:none">${escapeHtml(name)}</a>
<p style="margin:4px 0 0;font-family:${FONT};font-size:13px;line-height:19px"><span class="az-muted" style="font-family:${MONO};font-size:12px;font-weight:800;color:${C.muted}">${escapeHtml(report.symbol)}</span><span class="az-muted" style="color:${C.muted}">&nbsp;&nbsp;&middot; </span><span class="az-muted" style="color:${C.muted};white-space:nowrap">${escapeHtml(dayLabel(report.reportDate, data.locale))}</span>${link}</p>
</td>${week}</tr></table>
${grid}
</td></tr>`;
    })
    .join("\n");
  return `${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-meta" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${rows}</table>`;
}

/* ---- Gelişmeler ---- */

function linkList(links: DigestData["news"], locale: Locale): string {
  /* Numara zeminsiz pirinç: renkli küçük karo Gmail iOS koyu temada açık
     kalıp numarayı okunmaz bırakıyordu (17 Ekim). Sıfırsız "1, 2, 3"
     (sahibinin isteği; "01" kod künyesi gibi duruyordu). */
  const rows = links
    .map(
      (link, i) => `<tr>
<td valign="top" width="40" class="az-rule" style="padding:15px 0;${i ? `border-top:1px solid ${C.line};` : ""}"><span class="az-brass" style="font-family:${MONO};font-size:15px;line-height:24px;font-weight:800;color:${BRASS_INK}">${i + 1}</span></td>
<td valign="top" class="az-rule" style="padding:15px 0;${i ? `border-top:1px solid ${C.line};` : ""}"><a href="${escapeHtml(pathFor(link.path, locale))}" target="_blank" class="az-ink" style="font-family:${FONT};font-size:17px;line-height:24px;font-weight:800;letter-spacing:-.01em;color:${C.ink};text-decoration:none">${escapeHtml(link.title)}</a>${
        link.meta ? `<p class="az-body" style="margin:5px 0 0;font-family:${FONT};font-size:14px;line-height:21px;color:${C.body}">${escapeHtml(link.meta.length > 170 ? `${link.meta.slice(0, 169)}…` : link.meta)}</p>` : ""
      }</td></tr>`,
    )
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
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

/* ---- Yeni hafta: gün gün büyük şirketler, veriler ----
   Günün şirket SAYISI ve sayı sütunları kalktı (17 Ekim, sahibinin isteği);
   her gün en büyük şirketler ADIYLA, sembol sağda künye. */

function dayLong(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(utcDay(date));
}

function tile(item: DigestData["ahead"][number]["items"][number], locale: Locale): string {
  const href = escapeHtml(pathFor(`/hisse/${item.symbol}`, locale));
  const src = item.logoUrl ? (item.logoUrl.startsWith("/") ? `${SITE_URL}${item.logoUrl}` : item.logoUrl) : null;
  const mark = src
    ? `<img src="${escapeHtml(src)}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border:0;border-radius:8px;background:#ffffff">`
    : `<span class="az-ink" style="display:block;width:32px;height:32px;border-radius:8px;background:${C.line};font-family:${MONO};font-size:13px;line-height:32px;font-weight:800;text-align:center;color:${C.ink}">${escapeHtml(item.symbol.slice(0, 1))}</span>`;
  const name = item.name ? (item.name.length > 20 ? `${item.name.slice(0, 19)}…` : item.name) : "";
  const cap = item.marketCap ? formatMoneyCompact(item.marketCap, locale) : "";
  /* Ad ve piyasa değeri ayrı satırda: 390'da tek satır "Philip Morris
     Inter… · 1,79 T $" ortasından kırılıyordu (ölçüldü). */
  const sub = [name, cap].filter(Boolean).map((part) => escapeHtml(part)).join("<br>");
  return `<td width="50%" valign="top" style="padding:3px"><a href="${href}" target="_blank" style="display:block;text-decoration:none"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-sunken" style="background:${C.sunken};border:1px solid ${C.line};border-radius:12px"><tr>
<td width="42" valign="middle" style="padding:8px 0 8px 9px">${mark}</td>
<td valign="middle" style="padding:7px 9px"><span class="az-ink" style="font-family:${MONO};font-size:14px;line-height:18px;font-weight:800;color:${C.ink}">${escapeHtml(item.symbol)}</span>${sub ? `<br><span class="az-muted" style="font-family:${FONT};font-size:11px;line-height:15px;color:${C.muted}">${sub}</span>` : ""}</td>
</tr></table></a></td>`;
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
          /* LOGOLU YATAY KAROLAR (18 Ekim, sahibinin isteği: sitedeki haftalık
             bilanço tablosunun görseli postada da olsun). İki sütun; karo
             logo + sembol + ad · piyasa değeri. Zemin açık ton: Gmail iOS
             koyu temada zemini ve yazıyı birlikte çeviriyor (bölüm bandı
             dersi). Logo yoksa sembolün baş harfi. */
          const tiles = items.map((item) => tile(item, data.locale));
          const rowsHtml: string[] = [];
          for (let k = 0; k < tiles.length; k += 2) {
            rowsHtml.push(`<tr>${tiles[k]}${tiles[k + 1] ?? `<td width="50%" style="padding:3px"></td>`}</tr>`);
          }
          return `<p class="az-brass" style="margin:12px 0 4px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;color:${BRASS_INK}">${escapeHtml(label)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 -3px">${rowsHtml.join("")}</table>`;
        })
        .join("");
      return `<tr><td class="az-rule" style="padding:18px 0 14px;${i ? `border-top:1px solid ${C.line};` : ""}">
<p class="az-ink" style="margin:0;font-family:${FONT};font-size:18px;line-height:23px;font-weight:800;letter-spacing:-.02em;color:${C.ink}">${escapeHtml(dayLong(day.date, data.locale))}</p>
${day.closed ? `<p style="margin:10px 0 0">${chip(`${W.closed} · ${day.closed}`, "flat")}</p>` : groups}
</td></tr>`;
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

/** Takip listesinin geride kalan haftası (18 Ekim) — ince yön şeridi, ortak ölçek.
    Boyut ölçümü (örnek özetle): altı hareket + not + altı bilanço satırı
    postayı 30,8'den 43,0 KB'a çıkarıyor; Gmail'in 102 KB kırpma sınırından uzak. */
function watchMoversBlock(week: WatchWeekLike | undefined, locale: Locale, W: Copy["weeklyMail"]): string {
  if (!week || week.movers.length === 0) return "";
  const max = Math.max(...week.movers.map((m) => Math.abs(m.changePct)), 0.0001);
  const rows = week.movers
    .map((m, i) => {
      const tone = TONE[toneOf(m.changePct)];
      const pct = Math.max(3, Math.round((Math.abs(m.changePct) / max) * 100));
      return `<tr>
<td valign="middle" width="64" class="az-rule" style="padding:7px 10px 7px 0;${i ? `border-top:1px solid ${C.line};` : ""}"><a href="${escapeHtml(pathFor(`/hisse/${m.symbol}`, locale))}" target="_blank" style="text-decoration:none"><strong class="az-ink" style="font-family:${MONO};font-size:13px;line-height:18px;color:${C.ink}">${escapeHtml(m.symbol)}</strong></a></td>
<td valign="middle" class="az-rule" style="padding:7px 0;${i ? `border-top:1px solid ${C.line};` : ""}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="az-lane" bgcolor="${LANE}" style="background:${LANE};border-radius:3px;height:5px;font-size:0;line-height:0"><div class="${tone.fill}" style="width:${pct}%;height:5px;border-radius:3px;background:${tone.ink};font-size:0;line-height:0">&nbsp;</div></td></tr></table></td>
<td valign="middle" align="right" width="72" class="${tone.cls} az-rule" style="padding:7px 0 7px 10px;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:13px;line-height:18px;font-weight:800;color:${tone.ink};white-space:nowrap">${escapeHtml(emailPercent(m.changePct, locale, 1))}</td>
</tr>`;
    })
    .join("");
  return `<p class="az-muted" style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;color:${C.muted}">${escapeHtml(W.watchPastTitle)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>${
    week.note ? `<p class="az-ink" style="margin:12px 0 0;font-family:${FONT};font-size:14px;line-height:22px;color:${C.ink}">${escapeHtml(week.note)}</p><p class="az-muted" style="margin:4px 0 0;font-family:${FONT};font-size:11px;line-height:15px;color:${C.muted}">${escapeHtml(W.watchNoteLabel)}</p>` : ""
  }`;
}

type WatchWeekLike = { movers: { symbol: string; changePct: number }[]; note: string | null };

function personalBlock(personal: DigestPersonal, locale: Locale, W: Copy["weeklyMail"], week?: WatchWeekLike): string {
  const moversHtml = watchMoversBlock(week, locale, W);
  if (personal.length === 0 && !moversHtml) return "";
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
<p class="az-ink" style="margin:0 0 8px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:800;color:${C.ink}">${escapeHtml(W.personalTitle)}</p>
${moversHtml}${personal.length ? `${moversHtml ? `<p class="az-muted" style="margin:14px 0 4px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;color:${C.muted}">${escapeHtml(W.watchAheadTitle)}</p>` : ""}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>${more}` : ""}
</td></tr></table>`;
}

/** Bölüm bandının altındaki yorum paragrafı — sitenin okuma gövdesi gibi, kutusuz. */
function commentaryBlock(text: string | undefined, W: Copy["weeklyMail"], last: boolean): string {
  if (!text) return "";
  return `<p class="az-ink" style="margin:18px 0 0;font-family:${FONT};font-size:16px;line-height:26px;color:${C.ink}">${escapeHtml(text)}</p>${
    last ? `<p class="az-muted" style="margin:8px 0 0;font-family:${FONT};font-size:11px;line-height:16px;color:${C.muted}">${escapeHtml(W.commentaryNote)}</p>` : ""
  }`;
}

export function weeklyEmailMessage(recipient: Recipient, data: DigestData, personal: DigestPersonal, copy: Copy, week?: WatchWeekLike): Email {
  const W = copy.weeklyMail;
  const { locale } = recipient;
  const pastRange = weekRangeLabel(data.pastMonday, data.pastFriday, locale);
  const thisRange = weekRangeLabel(data.thisMonday, data.thisFriday, locale);
  const greeting = W.greeting.replace("{username}", recipient.username);
  const subject = W.subject.replace("{range}", thisRange);
  const calendarUrl = pathFor("/bilancolar/hafta", locale);
  const ref = randomUUID();
  const trace = `<span style="display:none;font-size:0;line-height:0;max-height:0;overflow:hidden;mso-hide:all">${ref.slice(0, 13)}</span>`;

  const html = brandedEmailHtml({
    lang: locale,
    preheader: W.preheader,
    title: W.heroTitle,
    lead: W.heroLead.replace("{pastRange}", pastRange).replace("{thisRange}", thisRange),
    brandName: copy.common.signature,
    origin: SITE_URL,
    hero: { file: "weekly.gif", width: 720, height: 257 },
    bodyHtml: [
      emailText.greeting(greeting),
      emailText.paragraph(W.intro),
      chapter("1", W.pastSection, pastRange),
      commentaryBlock(data.commentary?.past, W, false),
      developmentsBlock(data, W),
      reportedBlock(data, W),
      indicesBlock(data, W),
      chapter("2", W.aheadSection, thisRange),
      commentaryBlock(data.commentary?.ahead, W, true),
      personalBlock(personal, locale, W, week),
      aheadBlock(data, W),
      eventsBlock(data, W),
      `<div style="height:30px;line-height:30px;font-size:0">&nbsp;</div>`,
      emailButton(W.button, calendarUrl),
      emailText.note(copy.common.notAdvice, W.whyReceived),
    ]
      .filter(Boolean)
      /* Her bölümün arasına postaya özgü görünmez bir iz (17 Ekim): Gmail
         aynı konulu postaları tek konuşmada topluyor ve öncekiyle AYNI kalan
         gövdeyi "…" düğmesinin arkasına katlıyordu — pazar özetinin yarısı
         kapalı geliyordu. Her gönderimde farklı iz, katlanacak ortak parça
         bırakmaz; X-Entity-Ref-ID başlığı da konuşmaya hiç eklenmesin diye. */
      .join(`\n${trace}\n`),
    footerLines: [copy.common.noReply],
    footerLinks: footerFor(recipient, copy.common, "weekly"),
  });

  const text: string[] = [greeting, "", W.intro, "", `== ${W.pastSection} · ${pastRange} ==`];
  if (data.commentary) text.push("", data.commentary.past);
  if (data.indices.length) {
    text.push("", `${W.marketTitle} (${W.marketNote})`, ...data.indices.map((i) => `- ${i.label}: ${emailPercent(i.changePct, locale, 2)}`));
  }
  text.push("", W.reportedTitle);
  if (data.pastFailed) text.push(W.reportedFailed);
  else if (data.reported.length === 0) text.push(W.reportedEmpty);
  else {
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
  if (week?.movers.length || personal.length) text.push("", W.personalTitle);
  if (week?.movers.length) text.push(...week.movers.map((m) => `- ${m.symbol}: ${emailPercent(m.changePct, locale, 1)}`));
  if (week?.note) text.push("", week.note);
  if (personal.length) text.push(...personal.map((p) => `- ${p.symbol}: ${dayLabel(p.date, locale)}`));
  text.push("", W.aheadEarnings);
  if (data.aheadFailed) text.push(W.aheadFailed);
  else
    for (const day of data.ahead) {
      if (day.closed) text.push(`- ${dayLabel(day.date, locale)}: ${W.closed} (${day.closed})`);
      else if (day.items.length) text.push(`- ${dayLabel(day.date, locale)}: ${day.items.map((i) => (i.name ? `${i.name} (${i.symbol})` : i.symbol)).join(", ")}`);
    }
  text.push("", W.eventsTitle);
  if (data.eventsFailed) text.push(W.eventsFailed);
  else if (data.events.length === 0) {
    text.push(W.eventsEmpty);
    if (data.nextEvent) text.push(`${W.eventsNext}: ${data.nextEvent.title} — ${dayLabel(data.nextEvent.date, locale)}${data.nextEvent.time ? ` ${data.nextEvent.time}` : ""}`);
  }
  else text.push(...data.events.map((e) => `- ${dayLabel(e.date, locale)} ${e.time ?? W.timeUnknown}: ${e.title}`));
  text.push("", calendarUrl, "", copy.common.notAdvice, W.whyReceived, `${copy.common.unsubscribe}: ${unsubscribeUrl(recipient, "weekly")}`);

  return { to: recipient.email, subject, text: text.join("\n"), html, headers: { "X-Entity-Ref-ID": ref } };
}
