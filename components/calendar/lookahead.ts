import { scaleRatios } from "@/lib/compare";
import type { MarketHoliday } from "@/lib/market-hours";
import type { EconomicEventRow } from "@/lib/schema";

/**
 * Altı haftalık görünümün ve şeridin ortak hesabı — düz modül.
 *
 * NEDEN AYRI DOSYA: sayfa (sunucu) ve testler aynı hesabı okuyor; bileşen
 * dosyasına koymak testin JSX derlemesini gerektirirdi. "use client" YOK:
 * istemci modülünden dışa aktarılan değer sunucuya referans olarak gelir
 * (CLAUDE.md, istemci/sunucu sınırı).
 */

export const IMPACT_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** Önem sırasıyla (yüksek önce), aynı önemde saat sırasıyla. Girdi bozulmaz. */
export function byImportance(events: EconomicEventRow[]): EconomicEventRow[] {
  return [...events].sort(
    (a, b) =>
      (IMPACT_RANK[a.importance] ?? 3) - (IMPACT_RANK[b.importance] ?? 3) ||
      (a.eventTimeEt ?? "99:99").localeCompare(b.eventTimeEt ?? "99:99"),
  );
}

function utcNoon(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

function addDays(date: string, days: number) {
  const next = utcNoon(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** Pazar 0 … Cumartesi 6. */
export function weekdayOf(date: string) {
  return utcNoon(date).getUTCDay();
}

/** Tarihin içinde bulunduğu haftanın Pazartesisi. */
export function mondayOf(date: string) {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export type LookaheadDay = {
  date: string;
  /** Okuyucunun bugününden önce: sorgu orayı kapsamıyor, bir şey İDDİA edilmez. */
  past: boolean;
  /** Sorgu penceresinin ötesinde: aynı gerekçe, boşluk iddiası yok. */
  outside: boolean;
  today: boolean;
  holiday: MarketHoliday | null;
  events: EconomicEventRow[];
};

export type LookaheadWeek = {
  monday: string;
  friday: string;
  days: LookaheadDay[];
  total: number;
  high: EconomicEventRow[];
  current: boolean;
};

/**
 * Pazartesi başlayan haftalar, yalnız iş günleri (hafta sonu açıklama
 * taşımıyor — şerit ve gündemle aynı karar). `from` okuyucunun bugünü,
 * `until` sorgu penceresinin son günü (dahil). En çok `weeks` hafta.
 */
export function buildLookahead({
  events,
  holidays,
  from,
  until,
  weeks = 6,
}: {
  events: EconomicEventRow[];
  holidays: Map<string, MarketHoliday>;
  from: string;
  until: string;
  weeks?: number;
}): LookaheadWeek[] {
  const byDay = new Map<string, EconomicEventRow[]>();
  for (const event of events) {
    const list = byDay.get(event.eventDate) ?? [];
    list.push(event);
    byDay.set(event.eventDate, list);
  }

  /* Hafta sonu bakan okuyucu için "bu hafta" bitmiş bir hafta: Cumartesi
     ve Pazar günü pencere gelecek Pazartesiden başlıyor, yoksa ilk satır
     beş soluk (geçmiş) günden ibaret olurdu. */
  const weekend = weekdayOf(from) === 0 || weekdayOf(from) === 6;
  let monday = weekend ? mondayOf(addDays(from, 2)) : mondayOf(from);
  const result: LookaheadWeek[] = [];
  while (result.length < weeks && monday <= until) {
    const days: LookaheadDay[] = Array.from({ length: 5 }, (_, index) => {
      const date = addDays(monday, index);
      const past = date < from;
      const outside = date > until;
      return {
        date,
        past,
        outside,
        today: date === from,
        holiday: holidays.get(date) ?? null,
        events: past || outside ? [] : byImportance(byDay.get(date) ?? []),
      };
    });
    const listed = days.flatMap((day) => day.events);
    result.push({
      monday,
      friday: addDays(monday, 4),
      days,
      total: listed.length,
      high: listed
        .filter((event) => event.importance === "high")
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || (a.eventTimeEt ?? "").localeCompare(b.eventTimeEt ?? "")),
      current: from >= monday && from <= addDays(monday, 6),
    });
    monday = addDays(monday, 7);
  }
  return result;
}

/**
 * Bir satırın sayı değerleri karşılaştırılabilir mi?
 *
 * Değerler sağlayıcıdan METİN geliyor. Yalnızca dizge baştan sona düz sayıysa
 * ("4.2", "-0.3") okunuyor; "250K" ya da "3.1%" gibi ekli metinde bir uzunluk
 * çizmek, birimi bilmeden ölçek uydurmak olurdu. Oranın kendisi
 * karşılaştırma ekranının hesabı (`scaleRatios`, lib/compare.ts): ikiden az
 * sayıda çubuk yok, tavan en büyük mutlak değer, eksi varsa sıfır ortada —
 * iki ekranda iki ayrı ölçek kuralı olmasın.
 */
const PLAIN = /^-?\d+(\.\d+)?$/;
export function valueRatios(
  values: (string | null)[],
): { ratios: (number | null)[]; signed: boolean } | null {
  const numbers = values.map((value) => {
    const trimmed = value?.trim();
    return trimmed && PLAIN.test(trimmed) ? Number(trimmed) : null;
  });
  const scale = scaleRatios(numbers);
  return scale.ratios.some((ratio) => ratio !== null) ? scale : null;
}
