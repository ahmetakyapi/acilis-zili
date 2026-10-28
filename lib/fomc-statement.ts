/**
 * FOMC açıklamasını Fed'in kendi metninden okuyan SAF yardımcılar (28 Ekim);
 * ağ tarafı `lib/providers/fed.ts`, testi `tests/fomc-statement.test.ts`.
 *
 * NEDEN METİN. Akışta "Fed Faiz Kararı" 21:00 TR'de açıklandığı hâlde
 * gece 01:04'te hâlâ "Sonuç Bekleniyor" diyordu (sahibinin ekranı, 28
 * Ekim). Olay sonucu FRED'in `DFEDTARU` serisinden bekliyordu; o seri gün
 * içi yoklamada desteklenmiyordu (`getReleasedObservation` yalnız
 * `MACRO_SERIES`) ve desteklense de işe yaramazdı: hedef aralığın yeni değeri
 * kararın ERTESİ günü yürürlüğe giriyor ve FRED onu bir gün sonra yazıyor.
 * Kararın tek aynı-dakika kaynağı Fed'in basın bülteni; cümle kalıbı
 * yıllardır sabit ("The Committee decided to maintain the target range for
 * the federal funds rate at 3-3/4 to 4 percent").
 *
 * KALIP TUTMAZSA SAYI YOK: bülten yayımlandıysa olay "Açıklandı" olur ama
 * aralık okunamadıysa gerçekleşen sütununa hiçbir şey yazılmaz (CLAUDE.md,
 * veri dürüstlüğü 1 — uydurma kesinlik yok).
 */

import { formatPrice } from "./utils";

export type FomcDecision = {
  action: "maintain" | "raise" | "lower";
  lower: number;
  upper: number;
  /** Kararın değiştirdiği puan (0,25); "maintain"de 0. */
  step: number;
};

/** "3-3/4" → 3.75, "4" → 4, "1/4" → 0.25, "0" → 0. Tanınmayan biçim null. */
export function parseFedNumber(raw: string): number | null {
  const match = /^(?:(\d+)(?:-(\d+)\/(\d+))?|(\d+)\/(\d+))$/.exec(raw.trim());
  if (!match) return null;
  const [, whole, num, den, onlyNum, onlyDen] = match;
  if (onlyNum && onlyDen) return Number(onlyNum) / Number(onlyDen);
  const base = Number(whole);
  return num && den ? base + Number(num) / Number(den) : base;
}

/** Bültenin düz metninden kararın kendisi; kalıp yoksa null. */
export function parseFomcDecision(text: string): FomcDecision | null {
  const flat = text.replace(/\s+/g, " ");
  const match =
    /Committee decided to (maintain|raise|lower) the target range for the federal funds rate (?:by ([\d/-]+) percentage points? )?(?:at|to) ([\d/-]+) to ([\d/-]+) percent/i.exec(
      flat,
    );
  if (!match) return null;
  const action = match[1]!.toLowerCase() as FomcDecision["action"];
  const lower = parseFedNumber(match[3]!);
  const upper = parseFedNumber(match[4]!);
  const step = action === "maintain" ? 0 : match[2] ? parseFedNumber(match[2]) : null;
  if (lower === null || upper === null || step === null || upper < lower) return null;
  return { action, lower, upper, step };
}

/** Kararın ÖNCEKİ aralığı — bültenin kendi cümlesinden ("by 1/4 percentage point"). */
export function previousRange(decision: FomcDecision): { lower: number; upper: number } {
  const shift = decision.action === "raise" ? -decision.step : decision.action === "lower" ? decision.step : 0;
  return { lower: decision.lower + shift, upper: decision.upper + shift };
}

/** Bülten adresindeki gün: ".../monetary20261028a.htm" → "2026-10-28". */
export function statementDate(link: string): string | null {
  const match = /monetary(\d{4})(\d{2})(\d{2})[a-z]\.htm/i.exec(link);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export type FedFeedItem = { title: string; link: string; publishedAt: string | null };

/** Fed RSS'inin öğeleri — CDATA'lı ya da düz alanlar. */
export function parseFedFeed(xml: string): FedFeedItem[] {
  const field = (block: string, name: string) => {
    const match = new RegExp(`<${name}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${name}>`, "i").exec(block);
    return match ? match[1]!.trim() : "";
  };
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, block]) => {
    const published = Date.parse(field(block!, "pubDate"));
    return {
      title: field(block!, "title"),
      link: field(block!, "link"),
      publishedAt: Number.isFinite(published) ? new Date(published).toISOString() : null,
    };
  });
}

/** Aynı günün iki bülteni: karar ("issues FOMC statement") ve projeksiyonlar. */
export function findFomcReleases(items: FedFeedItem[], dateEt: string) {
  const sameDay = items.filter((item) => statementDate(item.link) === dateEt);
  return {
    statement: sameDay.find((item) => /issues FOMC statement/i.test(item.title)) ?? null,
    projections: sameDay.find((item) => /economic projections/i.test(item.title)) ?? null,
  };
}

/** Fed bülteninden sonuçlanan olay türleri (`eventFamily`: "fomc-rate"…). */
export function isFomcFamily(family: string): family is "fomc-rate" | "fomc-sep" | "fomc-presser" {
  return family === "fomc-rate" || family === "fomc-sep" || family === "fomc-presser";
}

/** Hedef aralık: "%3,75–4,00" / "3.75–4.00%". */
export function fedRange({ lower, upper }: { lower: number; upper: number }, locale: string): string {
  const body = `${formatPrice(lower, locale, { digits: 2 })}–${formatPrice(upper, locale, { digits: 2 })}`;
  return locale === "tr" ? `%${body}` : `${body}%`;
}
