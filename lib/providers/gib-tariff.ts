import type { TaxBracket } from "../tax";
import { fail, ok, type ProviderResult } from "./types";
import { BACKGROUND_TIMEOUT_MS, withTimeout } from "./timeout";

/**
 * GİB — yıllık gelir vergisi tarifesi (GVK 103), resmî kaynaktan (28 Eylül).
 *
 * Tarifeyi veren bir API yok; ama GİB portalı "Gelir Vergisi Tarifeleri"
 * sayfasının içeriğini JSON olarak sunuyor ve her yılın tarifesi orada bir
 * PDF bağlantısı ("Gelir Vergisi Tarifesi 2026"). Yeni yılın tarifesi
 * yayımlanınca listeye bir satır düşüyor; günlük cron bunu görüp PDF'i
 * okuyor (lib/tax-tariff-sync.ts).
 *
 * PDF'İN METNİ DAĞINIK: sayıların içine boşluk düşüyor ("1.0 00.000",
 * "% 4 0"), ücret gelirlerinin ayrı tarifesi parantez içinde ve satırlara
 * bölünmüş. Ayrıştırıcı önce sayıları birleştiriyor, ücret parantezlerini
 * atıyor (içindeki oran işaretini koruyarak), sonra ÜCRET DIŞI tarifeyi
 * okuyor — hisse kazancı ve temettü o tarifeye tabi.
 *
 * SAĞLAMA ŞART. PDF her dilim için birikmiş vergiyi de yazıyor ("400.000
 * TL'nin 190.000 TL'si için 28.500 TL"). Okunan dilimlerden bu tutarlar
 * yeniden hesaplanıyor; biri bile tutmazsa tarife REDDEDİLİYOR ve hiç
 * kullanılmıyor. Yanlış okunmuş bir tarife sessizce yanlış vergi
 * hesaplatacağına, eski yıl ekranda kalıyor ve cron raporu bunu söylüyor.
 */

const LIST_URL = "https://gib.gov.tr/api/gibportal/menuPageContent/findBySlug?slug=1375_gelir_vergisi_tarifeleri";
const USER_AGENT = "Mozilla/5.0 (compatible; AcilisZili/1.0)";

export type GibTariffLink = { year: number; title: string; url: string };

/** "190.000" → 190000 */
function amount(raw: string): number {
  return Number(raw.replace(/\./g, ""));
}

/** Sayıların içine düşen boşlukları birleştir: "1.0 00.000" → "1.000.000", "% 4 0" → "%40". */
export function normalizeTariffText(text: string): string {
  /* Önce ORANLAR ayrılıyor ("% 4 0" → "%40") ve ardına bir sınır işareti
     konuyor: yoksa sayı birleştirme oranı yanındaki eşiğe yapıştırıyordu
     ("%15 400.000" → "%15400.000", ilk denemede görüldü). */
  let s = text.replace(/\s+/g, " ").replace(/%\s*(\d)\s*(\d)?/g, (_, a: string, b: string | undefined) => ` %${a}${b ?? ""} \u2016 `);
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(/(\d)\s+(?=[\d.])/g, "$1").replace(/\.\s+(?=\d)/g, ".");
  }
  return s.replace(/\u2016/g, " ").replace(/\s+/g, " ");
}

export type TariffParse = { ok: true; brackets: TaxBracket[] } | { ok: false; reason: string };

/**
 * PDF metninden ücret dışı tarife + sağlama. Sonuç artan eşikli, son dilimi
 * sınırsız bir dizi; her ara dilimin "X TL'si için Y TL" tutarı okunan
 * dilimlerle yeniden hesaplanıp karşılaştırılıyor (1 TL tolerans).
 */
export function parseTariffText(text: string): TariffParse {
  const normalized = normalizeTariffText(text);
  /* Ücret parantezleri: içindeki oran işaretleri (satır kırılmasıyla içeri
     düşmüş olabiliyor) korunuyor, geri kalanı atılıyor. */
  const body = normalized.replace(/\(\s*ücret[^)]*\)/gi, (m) => ` ${(m.match(/%\d+/g) ?? []).join(" ")} `);

  const first = /([\d.]+)\s*TL'?\s*ye\s*kadar/i.exec(body);
  if (!first) return { ok: false, reason: "ilk dilim bulunamadı" };
  const middles = [...body.matchAll(/([\d.]+)\s*TL'?\s*nin\s*([\d.]+)\s*TL'?\s*si\s*için\s*([\d.]+)\s*TL/gi)];
  const last = /([\d.]+)\s*TL'?\s*d\s*en\s*fazlasının\s*([\d.]+)\s*TL'?\s*si\s*için\s*([\d.]+)\s*TL/i.exec(body);
  if (!last) return { ok: false, reason: "son dilim bulunamadı" };
  const rates = [...body.matchAll(/%(\d{2})/g)].map((m) => Number(m[1]));

  const uppers = [amount(first[1]), ...middles.map((m) => amount(m[1]))];
  const brackets: TaxBracket[] = uppers.map((upTo, i) => ({ upTo, ratePct: rates[i] }));
  brackets.push({ upTo: null, ratePct: rates[uppers.length] });

  if (rates.length !== brackets.length) return { ok: false, reason: `oran sayısı ${rates.length}, dilim sayısı ${brackets.length}` };
  if (brackets.length < 3 || brackets.length > 8) return { ok: false, reason: `beklenmedik dilim sayısı ${brackets.length}` };
  for (let i = 0; i < brackets.length; i += 1) {
    const rate = brackets[i].ratePct;
    if (!(rate > 0 && rate <= 60)) return { ok: false, reason: `oran dışı: %${rate}` };
    if (i > 0 && rate <= brackets[i - 1].ratePct) return { ok: false, reason: "oranlar artmıyor" };
    if (i > 0 && i < brackets.length - 1 && (brackets[i].upTo as number) <= (brackets[i - 1].upTo as number)) {
      return { ok: false, reason: "eşikler artmıyor" };
    }
  }

  /* Sağlama: her "X'in Y'si için Z" — Y bir önceki eşik, Z o eşiğe kadarki vergi. */
  const taxAt = (base: number) => {
    let tax = 0;
    let floor = 0;
    for (const b of brackets) {
      const ceiling = b.upTo ?? Infinity;
      if (base <= floor) break;
      tax += ((Math.min(base, ceiling) - floor) * b.ratePct) / 100;
      floor = ceiling;
    }
    return tax;
  };
  const checks = [
    ...middles.map((m, i) => ({ lower: amount(m[2]), stated: amount(m[3]), expectedLower: uppers[i] })),
    { lower: amount(last[2]), stated: amount(last[3]), expectedLower: uppers[uppers.length - 1] },
  ];
  if (amount(last[1]) !== uppers[uppers.length - 1]) return { ok: false, reason: "son dilimin eşiği tutmuyor" };
  for (const c of checks) {
    if (c.lower !== c.expectedLower) return { ok: false, reason: `eşik zinciri kopuk (${c.lower} ≠ ${c.expectedLower})` };
    if (Math.abs(taxAt(c.lower) - c.stated) > 1) {
      return { ok: false, reason: `sağlama tutmadı: ${c.lower} TL için ${c.stated} yazıyor, hesap ${taxAt(c.lower)}` };
    }
  }
  return { ok: true, brackets };
}

/** GİB portalındaki tarife listesi: yıl, başlık, PDF adresi. */
export async function listGibTariffs(): Promise<ProviderResult<GibTariffLink[]>> {
  try {
    const res = await withTimeout(
      fetch(LIST_URL, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, cache: "no-store" }),
      BACKGROUND_TIMEOUT_MS,
    );
    if (!res.ok) return fail("gib", "upstream-error", `GİB ${res.status}`);
    const json = (await res.json()) as {
      resultContainer?: { details?: { children?: { title?: string; url?: string }[] }[] };
    };
    const links: GibTariffLink[] = [];
    for (const section of json.resultContainer?.details ?? []) {
      for (const child of section.children ?? []) {
        const match = /Gelir Vergisi Tarifesi\s+(\d{4})/i.exec(child.title ?? "");
        if (match && child.url?.startsWith("https://cdn.gib.gov.tr/")) {
          links.push({ year: Number(match[1]), title: child.title as string, url: child.url });
        }
      }
    }
    if (links.length === 0) return fail("gib", "empty", "GİB listesinde tarife yok");
    return ok(links.sort((a, b) => b.year - a.year), "gib");
  } catch (error) {
    return fail("gib", "network", error instanceof Error ? error.message : "GİB isteği düştü");
  }
}

/** Bir yılın PDF'ini indirip okur ve sağlamasını yapar. */
export async function fetchGibTariff(link: GibTariffLink): Promise<ProviderResult<TaxBracket[]>> {
  try {
    const res = await withTimeout(
      fetch(link.url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" }),
      BACKGROUND_TIMEOUT_MS,
    );
    if (!res.ok) return fail("gib", "upstream-error", `GİB PDF ${res.status}`);
    const { pdfTextLines } = await import("./house-ptr");
    const lines = await pdfTextLines(new Uint8Array(await res.arrayBuffer()));
    const parsed = parseTariffText(lines.join(" "));
    if (!parsed.ok) return fail("gib", "empty", `${link.year} tarifesi okunamadı: ${parsed.reason}`);
    return ok(parsed.brackets, "gib");
  } catch (error) {
    return fail("gib", "network", error instanceof Error ? error.message : "GİB PDF isteği düştü");
  }
}
