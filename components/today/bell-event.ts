/**
 * Sayaç ile kahraman zili arasındaki köprü (14 Ekim).
 *
 * Sayaç sıfıra varınca ("zil anı") rakamların yanında ayrı bir zil
 * (BellLoader) çalıyor ve mürekkep kahraman zili o sırada
 * `visibility:hidden` ile tek karede gizleniyordu: markanın imza anında
 * iki zil birbirinin yerine ışınlanıyor, üstelik çalan zil sonsuz döngülü
 * bir BEKLEME göstergesiydi (karar kaydı lib/ink/scenes.ts → ringing:
 * "bekleme anı bir ikon gibi duruyordu"). Şimdi sayaç yalnızca bu olayı
 * yayınlıyor ve kahraman zilinin KENDİSİ çalıyor (HeroBell → heroTap
 * sahnesi): tek zil, tek dil. Modül ayrı, çünkü Countdown gömülü sayfada
 * da kullanılıyor ve HeroBell'i o demete çekmemeli.
 */
export const BELL_RANG_EVENT = "az:bell-rang";

/** Zilin sınırdan ne kadar sonrasına kadar "şimdi geçtik" sayıldığı. */
export const BELL_LATE_MS = 2_000;

/**
 * ZİL BİR GEÇİŞTİR, DURUM DEĞİL (8 Kasım, durum makinesi denetimi § 7).
 * Eski tetik "kalan 0 ve ilk kare değil"di: tik gizli sekmede durduğu için
 * cuma açık bırakılıp pazartesi öne alınan sekme ilk tikte 0 görüyor ve o
 * an "açılış zili" çalıyordu; BFCache dönüşü ve hedefi çoktan geçmiş
 * önbellekli HTML de aynı. Şimdi zil yalnız sınır İKİ TİK ARASINDA
 * geçildiyse çalar: önceki tikte kalan > 0 (`prevMs < targetMs`), şimdiki
 * tikte 0 (`nowMs >= targetMs`) ve sınır en çok `BELL_LATE_MS` önce. Uzun
 * uykudan dönen sekme sınırı geçmiş olur ama geç kalmıştır; susar.
 * Saf ve saati parametre alır — testi tests/countdown-bell.test.ts.
 */
export function bellTransition(prevMs: number, nowMs: number, targetMs: number): boolean {
  if (!Number.isFinite(prevMs) || !Number.isFinite(nowMs) || !Number.isFinite(targetMs)) return false;
  return prevMs < targetMs && nowMs >= targetMs && nowMs - targetMs < BELL_LATE_MS;
}
