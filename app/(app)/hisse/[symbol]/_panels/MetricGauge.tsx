import { cn } from "@/lib/utils";
import styles from "./visuals.module.css";

/**
 * Temel Göstergeler'in KIYAS ŞERİDİ (26 Kasım 2026, görsel tur — sahibinin
 * sözü: "buraları da iyileştirelim").
 *
 * Sektör kulvarı (`PeerStrip`) yalnız üç ölçüde var; öteki altı hücre
 * (İleri F/K, PD/DD, Hisse Başına Kâr, Temettü, Beta, Hacim) tek bir sayıydı
 * ve altında ~53 piksel boş kalıyordu (NVDA ve MU, 1440, ölçüldü: kulvarlı
 * hücrede sayının altı 23, kulvarsızda 67 piksel boş). Satırlar "yarım"
 * görünüyordu. Bu bileşen o hücrelere KENDİ eldeki kıyasını veriyor:
 *
 * - İleri F/K → aynı karttaki F/K (çentik), çubuk F/K'dan ileri F/K'ya;
 * - Beta → piyasanın kendisi, 1 (çentik);
 * - Hacim → son 20 tamamlanmış seansın ortalaması (çentik; barlar
 *   Hareketli Ortalamalar'ın zaten çektiği bir yıllık seriden).
 *
 * DİL PeerStrip'in AYNISI (kulvar 5, çubuk 8, koyu çentik; ortak
 * `value-lane` / `value-bar` / `value-notch`): çentik kıyas, çubuk kıyastan
 * değere uzanan fark. Okur kartın her hücresinde tek bir kuralı okur. Ölçek
 * sıfırdan başlar ve ikisinin büyüğünün 1,25 katında biter (beta'da en az
 * 2) — çubuk kenara yapışmaz, çentik ortaya yakın durur.
 *
 * YARGI YOK, renk yok: ileri F/K'nın düşük olması "ucuz", yüksek betanın
 * "riskli" diye boyanmıyor; çubuk büyüklük tonunda (`--bar-soft`).
 *
 * `bar` verilmezse yalnız künye basılır (PD/DD'nin defter değeri, hisse
 * başına kârın kâr getirisi, temettünün stopaj sonrası verimi): kulvarın
 * yeri boş bir yuva olarak kalır ki künyeler satır boyunca AYNI HATTA dursun.
 */
export function MetricGauge({
  bar,
  caption,
  aria,
}: {
  /** Sıfırdan başlayan ölçekte değer ve kıyas; ölçeğin tavanı `max`. */
  bar?: { value: number; reference: number; max: number };
  caption: string;
  aria: string;
}) {
  if (!bar) {
    return (
      <span className={styles.peer} title={aria}>
        <span className={cn(styles.peerRail, styles.gaugeSlot)} aria-hidden />
        <span className={styles.peerCaption}>
          <span>{caption}</span>
        </span>
      </span>
    );
  }
  const clamp = (v: number) => Math.max(0, Math.min(100, (v / bar.max) * 100));
  const at = clamp(bar.value);
  const refAt = clamp(bar.reference);
  const growsLeft = at < refAt;
  return (
    <span className={styles.peer} role="img" aria-label={aria} title={aria}>
      <span className={cn("value-lane", styles.peerRail)} aria-hidden>
        <i
          className="value-bar"
          data-end={growsLeft ? "start" : "end"}
          data-motion-draw="line"
          /* En az 1,5: kıyasın dibindeki değerde de yön görünsün (PeerStrip). */
          style={{
            ...(growsLeft ? { right: `${100 - refAt}%` } : { left: `${refAt}%` }),
            width: `${Math.max(Math.abs(at - refAt), 1.5)}%`,
            transformOrigin: growsLeft ? "right center" : "left center",
          }}
        />
        <i className="value-notch" style={{ left: `${refAt}%` }} />
      </span>
      <span className={styles.peerCaption} aria-hidden>
        <span>{caption}</span>
      </span>
    </span>
  );
}
