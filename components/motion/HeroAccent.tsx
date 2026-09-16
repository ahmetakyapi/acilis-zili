import styles from "./PremiumMotion.module.css";

/**
 * Başlık kartının köşe motifi — sağ üstten yayılan iki yay.
 *
 * SÜS METNİN ÜSTÜNDEN GEÇMEZ. Önceki hâl kartın sağ %70'ini kaplayan tam
 * yükseklikte bir çizimdi ve telefonda hiçbir yere sığmıyordu: 390 pikselde
 * kutu başlığın üstüne biniyordu (üç sayfada da ölçüldü), `/piyasalar`'da
 * 352×466 ile kartın TAMAMINI kaplıyor, içindeki endeks kartının ortasından
 * geçiyordu. Masaüstünde sorun görünmüyordu çünkü orada sağ sütunda görsel
 * var ve süs onun arkasına düşüyor; mobilde kolonlar tek sütuna inince
 * saklanacak yer kalmıyor.
 *
 * Motif artık sınırlı bir köşe kutusunda: metin sütununa hiç girmiyor,
 * genişlik ve yükseklik sabit oranla büyüyor. Uzun çapraz iz KALDIRILDI —
 * kartların ortasından geçen çizgi oydu; yayların kendisi zaten aynı işareti
 * veriyor ve köşede kalıyor.
 *
 * Üç yay iki yaya indi: aynı merkezden çıkan üçüncü halka bu ölçekte
 * kalınlaşan bir leke gibi okunuyordu, ayrı bir bilgi taşımıyor.
 *
 * `preserveAspectRatio` `slice` değil `meet`: `slice` kutuyu doldurmak için
 * çizimi kırpıyor ve kutunun oranı değiştikçe yayların nereden geçtiği
 * öngörülemez oluyordu. `meet` ile çizim kutunun içine tam oturuyor.
 */
export function HeroAccent() {
  return (
    <div className={styles.heroAccent} aria-hidden="true">
      <svg viewBox="0 0 200 140" fill="none" preserveAspectRatio="xMaxYMin meet">
        <g className={styles.accentContours}>
          <circle cx="196" cy="-8" r="94" />
          <circle cx="196" cy="-8" r="136" />
        </g>
      </svg>
    </div>
  );
}
