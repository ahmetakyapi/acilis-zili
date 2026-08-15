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
): { text: string; tone: StatTone; srLabel: string } | null {
  if (previous <= 0) return null;
  const change = ((current - previous) / previous) * 100;
  /* Yüzde bir puanın altındaki fark gürültüdür; okla göstermek yanlış bir
     hareket hissi verir. */
  if (Math.abs(change) < 1) {
    return { text: "değişim yok", tone: "neutral", srLabel: "değişim yok" };
  }
  const rounded = Math.round(change);
  /* İŞARET METİNDE. `Math.abs` eksiyi siliyordu ve düşüş de artış da
     "%12" diye yazılıyordu — yönü YALNIZCA renk taşıyordu. Panelin kendi
     kuralı bunun tersini söylüyor ("Renk tek başına bilgi taşımıyor");
     renk körü okuyucu, tek renk çıktı ve ekran okuyucu için iki durum
     ayırt edilemiyordu. Türkçe yazımda yüzde işareti önde olduğu için
     işaret onun da önüne geçiyor: "−%12". */
  return {
    text: `${rounded > 0 ? "+" : "−"}%${Math.abs(rounded)}`,
    tone: rounded > 0 ? "up" : "down",
    srLabel: `${Math.abs(rounded)} yüzde ${rounded > 0 ? "arttı" : "azaldı"}`,
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
