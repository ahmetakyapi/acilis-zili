import { fail, ok, type ProviderResult, responseDate } from "./types";
import { withTimeout } from "./timeout";
import type { IsoMonth, MonthlyValue } from "@/lib/fx";

/**
 * TCMB EVDS — Türkiye'nin aylık fiyat endeksleri.
 *
 * NEDEN: iki soru bu endekslere dayanıyor.
 *   · Reel TL getirisi — TL getirisinden enflasyonu (TÜFE) ayırmak.
 *   · Vergi hesaplayıcısındaki maliyet endekslemesi — GVK mük. 81 son
 *     fıkrası Yİ-ÜFE'deki artışı istiyor.
 * FRED'deki Türkiye TÜFE serisi 2025 Nisan'da kesilmiş; güncel kaynak EVDS.
 *
 * ANAHTAR İSTİYOR (`EVDS_API_KEY`, `key` başlığında) ve bu yüzden
 * opsiyonel: anahtar yoksa Reel TL düğmesi hiç basılmıyor, vergi
 * hesaplayıcısı Yİ-ÜFE değerlerini okuyucudan istiyor. Uydurma bir endeks
 * yerine boş alan.
 *
 * SERİ KODLARI (Eylül 2026 itibarıyla doğrulandı):
 *   · TÜFE: `TP.TUKFIY2025.GENEL` (2025=100). TÜİK Ocak 2026 verisiyle
 *     bazı değiştirdi; eski `TP.FG.J0` (2003=100) EVDS'de "Arşiv" oldu ve
 *     2026-01'de durdu. Yeni seri 2005'e kadar geriye bağlanmış, oranlar
 *     eskisiyle aynı — oran hesabı için zincirleme gerekmiyor.
 *     Kaynak: evds3.tcmb.gov.tr/tumSeriler/2005/bie_tukfiy2025/TP.TUKFIY2025.GENEL
 *   · Yİ-ÜFE: `TP.TUFE1YI.T1` (2003=100) — yeniden bazlanmadı; vergi
 *     mevzuatının atıf yaptığı seri bu.
 *
 * İSTEK BİÇİMİ: adreste `?` YOK, parametreler eğik çizgiden hemen sonra
 * başlıyor (`…/igmevdsms-dis/series=…&startDate=…`); tarihler gg-aa-yyyy,
 * `frequency=5` aylık. Yanıtta alan adı kodun noktalarının alt çizgiye
 * dönmüş hâli ve değerler DİZE (boş ay null). Kaynak: `evds` Python
 * istemcisinin kaynak kodu (github.com/fatihmete/evds).
 */

const BASE = "https://evds3.tcmb.gov.tr/igmevdsms-dis/";

export const EVDS_SERIES = {
  cpi: "TP.TUKFIY2025.GENEL",
  ppi: "TP.TUFE1YI.T1",
} as const;

export type EvdsSeriesKind = keyof typeof EVDS_SERIES;

/** Yeni ay ayda bir kez geliyor (TÜİK, ayın 3'ü); yarım gün yeterince taze. */
const REVALIDATE_SECONDS = 12 * 3600;

/** EVDS aylık frekansı. */
const MONTHLY_FREQUENCY = 5;

function apiKey(): string | null {
  const key = process.env.EVDS_API_KEY?.trim();
  return key ? key : null;
}

export function isEvdsConfigured(): boolean {
  return apiKey() !== null;
}

/** "2026-08" → "01-08-2026" (başlangıç) ya da "28-08-2026" (bitiş). */
function evdsDate(month: IsoMonth, edge: "start" | "end"): string {
  const [y, m] = month.split("-");
  /* Bitişte 28: her ayda var ve aylık gözlem ayın ilk gününe damgalı, yani
     ayın kendisi aralığın içinde kalıyor. */
  return `${edge === "start" ? "01" : "28"}-${m}-${y}`;
}

export function evdsUrl(code: string, from: IsoMonth, to: IsoMonth): string {
  return (
    `${BASE}series=${code}` +
    `&startDate=${evdsDate(from, "start")}` +
    `&endDate=${evdsDate(to, "end")}` +
    `&type=json&frequency=${MONTHLY_FREQUENCY}`
  );
}

type RawEvds = { items?: Record<string, unknown>[] };

/**
 * Yanıttan aylık değerler — saf, ağsız sınanıyor.
 *
 * `Tarih` aylıkta "2026-8" gibi SIFIRSIZ gelebiliyor; iki biçim de okunuyor.
 * Boş ya da sayı olmayan değer atlanıyor, sıfır yazılmıyor: sıfır bir endeks
 * bölmede sonsuz, çarpmada sıfır üretirdi.
 */
export function parseEvdsMonthly(json: unknown, code: string): MonthlyValue[] {
  const field = code.replace(/\./g, "_");
  const items = (json as RawEvds | null)?.items;
  if (!Array.isArray(items)) return [];
  const out: MonthlyValue[] = [];
  for (const item of items) {
    const tarih = typeof item.Tarih === "string" ? item.Tarih : "";
    const match = /^(\d{4})-(\d{1,2})/.exec(tarih);
    if (!match) continue;
    const raw = item[field];
    const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
    if (!Number.isFinite(value) || value <= 0) continue;
    out.push({ month: `${match[1]}-${match[2].padStart(2, "0")}`, value });
  }
  return out.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}

export async function getEvdsMonthly(
  kind: EvdsSeriesKind,
  from: IsoMonth,
  to: IsoMonth,
): Promise<ProviderResult<MonthlyValue[]>> {
  const key = apiKey();
  if (!key) return fail("evds", "missing-key", "EVDS_API_KEY tanımlı değil");

  const code = EVDS_SERIES[kind];
  let res: Response;
  try {
    res = await withTimeout(
      fetch(evdsUrl(code, from, to), {
        headers: { accept: "application/json", key },
        next: { revalidate: REVALIDATE_SECONDS, tags: ["fx", `evds:${kind}`] },
      }),
    );
  } catch (error) {
    return fail(
      "evds",
      "network",
      error instanceof Error ? error.message : "EVDS'ye ulaşılamadı",
    );
  }
  if (res.status === 401 || res.status === 403) {
    return fail("evds", "missing-key", `EVDS ${res.status}: anahtar geçersiz`);
  }
  if (!res.ok) return fail("evds", "upstream-error", `EVDS ${res.status}`);

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return fail("evds", "upstream-error", "EVDS yanıtı okunamadı");
  }
  const values = parseEvdsMonthly(json, code);
  if (values.length === 0) return fail("evds", "empty", `${code} için gözlem yok`);
  return ok(values, "evds", { fetchedAt: responseDate(res) });
}
