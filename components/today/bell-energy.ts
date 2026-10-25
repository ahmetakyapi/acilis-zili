/**
 * Zilin şiddeti — ana sayfanın siluet şeridi (`home/SkylineStrip.tsx`;
 * 25 Ekim'e kadar kapanış künyesi DaySeal) ile kahraman zili (HeroBell)
 * arasındaki köprü (24 Ekim).
 *
 * Şiddet günün posterinden geliyor (`bellEnergy`, lib/day-poster.ts) ve
 * poster kendi Suspense sınırında akıyor: ilk ziyarette sağlayıcıdan üç tur
 * bekliyor, kahraman onu beklememeli. Zil ise sınırın DIŞINDA, ilk karede
 * çiziliyor. Şiddeti prop olarak vermek zili sınırın içine almak, yani
 * sahnesini veri gelince baştan oynatmak demekti. Bunun yerine şerit
 * geldiğinde değeri buraya yazıyor (`BellEnergySource`), zil bir sonraki
 * vuruşta, BASIŞ ANINDA okuyor (abonelik yok, gerekçe HeroBell). Modül
 * ayrı: `bell-event.ts` ile aynı gerekçe, Countdown ve gömülü sayfa bu
 * köprüyü demetlerine çekmesin.
 */
let energy = 0;

export function readBellEnergy(): number {
  return energy;
}

export function setBellEnergy(value: number) {
  energy = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}
