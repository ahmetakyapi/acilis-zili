import type { Dictionary, Locale } from "@/lib/i18n";
import { readerDayOffset } from "@/lib/session-clock";

/**
 * Geçmiş bir seansın göreli adı: "Dünkü Seans", "Cuma Seansı" (28 Ekim;
 * künye `components/today/home/SessionAgeTag.tsx`).
 *
 * GÜN OKUYUCUNUN TAKVİMİNDEN (`readerDayOffset`, saatsiz: ET seans günü):
 * kışın 16:00 ET kapanışı TR'de 00:00, yani saatli hesap dünkü seansı
 * "bugün" sayardı. Bir haftadan eskisi hafta günüyle değil "Önceki Seans"
 * — geçen cumayı bu cuma sandırmasın.
 */
export function sessionAgeLabel(dateEt: string, locale: Locale, t: Dictionary, nowMs: number): string {
  const T = t.sessionAge;
  const offset = readerDayOffset(dateEt, null, locale, new Date(nowMs));
  if (offset >= 0) return T.today;
  if (offset === -1) return T.yesterday;
  if (offset >= -6) {
    const day = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { weekday: "long", timeZone: "UTC" }).format(
      new Date(`${dateEt}T12:00:00Z`),
    );
    return T.weekday.replace("{day}", day);
  }
  return T.earlier;
}
