import { escapeHtml } from "@/lib/email";
import { EASE_BRAND } from "@/lib/motion";

/**
 * Markalı e-posta kabı (15 Ekim; 16 Ekim'de kenardan kenara bant) — şifre
 * sıfırlama bugün tek kullanıcısı; ileride doğrulama ya da bildirim postası
 * da bu kabı giyer.
 *
 * E-POSTA HTML'İ WEB DEĞİL. Kurallar istemcilerin en dar ortak paydası:
 * - Düzen TABLO, stil SATIR İÇİ. Gmail `<style>`'ı kısmen okuyor, Outlook
 *   masaüstü Word motoruyla çiziyor; satır içi stil her yerde aynı.
 * - Animasyon GIF (public/email/hero.gif — gerekçe scripts/build-email-assets.mjs):
 *   Gmail CSS animasyonunu ve SVG'yi siliyor. `<style>` yalnız İLERLEME:
 *   Apple Mail'de marka fontu, düğmenin üstünden geçen ışık ve koyu tema
 *   renkleri geliyor; okumayan istemcide posta eksiksiz. Hareketi azaltana
 *   ışık hiç geçmez.
 * - BANT GIF'İN KENDİSİ, başlık kartın İÇİNDE. İlk sürümde başlık koyu bandın
 *   içindeydi ve GIF bandın ortasında küçük bir kareydi: Gmail iOS koyu temada
 *   sayfayı TAM ters çeviriyor, bant açılıyor ama GIF çevrilmiyor — bandın
 *   ortasında koyu bir kare kalıyordu. Şimdi ters çeviren istemcide kart
 *   kararıyor, bant zaten koyu; Gmail Android/web açık kartı kendisi
 *   koyulaştırıyor, koyu banda dokunmuyor. Her istemcide aynı görüntü.
 * - Düğme "kurşun geçirmez": bağlantının kendisi dolgulu blok, arka plan hem
 *   `bgcolor` hem degrade — degradeyi silen istemcide düz marka mavisi kalır.
 *   Telefonda tam genişlik (medya sorgusu; okumayan istemcide yine dolgulu).
 *
 * MARKA FONTU sitenin kökünden (public/email/*.woff2, SIL OFL 1.1), Google
 * Fonts'tan DEĞİL: postayı açan okurun IP'si üçüncü tarafa gitmesin (KVKK).
 * Türkçe iki alt küme ister — `ı` latin'de, `ş ğ İ` latin-ext'te. Font
 * desteklemeyen istemci (Gmail) sistem fontuna düşer; ölçüldü: 390 pikselde
 * metin bir satır fazla kırılıyor (posta 1118 → 1138 piksel), 640'ta fark
 * yok — düzen sabit yükseklik varsaymıyor.
 *
 * OUTLOOK MASAÜSTÜ (Word motoru) ayrı ele alınır: yığının başındaki web
 * fontunu bulamayınca yığının gerisine bakmadan Times New Roman basıyor,
 * `max-width`i okumuyor (sütun okuma bölmesinin tamamına yayılıyor) ve
 * `<a>` üzerindeki dolguyu yok sayıyor. `@font-face` `@media screen` içinde
 * (Word medya bloğunu okumaz), `[if mso]` blokları fontu Segoe UI'a, sütunu
 * 560 piksellik bir "hayalet" tabloya sabitliyor; düğmenin dolgusu
 * `mso-padding-alt` ile hücrede.
 *
 * Görseller postanın gönderildiği sitenin kökünden (`origin`) yüklenir;
 * bağlantı adresi zaten mutlak olduğu için ayrı bir ayar gerekmiyor.
 *
 * Renkler sitenin token'larından elle aktarıldı (posta CSS değişkeni
 * okumuyor): marka mavisi #1268c9, karo degradesi #5cc4ff → #1f86e0 →
 * #0b3f86, metin #0f1b2d / #3b4a5e, sessiz #6b7a90, pirinç #b8862f.
 */

export const C = {
  page: "#eef2f8",
  card: "#ffffff",
  band: "#0b2a5b",
  ink: "#0f1b2d",
  body: "#3b4a5e",
  muted: "#6b7a90",
  line: "#e3e8ef",
  sunken: "#f4f7fb",
  primary: "#1268c9",
  brass: "#b8862f",
  /* Yön renkleri sitenin --up / --down token'ları; yıkamalar postada
     saydamlık yerine düz renk (Outlook rgba okumuyor). */
  up: "#0c7350",
  upWash: "#e5f2ec",
  down: "#c01a3d",
  downWash: "#fbe8ec",
};

/* Yığın KISA (17 Ekim): her hücrede satır içi tekrarlandığı için pazar
   özetinde ~300 kez geçiyor ve postanın üçte birini tutuyordu. Gmail 102
   KB'ı aşan postayı kırpıp ALTINI (çıkış bağlantısı dahil) gizliyor.
   BlinkMacSystemFont ve Helvetica Neue düştü: -apple-system ikisini de
   karşılıyor. */
export const FONT = "'Schibsted Grotesk',-apple-system,'Segoe UI',Roboto,Arial,sans-serif";
export const MONO = "ui-monospace,Menlo,Consolas,monospace";

export type BrandedEmail = {
  lang: "tr" | "en";
  /** Gelen kutusunda konunun yanında görünen gizli önizleme satırı. */
  preheader: string;
  title: string;
  lead: string;
  /** Kartın gövdesi — HTML, çağıran kaçışlar (`escapeHtml`). */
  bodyHtml: string;
  /** Kart altındaki küçük satırlar — düz metin, burada kaçışlanır. */
  footerLines: string[];
  brandName: string;
  /** Sitenin kökü — görseller, font ve alt bağlantılar buradan. */
  origin: string;
  footerLinks: { label: string; href: string }[];
  /** Bant görseli — varsayılan zil bandı (hero.gif, 560×220). Pazar özeti
      kendi hafta bandını giyer (weekly.gif, 560×200). */
  hero?: { file: string; width: number; height: number };
};

/** Kurşun geçirmez birincil düğme. */
export function emailButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="az-btn-table" style="border-collapse:separate">
<tr><td class="az-btn" align="center" bgcolor="${C.primary}" style="mso-padding-alt:16px 30px;border-radius:14px;background:${C.primary};background-image:linear-gradient(135deg,#2a8ff0 0%,${C.primary} 55%,#0b4fa3 100%);box-shadow:0 8px 20px -8px rgba(18,104,201,.55)">
<a href="${escapeHtml(href)}" target="_blank" class="az-btn-link" style="display:inline-block;padding:16px 30px;font-family:${FONT};font-size:16px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:14px;letter-spacing:.01em">${escapeHtml(label)}&nbsp;&nbsp;&rarr;</a>
</td></tr></table>`;
}

/**
 * Künye tablosu — "İstek Zamanı · 16 Ekim 2026 · 18:04 İstanbul" gibi
 * etiket/değer satırları, aralarında ince çizgi (sitedeki künye düzeni:
 * kutu değil, hairline). Değerler sağa yaslı; `tnum` YOK — Schibsted
 * Grotesk'te iki noktayı da rakam genişliğine çekip "18 : 04" basıyor
 * (sitede de kökte kapalı, app/layout.tsx).
 */
export function emailMeta(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (row, i) =>
        `<tr><td class="az-muted${i ? " az-rule" : ""}" style="padding:11px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:13px;line-height:18px;color:${C.muted}"><span style="display:inline-block;width:6px;height:6px;border-radius:3px;background:${C.brass};vertical-align:middle;margin-right:9px"></span>${escapeHtml(row.label)}</td>
<td align="right" class="az-ink${i ? " az-rule" : ""}" style="padding:11px 0 11px 16px;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:13px;line-height:18px;font-weight:600;color:${C.ink}">${escapeHtml(row.value)}</td></tr>`,
    )
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-meta" style="margin:26px 0 0;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">
${cells}
</table>`;
}

/*
 * <style> notları (17 Ekim) — postanın içine girmesin diye burada:
 * - Pazar özetinin girişleri yalnız Apple Mail / iOS Mail oynatır; Gmail
 *   <style> animasyonunu siler ve son kare satır içi stilin kendisi:
 *   animasyon yalnız BAŞTAN gelir. Çubuk büyür (yatay soldan, dikey
 *   dipten), kutu yükselir. Eğri sitenin --ease-brand'i (EASE_BRAND);
 *   posta CSS değişkeni okumuyor.
 * - Ölçü kutuları telefonda da yan yana (390'da ölçüldü: alt alta üç kutu
 *   330 piksel tutuyordu); punto ve dolgu küçülür.
 * - Sol şerit RENK TAŞIYOR (pirinç not, mavi kişisel kutu, yön rengi alarm
 *   karosu): koyu temada yalnız öteki üç kenar koyulur. İlk sürüm
 *   border-color yazıyordu ve alarm karosunun yön şeridi griye, kişisel
 *   kutunun mavisi pirince dönüyordu (17 Ekim denetimi).
 */
export function brandedEmailHtml(email: BrandedEmail): string {
  const origin = email.origin.replace(/\/$/, "");
  const hero = email.hero ?? { file: "hero.gif", width: 560, height: 220 };
  const asset = (file: string) => escapeHtml(`${origin}/email/${file}`);
  const links = email.footerLinks
    .map(
      (link) =>
        `<a href="${escapeHtml(link.href)}" target="_blank" class="az-muted" style="color:${C.muted};text-decoration:underline">${escapeHtml(link.label)}</a>`,
    )
    .join(`&nbsp;&nbsp;&middot;&nbsp;&nbsp;`);
  const footer = email.footerLines
    .map(
      (line) =>
        `<p class="az-muted" style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted}">${escapeHtml(line)}</p>`,
    )
    .join("");

  /* Satır başı girintileri atılır (boyut, yukarıdaki FONT notu). */
  return `<!doctype html>
<html lang="${email.lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(email.title)}</title>
<style>
  @media screen {
  @font-face { font-family:'Schibsted Grotesk'; font-style:normal; font-weight:400 900; font-display:swap;
    src:url(${asset("schibsted-grotesk-latin-ext.woff2")}) format('woff2');
    unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF; }
  @font-face { font-family:'Schibsted Grotesk'; font-style:normal; font-weight:400 900; font-display:swap;
    src:url(${asset("schibsted-grotesk-latin.woff2")}) format('woff2');
    unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD; }
  }
  :root { color-scheme: light dark; }
  body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
  a { text-decoration:none; }
  /* Apple Mail: düğmenin üstünden geçen ışık — Gmail siler, posta onsuz tam. */
  @keyframes az-sheen { 0%,62% { background-position:-180% 0; } 100% { background-position:280% 0; } }
  .az-btn-link { background-image:linear-gradient(110deg,rgba(255,255,255,0) 35%,rgba(255,255,255,.28) 50%,rgba(255,255,255,0) 65%); background-size:220% 100%; background-repeat:no-repeat; animation:az-sheen 4.6s ease-in-out 1.2s infinite; }
  @keyframes az-grow-x { from { transform:scaleX(0); } to { transform:scaleX(1); } }
  @keyframes az-grow-y { from { transform:scaleY(0); } to { transform:scaleY(1); } }
  @keyframes az-rise { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
  .az-grow-x { transform-origin:left center; animation:az-grow-x .9s ${EASE_BRAND} both; }
  .az-grow-y { transform-origin:center bottom; animation:az-grow-y .8s ${EASE_BRAND} both; }
  .az-rise { animation:az-rise .7s ${EASE_BRAND} both; }
  @media (prefers-reduced-motion: reduce) { .az-btn-link { animation:none; background-image:none; } .az-grow-x, .az-grow-y, .az-rise { animation:none !important; } }
  @media (max-width:600px) {
    .az-shell { padding:16px 10px 28px !important; }
    .az-pad { padding-left:22px !important; padding-right:22px !important; }
    .az-title { font-size:27px !important; line-height:32px !important; }
    .az-btn-table { width:100% !important; }
    .az-btn-link { display:block !important; text-align:center !important; }
    .az-stack { display:block !important; width:100% !important; }
    .az-stack-gap { padding:0 0 10px !important; }
    .az-hide-sm { display:none !important; }
    .az-stat-box { padding:12px 10px 11px !important; border-radius:14px !important; }
    .az-stat-val { font-size:20px !important; line-height:24px !important; }
  }
  @media (prefers-color-scheme: dark) {
    .az-page { background:#0a0f18 !important; }
    .az-card { background:#121a26 !important; border-color:#223047 !important; }
    .az-ink { color:#eef3fa !important; }
    .az-body { color:#b4c1d3 !important; }
    .az-muted { color:#8b99ad !important; }
    .az-note { background:#172234 !important; border-top-color:#223047 !important; border-right-color:#223047 !important; border-bottom-color:#223047 !important; }
    .az-meta, .az-rule { border-color:#223047 !important; }
    .az-link { color:#5cb0ff !important; }
    .az-sunken { background:#172234 !important; border-top-color:#223047 !important; border-right-color:#223047 !important; border-bottom-color:#223047 !important; }
    .az-sunken-flat { border-left-color:#223047 !important; }
    .az-chapter { background:#16233a !important; border-top-color:#223047 !important; border-right-color:#223047 !important; border-bottom-color:#223047 !important; }
    .az-chapter-index { background:#0f1a2b !important; border-color:#223047 !important; color:#e3b864 !important; }
    .az-lane { background:#223047 !important; }
    .az-zero { background:#3a4c66 !important; }
    .az-up-fill { background:#3ddc97 !important; }
    .az-down-fill { background:#ff5c7a !important; }
    .az-flat-fill { background:#5d6f88 !important; }
    .az-ink-fill { background:#4f86d1 !important; background-image:none !important; }
    .az-up { color:#3ddc97 !important; }
    .az-down { color:#ff5c7a !important; }
    .az-up-wash { background:#10301f !important; color:#3ddc97 !important; }
    .az-down-wash { background:#3a1520 !important; color:#ff5c7a !important; }
    .az-flat-wash { background:#1d2a3d !important; color:#b4c1d3 !important; }
  }
</style>
<!--[if mso]><style>body,table,td,p,a,span,h1{font-family:'Segoe UI',Arial,sans-serif !important;}</style><![endif]-->
</head>
<body class="az-page" style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(email.preheader)}${"&#8199;&#65279;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="az-page" bgcolor="${C.page}" style="background:${C.page}">
<tr><td align="center" class="az-shell" style="padding:32px 16px 36px">
<!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">

<tr><td align="center" style="padding:0 0 18px">
<a href="${escapeHtml(origin)}" target="_blank" style="text-decoration:none">
<img src="${escapeHtml(origin)}/icon-192.png" width="30" height="30" alt="" style="display:inline-block;width:30px;height:30px;border:0;border-radius:9px;vertical-align:middle">
<span class="az-ink" style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:${FONT};font-size:17px;font-weight:800;letter-spacing:-.02em;color:${C.ink}">${escapeHtml(email.brandName)}</span>
</a>
</td></tr>

<tr><td class="az-card" style="background:${C.card};border:1px solid ${C.line};border-radius:24px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td bgcolor="${C.band}" style="background:${C.band};border-radius:23px 23px 0 0;padding:0;font-size:0;line-height:0">
<img src="${asset(hero.file)}" width="${hero.width}" height="${hero.height}" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:23px 23px 0 0">
</td></tr>
<tr><td class="az-pad" style="padding:32px 40px 36px">
<h1 class="az-title az-ink" style="margin:0;font-family:${FONT};font-size:30px;line-height:36px;font-weight:800;letter-spacing:-.03em;color:${C.ink}">${escapeHtml(email.title)}</h1>
<p class="az-body" style="margin:10px 0 26px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.body}">${escapeHtml(email.lead)}</p>
${email.bodyHtml}
</td></tr>
</table>
</td></tr>

<tr><td align="center" style="padding:24px 24px 0">
${footer}
<p class="az-muted" style="margin:6px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted}">${links}</p>
</td></tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`.replace(/\n[ \t]+/g, "\n");
}

/**
 * Bölüm başlığı — postanın içindeki `h2`. Sitedeki panel başlığı gibi kutu
 * değil, ton: pirinç kısa çizgi + koyu başlık + istenirse sağda künye.
 */
export function emailSection(title: string, meta?: string, first = false): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:${first ? "6px" : "34px"} 0 14px">
<tr><td style="padding:0 0 8px"><span style="display:block;width:28px;height:3px;border-radius:2px;background:${C.brass};font-size:0;line-height:0">&nbsp;</span></td></tr>
<tr><td><h2 class="az-ink" style="margin:0;font-family:${FONT};font-size:20px;line-height:26px;font-weight:800;letter-spacing:-.02em;color:${C.ink}">${escapeHtml(title)}</h2>${
    meta ? `<p class="az-muted" style="margin:4px 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted}">${escapeHtml(meta)}</p>` : ""
  }</td></tr>
</table>`;
}

/** Gövde parçaları — ortak tipografi, satır içi. */
export const emailText = {
  greeting: (text: string) =>
    `<p class="az-ink az-rule" style="margin:0 0 10px;padding-top:24px;border-top:1px solid ${C.line};font-family:${FONT};font-size:17px;line-height:24px;font-weight:700;color:${C.ink}">${escapeHtml(text)}</p>`,
  paragraph: (text: string) =>
    `<p class="az-body" style="margin:0 0 26px;font-family:${FONT};font-size:15px;line-height:24px;color:${C.body}">${escapeHtml(text)}</p>`,
  /** Düğme çalışmazsa kopyalanacak çıplak adres. */
  fallback: (label: string, href: string) =>
    `<p class="az-muted" style="margin:22px 0 6px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted}">${escapeHtml(label)}</p>
<p style="margin:0;font-family:${MONO};font-size:12px;line-height:18px;word-break:break-all"><a href="${escapeHtml(href)}" target="_blank" class="az-link" style="color:${C.primary};text-decoration:none">${escapeHtml(href)}</a></p>`,
  /** Tonlu not kutusu — güvenlik uyarısı gibi ikincil bilgi. */
  note: (title: string, text: string) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px"><tr><td class="az-note" style="background:${C.sunken};border:1px solid ${C.line};border-left:3px solid ${C.brass};border-radius:14px;padding:16px 18px">
<p class="az-ink" style="margin:0 0 4px;font-family:${FONT};font-size:13px;line-height:18px;font-weight:700;color:${C.ink}">${escapeHtml(title)}</p>
<p class="az-body" style="margin:0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.body}">${escapeHtml(text)}</p>
</td></tr></table>`,
};
