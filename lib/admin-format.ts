import type { StatTone } from "@/components/admin/AdminUI";

/**
 * İki dönemin karşılaştırması.
 *
 * ÖNCEKİ DÖNEM SIFIRSA DEĞİŞİM YAZILMAZ. "0'dan 40'a" bir yüzdeyle
 * anlatılamaz — sonsuz artıştır ve ekranda "%∞" ya da "%4000" yazmak
 * uydurma kesinliğin ta kendisi. Ölçüm yeni kurulduğunda ilk hafta boyunca
 * tam olarak bu durum geçerli: satır hiç çizilmiyor, yerine ham sayı
 * duruyor.
 */
export function deltaOf(
  current: number,
  previous: number,
): { text: string; tone: StatTone } | null {
  if (previous <= 0) return null;
  const change = ((current - previous) / previous) * 100;
  /* Yüzde bir puanın altındaki fark gürültüdür; okla göstermek yanlış bir
     hareket hissi verir. */
  if (Math.abs(change) < 1) return { text: "değişim yok", tone: "neutral" };
  const rounded = Math.round(change);
  return {
    text: `${rounded > 0 ? "+" : ""}%${Math.abs(rounded)}`,
    tone: rounded > 0 ? "up" : "down",
  };
}

/** "4 saat önce" / "3 gün önce" — panelin tazelik künyeleri. */
export function agoLabel(date: Date | null): string {
  if (!date) return "hiç";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} dakika önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} saat önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}
