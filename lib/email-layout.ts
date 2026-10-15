import { escapeHtml } from "@/lib/email";

/**
 * Markalı e-posta kabı (15 Ekim) — şifre sıfırlama bugün tek kullanıcısı;
 * ileride doğrulama ya da bildirim postası da bu kabı giyer.
 *
 * E-POSTA HTML'İ WEB DEĞİL. Kurallar istemcilerin en dar ortak paydası:
 * - Düzen TABLO, stil SATIR İÇİ. Gmail `<style>`'ı kısmen okuyor, Outlook
 *   masaüstü Word motoruyla çiziyor; satır içi stil her yerde aynı.
 * - Animasyon GIF (public/email/bell-ring.gif): Gmail CSS animasyonunu ve
 *   SVG'yi siliyor. `<style>` yalnız İLERLEME: Apple Mail'de düğmenin üstünden
 *   bir ışık geçiyor ve koyu tema renkleri geliyor; okumayan istemcide posta
 *   eksiksiz. Hareketi azaltana ışık hiç geçmez.
 * - Kahraman bandı DÜZ koyu lacivert ve GIF'in zemini aynı renk: Gmail'in koyu
 *   teması açık zeminleri çeviriyor ama koyu zemine dokunmuyor, yani bant iki
 *   temada da aynı görünüyor; açık kart Gmail'de kendiliğinden kararıyor.
 * - Düğme "kurşun geçirmez": bağlantının kendisi dolgulu blok, arka plan hem
 *   `bgcolor` hem degrade — degradeyi silen istemcide düz marka mavisi kalır.
 *
 * Görseller postanın gönderildiği sitenin kökünden (`origin`) yüklenir;
 * bağlantı adresi zaten mutlak olduğu için ayrı bir ayar gerekmiyor.
 *
 * Renkler sitenin token'larından elle aktarıldı (posta CSS değişkeni
 * okumuyor): marka mavisi #1268c9, karo degradesi #5cc4ff → #1f86e0 →
 * #0b3f86, metin #0f1b2d / #3b4a5e, sessiz #6b7a90.
 */

const C = {
  page: "#eef2f8",
  card: "#ffffff",
  hero: "#0b2a5b",
  heroInk: "#ffffff",
  heroLead: "#a9cdf5",
  ink: "#0f1b2d",
  body: "#3b4a5e",
  muted: "#6b7a90",
  line: "#e3e8ef",
  sunken: "#f4f7fb",
  primary: "#1268c9",
  brass: "#b8862f",
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export type BrandedEmail = {
  lang: "tr" | "en";
  /** Gelen kutusunda konunun yanında görünen gizli önizleme satırı. */
  preheader: string;
  heroTitle: string;
  heroLead: string;
  /** Kartın gövdesi — HTML, çağıran kaçışlar (`escapeHtml`). */
  bodyHtml: string;
  /** Kart altındaki küçük satırlar — düz metin, burada kaçışlanır. */
  footerLines: string[];
  brandName: string;
  /** Sitenin kökü — görseller ve alt bağlantılar buradan. */
  origin: string;
  footerLinks: { label: string; href: string }[];
};

/** Kurşun geçirmez birincil düğme. */
export function emailButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate">
<tr><td class="az-btn" bgcolor="${C.primary}" style="border-radius:14px;background:${C.primary};background-image:linear-gradient(135deg,#2a8ff0 0%,${C.primary} 55%,#0b4fa3 100%);box-shadow:0 8px 20px -8px rgba(18,104,201,.55)">
<a href="${escapeHtml(href)}" target="_blank" class="az-btn-link" style="display:inline-block;padding:16px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:14px;letter-spacing:.01em">${escapeHtml(label)}&nbsp;&nbsp;&rarr;</a>
</td></tr></table>`;
}

/** İki küçük künye çipi yan yana ("30 Dakika Geçerli", "Tek Kullanımlık"). */
export function emailChips(items: string[]): string {
  const cells = items
    .map(
      (item) =>
        `<td style="padding:0 8px 8px 0"><span class="az-chip" style="display:inline-block;padding:7px 12px;border-radius:999px;background:${C.sunken};border:1px solid ${C.line};font-family:${FONT};font-size:12px;font-weight:600;line-height:14px;color:${C.body};white-space:nowrap"><span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:${C.brass};vertical-align:middle;margin-right:7px"></span>${escapeHtml(item)}</span></td>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`;
}

export function brandedEmailHtml(email: BrandedEmail): string {
  const origin = email.origin.replace(/\/$/, "");
  const links = email.footerLinks
    .map(
      (link) =>
        `<a href="${escapeHtml(link.href)}" target="_blank" style="color:${C.muted};text-decoration:underline">${escapeHtml(link.label)}</a>`,
    )
    .join(`&nbsp;&nbsp;&middot;&nbsp;&nbsp;`);
  const footer = email.footerLines
    .map(
      (line) =>
        `<p class="az-muted" style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted}">${escapeHtml(line)}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${email.lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(email.heroTitle)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  a { text-decoration:none; }
  /* Apple Mail: düğmenin üstünden geçen ışık — Gmail siler, posta onsuz tam. */
  @keyframes az-sheen { 0%,62% { background-position:-180% 0; } 100% { background-position:280% 0; } }
  .az-btn-link { background-image:linear-gradient(110deg,rgba(255,255,255,0) 35%,rgba(255,255,255,.28) 50%,rgba(255,255,255,0) 65%); background-size:220% 100%; background-repeat:no-repeat; animation:az-sheen 4.6s ease-in-out 1.2s infinite; }
  @media (prefers-reduced-motion: reduce) { .az-btn-link { animation:none; background-image:none; } }
  @media (max-width:600px) {
    .az-shell { padding:20px 12px !important; }
    .az-pad { padding-left:24px !important; padding-right:24px !important; }
    .az-title { font-size:26px !important; line-height:32px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .az-page { background:#0a0f18 !important; }
    .az-card { background:#121a26 !important; border-color:#223047 !important; }
    .az-ink { color:#eef3fa !important; }
    .az-body { color:#b4c1d3 !important; }
    .az-muted { color:#8b99ad !important; }
    .az-note { background:#172234 !important; border-color:#223047 !important; border-left-color:#b8862f !important; }
    .az-chip { background:#172234 !important; border-color:#223047 !important; color:#b4c1d3 !important; }
    .az-rule { border-color:#223047 !important; }
  }
</style>
</head>
<body class="az-page" style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(email.preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-page" bgcolor="${C.page}" style="background:${C.page}">
<tr><td align="center" class="az-shell" style="padding:36px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">

<tr><td align="center" style="padding:0 0 20px">
<a href="${escapeHtml(origin)}" target="_blank" style="text-decoration:none">
<img src="${escapeHtml(origin)}/icon-192.png" width="32" height="32" alt="" style="display:inline-block;width:32px;height:32px;border:0;border-radius:10px;vertical-align:middle">
<span class="az-ink" style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:-.02em;color:${C.ink}">${escapeHtml(email.brandName)}</span>
</a>
</td></tr>

<tr><td class="az-card" style="background:${C.card};border:1px solid ${C.line};border-radius:24px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" bgcolor="${C.hero}" style="background:${C.hero};border-radius:23px 23px 0 0;padding:28px 24px 30px">
<img src="${escapeHtml(origin)}/email/bell-ring.gif" width="176" height="176" alt="" style="display:block;width:176px;height:176px;border:0;margin:0 auto 6px">
<h1 class="az-title" style="margin:0;font-family:${FONT};font-size:30px;line-height:36px;font-weight:800;letter-spacing:-.03em;color:${C.heroInk}">${escapeHtml(email.heroTitle)}</h1>
<p style="margin:10px auto 0;max-width:400px;font-family:${FONT};font-size:15px;line-height:23px;color:${C.heroLead}">${escapeHtml(email.heroLead)}</p>
</td></tr>
<tr><td class="az-pad" style="padding:34px 40px 36px">
${email.bodyHtml}
</td></tr>
</table>
</td></tr>

<tr><td align="center" style="padding:24px 24px 0">
${footer}
<p class="az-muted" style="margin:6px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted}">${links}</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Gövde parçaları — ortak tipografi, satır içi. */
export const emailText = {
  greeting: (text: string) =>
    `<p class="az-ink" style="margin:0 0 12px;font-family:${FONT};font-size:18px;line-height:26px;font-weight:700;color:${C.ink}">${escapeHtml(text)}</p>`,
  paragraph: (text: string) =>
    `<p class="az-body" style="margin:0 0 26px;font-family:${FONT};font-size:15px;line-height:24px;color:${C.body}">${escapeHtml(text)}</p>`,
  /** Düğme çalışmazsa kopyalanacak çıplak adres. */
  fallback: (label: string, href: string) =>
    `<p class="az-muted" style="margin:22px 0 6px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted}">${escapeHtml(label)}</p>
<p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:18px;word-break:break-all"><a href="${escapeHtml(href)}" target="_blank" style="color:${C.primary};text-decoration:none">${escapeHtml(href)}</a></p>`,
  /** Tonlu not kutusu — güvenlik uyarısı gibi ikincil bilgi. */
  note: (title: string, text: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px"><tr><td class="az-note" style="background:${C.sunken};border:1px solid ${C.line};border-left:3px solid ${C.brass};border-radius:14px;padding:16px 18px">
<p class="az-ink" style="margin:0 0 4px;font-family:${FONT};font-size:13px;line-height:18px;font-weight:700;color:${C.ink}">${escapeHtml(title)}</p>
<p class="az-body" style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.body}">${escapeHtml(text)}</p>
</td></tr></table>`,
  signature: (text: string) =>
    `<p class="az-muted az-rule" style="margin:28px 0 0;padding-top:20px;border-top:1px solid ${C.line};font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted}">${text}</p>`,
};
