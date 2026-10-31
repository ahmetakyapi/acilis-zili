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

/** Türkçe hafta günlerinin -ın/-in eki (iyelik): "Cuma'nın", "Pazartesi'nin". */
const TR_GENITIVE: Record<string, string> = {
  Pazartesi: "Pazartesi'nin",
  Salı: "Salı'nın",
  Çarşamba: "Çarşamba'nın",
  Perşembe: "Perşembe'nin",
  Cuma: "Cuma'nın",
  Cumartesi: "Cumartesi'nin",
  Pazar: "Pazar'ın",
};

/**
 * Geçmiş seansı anlatan panelin BAŞLIĞI (31 Ekim): "Günün Grafiği" yalnız
 * bugünün seansıysa. Cumartesi açılan ana sayfa cumanın grafiğini "Günün
 * Grafiği" başlığıyla gösteriyordu; künye ("Dünkü Seans") altta küçük kalıyor,
 * başlık okuru bugün sandırıyordu (sahibinin isteği: "kullanıcıyı yanlış
 * yönlendirmemek çok kritik"). Göreli gün `sessionAgeLabel` ile aynı ölçüden.
 */
export function sessionTitle(
  dateEt: string,
  locale: Locale,
  titles: { today: string; yesterday: string; weekday: string; earlier: string },
  nowMs: number,
): string {
  const offset = readerDayOffset(dateEt, null, locale, new Date(nowMs));
  if (offset >= 0) return titles.today;
  if (offset === -1) return titles.yesterday;
  if (offset >= -6) {
    const day = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { weekday: "long", timeZone: "UTC" }).format(
      new Date(`${dateEt}T12:00:00Z`),
    );
    return titles.weekday.replace("{day}", locale === "tr" ? (TR_GENITIVE[day] ?? day) : day);
  }
  return titles.earlier;
}
