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
