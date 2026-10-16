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
   Pazartesi özeti
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

function chip(text: string, tone: "up" | "down" | "flat"): string {
  const map = {
    up: { bg: C.upWash, ink: C.up, cls: "az-up-wash" },
    down: { bg: C.downWash, ink: C.down, cls: "az-down-wash" },
    flat: { bg: C.sunken, ink: C.body, cls: "az-flat-wash" },
  }[tone];
  return `<span class="${map.cls}" style="display:inline-block;padding:3px 9px;border-radius:999px;background:${map.bg};color:${map.ink};font-family:${FONT};font-size:11px;line-height:16px;font-weight:700;white-space:nowrap">${escapeHtml(text)}</span>`;
}

function indicesBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  if (data.indices.length === 0) return "";
  const cells = data.indices.map((index) => {
    const tone = index.changePct > 0 ? "up" : index.changePct < 0 ? "down" : "flat";
    const color = tone === "up" ? C.up : tone === "down" ? C.down : C.body;
    const cls = tone === "up" ? "az-up" : tone === "down" ? "az-down" : "az-body";
    return `<td width="50%" valign="top" style="padding:5px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="az-sunken" style="background:${C.sunken};border:1px solid ${C.line};border-radius:14px;padding:14px 16px">
<p class="az-muted" style="margin:0;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${escapeHtml(index.label)}</p>
<p class="${cls}" style="margin:3px 0 0;font-family:${FONT};font-size:22px;line-height:28px;font-weight:800;letter-spacing:-.02em;color:${color}">${escapeHtml(formatPercent(index.changePct, data.locale, 2))}</p>
</td></tr></table></td>`;
  });
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`);
  return `${emailSection(W.marketTitle, W.marketNote)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table>`;
}

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
  return parts.join("&nbsp;");
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
${link ? `<br>${link}` : ""}
</td>
<td valign="top" align="right" class="az-stack" style="text-align:right">${surpriseChip(report, W, data.locale)}</td>
</tr></table></td></tr>`;
    })
    .join("\n");
  return `${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-meta" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${rows}</table>`;
}

function linkList(links: DigestData["news"], locale: Locale): string {
  return links
    .map(
      (link, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px"><tr>
<td valign="top" width="28" style="padding-top:1px"><span style="display:inline-block;width:22px;height:22px;border-radius:11px;background:${C.band};color:#ffffff;font-family:${FONT};font-size:11px;line-height:22px;font-weight:800;text-align:center">${i + 1}</span></td>
<td valign="top"><a href="${escapeHtml(pathFor(link.path, locale))}" target="_blank" class="az-ink" style="font-family:${FONT};font-size:15px;line-height:21px;font-weight:700;color:${C.ink};text-decoration:none">${escapeHtml(link.title)}</a>${
        link.meta ? `<p class="az-muted" style="margin:3px 0 0;font-family:${FONT};font-size:12px;line-height:17px;color:${C.muted}">${escapeHtml(link.meta.length > 140 ? `${link.meta.slice(0, 139)}…` : link.meta)}</p>` : ""
      }</td></tr></table>`,
    )
    .join("\n");
}

function developmentsBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  const links = [...data.stories, ...data.news];
  const brief = data.brief
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px"><tr><td class="az-note" style="background:${C.sunken};border:1px solid ${C.line};border-left:3px solid ${C.brass};border-radius:14px;padding:16px 18px">
<p class="az-muted" style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:16px;color:${C.muted}">${escapeHtml(W.briefTitle)}</p>
<p class="az-ink" style="margin:0 0 8px;font-family:${FONT};font-size:16px;line-height:22px;font-weight:800;color:${C.ink}">${escapeHtml(data.brief.headline)}</p>
<a href="${escapeHtml(pathFor(data.brief.path, data.locale))}" target="_blank" class="az-link" style="font-family:${FONT};font-size:13px;line-height:18px;font-weight:700;color:${C.primary};text-decoration:none">${escapeHtml(W.briefLink)}&nbsp;&rarr;</a>
</td></tr></table>`
    : "";
  if (!brief && links.length === 0) return "";
  return `${emailSection(W.newsTitle)}${brief}${linkList(links, data.locale)}`;
}

function aheadBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  const head = emailSection(W.aheadEarnings);
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
          return `<p class="az-muted" style="margin:0 0 3px;font-family:${FONT};font-size:11px;line-height:15px;color:${C.muted}">${escapeHtml(label)}</p>
<p style="margin:0 0 8px;font-family:${MONO};font-size:13px;line-height:19px;font-weight:700"><span class="az-ink" style="color:${C.ink}">${items.map((item) => escapeHtml(item.symbol)).join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</span></p>`;
        })
        .join("");
      return `<tr>
<td valign="top" width="92" class="az-rule" style="padding:12px 10px 4px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:13px;line-height:18px;font-weight:800;color:${C.ink}"><span class="az-ink">${escapeHtml(dayLabel(day.date, data.locale))}</span></td>
<td valign="top" class="az-rule" style="padding:12px 0 4px;${i ? `border-top:1px solid ${C.line};` : ""}">${
        day.closed ? `<p style="margin:0 0 8px">${chip(`${W.closed} · ${day.closed}`, "flat")}</p>` : groups
      }</td></tr>`;
    })
    .join("\n");
  return `${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-meta" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${rows}</table>`;
}

function eventsBlock(data: DigestData, W: Copy["weeklyMail"]): string {
  const head = emailSection(W.eventsTitle);
  if (data.eventsFailed) return `${head}${emailText.paragraph(W.eventsFailed)}`;
  if (data.events.length === 0) return `${head}${emailText.paragraph(W.eventsEmpty)}`;
  const rows = data.events
    .map(
      (event, i) => `<tr>
<td valign="top" width="92" class="az-muted az-rule" style="padding:10px 10px 10px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted}">${escapeHtml(dayLabel(event.date, data.locale))}<br><strong class="az-ink" style="color:${C.ink}">${escapeHtml(event.time ?? W.timeUnknown)}</strong></td>
<td valign="top" class="az-ink az-rule" style="padding:10px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:14px;line-height:20px;font-weight:700;color:${C.ink}"><span style="display:inline-block;width:7px;height:7px;border-radius:4px;background:${C.down};vertical-align:middle;margin-right:8px"></span>${escapeHtml(event.title)}</td>
</tr>`,
    )
    .join("\n");
  return `${head}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-meta" style="border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">${rows}</table>`;
}

export type DigestPersonal = { symbol: string; date: string; timing: "bmo" | "amc" | "other" }[];

function personalBlock(personal: DigestPersonal, locale: Locale, W: Copy["weeklyMail"]): string {
  if (personal.length === 0) return "";
  const items = personal
    .slice(0, 8)
    .map((p) => `<strong class="az-ink" style="font-family:${MONO};color:${C.ink}">${escapeHtml(p.symbol)}</strong> <span class="az-muted" style="color:${C.muted}">${escapeHtml(`${dayLabel(p.date, locale)} · ${p.timing === "bmo" ? W.bmo : p.timing === "amc" ? W.amc : W.other}`)}</span>`)
    .join("<br>");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:30px 0 0"><tr><td class="az-note" style="background:${C.sunken};border:1px solid ${C.line};border-left:3px solid ${C.primary};border-radius:14px;padding:16px 18px">
<p class="az-ink" style="margin:0 0 8px;font-family:${FONT};font-size:14px;line-height:18px;font-weight:800;color:${C.ink}">${escapeHtml(W.personalTitle)}</p>
<p class="az-body" style="margin:0;font-family:${FONT};font-size:13px;line-height:22px;color:${C.body}">${items}</p>
</td></tr></table>`;
}

/** Bölüm ayırıcı — "Geçen Hafta" / "Bu Hafta Bizi Ne Bekliyor" büyük başlığı. */
function chapter(title: string, range: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:40px 0 0"><tr><td bgcolor="${C.band}" style="background:${C.band};background-image:linear-gradient(135deg,#123c7a 0%,${C.band} 60%,#081d40 100%);border-radius:16px;padding:16px 20px">
<p style="margin:0;font-family:${FONT};font-size:18px;line-height:24px;font-weight:800;letter-spacing:-.02em;color:#ffffff">${escapeHtml(title)}</p>
<p style="margin:2px 0 0;font-family:${FONT};font-size:12px;line-height:16px;color:#c9d6ea">${escapeHtml(range)}</p>
</td></tr></table>`;
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
    bodyHtml: [
      emailText.greeting(greeting),
      emailText.paragraph(W.intro),
      chapter(W.pastSection, pastRange),
      indicesBlock(data, W),
      reportedBlock(data, W),
      developmentsBlock(data, W),
      chapter(W.aheadSection, thisRange),
      personalBlock(personal, locale, W),
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
  if (data.indices.length) {
    text.push("", `${W.marketTitle} (${W.marketNote})`, ...data.indices.map((i) => `- ${i.label}: ${formatPercent(i.changePct, locale, 2)}`));
  }
  text.push("", W.reportedTitle);
  if (data.pastFailed) text.push(W.reportedFailed);
  else if (data.reported.length === 0) text.push(W.reportedEmpty);
  else
    text.push(
      ...data.reported.map((r) => {
        const s = r.eps ?? r.revenue;
        const verdict = s ? (s.direction === "beat" ? W.beat : s.direction === "miss" ? W.miss : W.inline) : "";
        return `- ${r.symbol}${r.name ? ` (${r.name})` : ""}${verdict ? ` — ${verdict}` : ""}`;
      }),
    );
  if (data.brief) text.push("", `${W.briefTitle}: ${data.brief.headline}`, pathFor(data.brief.path, locale));
  const links = [...data.stories, ...data.news];
  if (links.length) text.push("", W.newsTitle, ...links.map((l) => `- ${l.title} ${pathFor(l.path, locale)}`));
  text.push("", `== ${W.aheadSection} · ${thisRange} ==`);
  if (personal.length) text.push("", W.personalTitle, ...personal.map((p) => `- ${p.symbol}: ${dayLabel(p.date, locale)}`));
  text.push("", W.aheadEarnings);
  if (data.aheadFailed) text.push(W.aheadFailed);
  else
    for (const day of data.ahead) {
      if (day.closed) text.push(`- ${dayLabel(day.date, locale)}: ${W.closed} (${day.closed})`);
      else if (day.items.length) text.push(`- ${dayLabel(day.date, locale)}: ${day.items.map((i) => i.symbol).join(", ")}`);
    }
  text.push("", W.eventsTitle);
  if (data.eventsFailed) text.push(W.eventsFailed);
  else if (data.events.length === 0) text.push(W.eventsEmpty);
  else text.push(...data.events.map((e) => `- ${dayLabel(e.date, locale)} ${e.time ?? W.timeUnknown}: ${e.title}`));
  text.push("", calendarUrl, "", copy.common.notAdvice, copy.common.whyReceived, `${copy.common.unsubscribe}: ${unsubscribeUrl(recipient, "weekly")}`);

  return { to: recipient.email, subject, text: text.join("\n"), html };
}
