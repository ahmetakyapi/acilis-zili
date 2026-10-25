import type { MarketStatus } from "@/lib/market-hours";

/**
 * Son seans şeridinin kararları — saf, `tests/day-tile.test.ts` (25 Ekim).
 * Bileşen `home/SkylineStrip.tsx` ("Son Seansın Silueti"; kahramandaki
 * karo DaySeal aynı gün kalktı, kural şeride taşındı); burada yalnız "zil
 * bu şeritten şiddet alır mı". Ad tarihsel: dosya ve fonksiyon adı karo
 * döneminden.
 *
 * Şerit HER SEANSTA basılıyor ve her zaman en yeni TAMAMLANMIŞ seansı
 * anlatıyor (`getLatestPosterDate`): ön seansta ve asıl seansta dünkü
 * (pazartesi sabahı cumanın) seans, kapanıştan sonra o günün. Künye
 * tarihi yazıyor ("23 Eki Kapanışı"), yani hangi seansı anlattığı her
 * durumda okunuyor (CLAUDE.md "Veri dürüstlüğü" 4).
 *
 * ZİLİN ŞİDDETİ ise yalnız seans BİTMİŞKEN ve karo O seansı anlatıyorsa:
 * asıl seansta zil zaten çalıyor (`heroRing`), dünün genişliğiyle
 * çalması bugünü dünle karıştırırdı; kapanıştan hemen sonra poster daha
 * hazır değilken karo önceki seansı gösteriyor ve o seansın şiddeti de
 * bugünün zili değil.
 */
export function tileFeedsBell(
  status: Pick<MarketStatus, "session" | "sessionDate">,
  posterDate: string,
): boolean {
  if (status.session === "regular" || status.session === "pre-market") return false;
  return posterDate === status.sessionDate;
}
