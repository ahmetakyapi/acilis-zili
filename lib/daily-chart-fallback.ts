/* ==========================================================================
   Günün Grafiği — sitenin kendi YEDEK grafiği (8 Kasım)

   NEDEN VAR. Grafiği claude.ai rutini yazıyor (docs/claude-rutinler.md § 7).
   7 Kasım cumartesi koşusu "kullanım limiti" ile üç saniyede düştü, Görev
   Kontrolü o gün yalnız tek bir yeniden çalıştırmaya izin verdi (Bilanço
   önce) ve rutinin pazar/pazartesi koşusu yok: 6 Kasım cumasının grafiği
   hiç yazılmadı, ana sayfa hafta sonu boyunca "Perşembe'nin Grafiği"ni
   gösterdi. Sahibinin sözü: "hafta sonu da cuma kapanışı gözükmeli … bu
   şekilde kabul edilemez." Rutin ne kadar sağlam olsa da bir dış hizmet;
   sayfanın dayanağı olamaz.

   MODEL YOK. Bu dosya bir şablon: bağlam paketinin (`lib/daily-chart-
   context.ts`) sayılarını sabit cümlelere yerleştirir. Site İçi Claude'a
   dördüncü bir SDK yolu açılmadı (CLAUDE.md "Site İçi Claude"). Yorum,
   "neden" ve haber bağlamı YOK — yalnız dağılım; metin bunu okura açıkça
   söylüyor (son iki cümle). Rutin aynı günü yazınca bu kaydın ÜSTÜNE yazar
   (`generatedBy: "auto"`, `lib/content-write.ts` → `saveDailyChart`).

   SAYILAR PAKETTEKİ YAZILIŞIYLA. Her yüzde `pct.tr` / `pct.en` dizesinden,
   işareti kelimeye ya da işarete çevrilerek; adetler sayımdan (`tally`,
   `breadth`). Kendi hesabı yok: rutinin uyduğu sayı kuralının aynısı ve uç
   bunu yazmadan önce `ungroundedNumbers` ile yine denetliyor.

   SEKTÖR PANOSU, YALNIZ TAMSA. On bir sektör fonundan biri bile eksikse
   yedek yazılmaz (null): "11 fonun 9'u" diyen metin dokuz fonu
   anlatamaz, eksik pano da günün sırasını yanlış söyler. Paket zaten
   "tam" (dört endeks + evrenin %80'i) değilse uç bu dosyaya hiç gelmiyor.

   Saf: veritabanı ve sağlayıcı yok; testi `tests/daily-chart-fallback.test.ts`.
   ========================================================================== */

type Pct = { value: number; tr: string; en: string };
type MoveField = { pct: Pct } | null;

export type FallbackRow = { symbol: string; name_tr: string; name_en: string; d1: MoveField };
export type FallbackMover = { symbol: string; name: string; pct?: Pct } & Record<string, unknown>;

/** Bağlam paketinin bu dosyanın okuduğu kısmı — yapısal, paketin kendisi de uyar. */
export type FallbackContext = {
  indices: readonly FallbackRow[];
  sectors: readonly FallbackRow[];
  sectors_tally: { total: number; known: number; up: number; down: number };
  breadth: { advancing: number; declining: number } | null;
  movers: { gainers: readonly FallbackMover[]; losers: readonly FallbackMover[] } | null;
};

type FallbackDraft = {
  locale: "tr" | "en";
  title: string;
  chart_md: string;
  body_md: string;
};

const MINUS = "−";

/** "+1,23" → "1,23" — işaret metinde kelimeye ya da işarete dönüşüyor. */
function digits(pct: Pct, locale: "tr" | "en"): string {
  return pct[locale].replace(/^[+-]/, "");
}

/** Metin içi işaretli yüzde: TR "+%1,23" / "−%0,85", EN "+1.23%" / "−0.85%". */
function signed(pct: Pct, locale: "tr" | "en"): string {
  const sign = pct.value > 0 ? "+" : pct.value < 0 ? MINUS : "";
  return locale === "tr" ? `${sign}%${digits(pct, "tr")}` : `${sign}${digits(pct, "en")}%`;
}

type Known = FallbackRow & { d1: { pct: Pct } };

function known(rows: readonly FallbackRow[]): Known[] {
  return rows.filter((row): row is Known => row.d1 !== null);
}

/** Büyükten küçüğe; eşitlikte sembol (kararlı — iki kurulum aynı metni üretsin). */
function sorted(rows: readonly Known[]): Known[] {
  return [...rows].sort((a, b) => b.d1.pct.value - a.d1.pct.value || a.symbol.localeCompare(b.symbol));
}

const COPY = {
  tr: {
    label: "Sektör Fonları, Günlük Değişim %",
    titleMixed: (top: string, bottom: string) => `Sektörlerde Gün: ${top} Önde, ${bottom} Geride`,
    titleUp: (top: string) => `Sektörlerde Yükseliş Günü: En Güçlüsü ${top}`,
    titleDown: (bottom: string) => `Sektörlerde Düşüş Günü: En Sert Düşen ${bottom}`,
    lead: (name: string, pct: Pct) =>
      pct.value === 0
        ? `${name} günü yatay kapattı.`
        : `${name} günü %${digits(pct, "tr")} ${pct.value > 0 ? "yükselişle" : "düşüşle"} kapattı.`,
    others: (list: string) => `Öteki endeksler: ${list}.`,
    tally: (total: number, up: number, down: number, flat: number) =>
      `${total} sektör fonundan ${up} tanesi yükselişte, ${down} tanesi düşüşte${flat > 0 ? `, ${flat} tanesi yatay` : ""} kapandı.`,
    extremes: (top: string, topPct: string, bottom: string, bottomPct: string) =>
      `En güçlü sektör ${top} (${topPct}), en zayıfı ${bottom} (${bottomPct}) oldu.`,
    breadth: (adv: number, dec: number) =>
      `S&P 500, Nasdaq 100 ve Dow Jones üyeleri arasında ${adv} hisse yükselirken ${dec} hisse geriledi.`,
    movers: (g: string, l: string) => `Bu hisselerden en çok yükselen ${g}, en çok düşen ${l} oldu.`,
    note:
      "Bu grafik, editör yorumu yayımlanana dek kapanış verisinden otomatik derlendi; sayıların nedenini değil, dağılımını özetliyor. Yorum gelince bu sayfa güncellenir.",
  },
  en: {
    label: "Sector Funds, Daily Change %",
    titleMixed: (top: string, bottom: string) => `Sectors: ${top} Led, ${bottom} Lagged`,
    titleUp: (top: string) => `Broad Gains Across Sectors, Led by ${top}`,
    titleDown: (bottom: string) => `Broad Losses Across Sectors; ${bottom} Fell Most`,
    lead: (name: string, pct: Pct) =>
      pct.value === 0
        ? `The ${name} ended the day flat.`
        : `The ${name} ${pct.value > 0 ? "rose" : "fell"} ${digits(pct, "en")}% on the day.`,
    others: (list: string) => `Elsewhere: ${list}.`,
    tally: (total: number, up: number, down: number, flat: number) =>
      `Of the ${total} sector funds, ${up} closed higher and ${down} closed lower${flat > 0 ? `, with ${flat} unchanged` : ""}.`,
    extremes: (top: string, topPct: string, bottom: string, bottomPct: string) =>
      `${top} was the strongest sector (${topPct}) and ${bottom} the weakest (${bottomPct}).`,
    breadth: (adv: number, dec: number) =>
      `Across the members of the S&P 500, Nasdaq 100 and Dow Jones, ${adv} stocks advanced while ${dec} declined.`,
    movers: (g: string, l: string) => `Among them, the biggest gainer was ${g} and the biggest decliner was ${l}.`,
    note:
      "This chart was compiled automatically from closing data until the editor's note is published; it shows how the numbers were distributed, not why they moved. The page will be updated when the commentary arrives.",
  },
} as const;

/** Endeks satırlarında okurun sırası: S&P 500 önce, sonra paketteki sıra. */
const LEAD_INDEX = "SPY";

function mover(row: FallbackMover | undefined, locale: "tr" | "en"): string | null {
  if (!row?.pct) return null;
  return `${row.name} (${row.symbol}, ${signed(row.pct, locale)})`;
}

/**
 * Bir dilin taslağı. Sektör panosu eksikse ya da endeks barı yoksa null.
 * Doğrulama (`dailyChartInputSchema`: tek blok, 50–160 kelime) ve sayı
 * denetimi yazan uçta — burada yalnız şablon.
 */
export function fallbackDraft(context: FallbackContext, locale: "tr" | "en"): FallbackDraft | null {
  const T = COPY[locale];
  const name = (row: FallbackRow) => (locale === "tr" ? row.name_tr : row.name_en);

  const sectors = sorted(known(context.sectors));
  if (sectors.length === 0 || sectors.length !== context.sectors.length) return null;
  const indices = known(context.indices);
  const lead = indices.find((row) => row.symbol === LEAD_INDEX) ?? indices[0];
  if (!lead) return null;

  const top = sectors[0];
  const bottom = sectors[sectors.length - 1];
  const { total, up, down } = context.sectors_tally;
  const flat = Math.max(0, context.sectors_tally.known - up - down);

  const title = down === 0 ? T.titleUp(name(top)) : up === 0 ? T.titleDown(name(bottom)) : T.titleMixed(name(top), name(bottom));

  const chart_md = [`::: bar ${T.label}`, ...sectors.map((row) => `${name(row)} | ${row.d1.pct[locale]}`), ":::"].join("\n");

  const others = indices.filter((row) => row !== lead).map((row) => `${name(row)} ${signed(row.d1.pct, locale)}`);
  const gainer = mover(context.movers?.gainers[0], locale);
  const loser = mover(context.movers?.losers[0], locale);

  const sentences = [
    T.lead(name(lead), lead.d1.pct),
    others.length > 0 ? T.others(others.join(", ")) : null,
    T.tally(total, up, down, flat),
    top !== bottom ? T.extremes(name(top), signed(top.d1.pct, locale), name(bottom), signed(bottom.d1.pct, locale)) : null,
    context.breadth ? T.breadth(context.breadth.advancing, context.breadth.declining) : null,
    gainer && loser ? T.movers(gainer, loser) : null,
    T.note,
  ];

  return { locale, title, chart_md, body_md: sentences.filter(Boolean).join(" ") };
}

/** İki dilin taslağı — biri bile yazılamıyorsa hiçbiri (iki dil aynı grafiği taşımalı). */
export function fallbackDrafts(context: FallbackContext): FallbackDraft[] | null {
  const tr = fallbackDraft(context, "tr");
  const en = fallbackDraft(context, "en");
  return tr && en ? [tr, en] : null;
}
