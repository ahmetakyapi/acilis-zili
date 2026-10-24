import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import styles from "./RollingFigure.module.css";

/**
 * Yuvarlanarak gelen display sayısı — kilometre sayacı gibi.
 *
 * JAVASCRIPT YOK, SUNUCUDA ÇİZİLİYOR. Sayı zaten biçimlendirilmiş hâliyle
 * geliyor ("54.114,33 $"); her rakam kendi penceresinde 0–9 şeridinin
 * iki turu olarak basılıyor ve şerit CSS'le son rakamına kayıyor. Bir
 * istemci sayacı (değeri kare kare artırıp yeniden biçimlendiren) hem
 * hidrasyonu beklerdi hem de ara karelerde "54.1" gibi yarım biçimler
 * basardı; burada biçim ilk karede tam ve son hâl zaten HTML'de.
 *
 * GENİŞLİK SIÇRAMAZ. Pencerenin genişliğini son rakamın görünmez bir
 * kopyası belirliyor, şerit onun üstünde mutlak konumlu: dönerken satır
 * bir piksel bile kaymıyor (CLS 0). Şeritteki rakamlar orantılı yazıda
 * kendi genişliğinde ve pencerede ortalı; dönüş sırasındaki yarım piksellik
 * yatay titreme, tabular rakamın sayıyı gevşetmesinden iyi.
 *
 * Ekran okuyucu sayının tamamını düz metin olarak duyuyor; şeritler
 * `aria-hidden`. Hareketi azaltan okuyucu son kareyi görüyor (CSS).
 *
 * GÖRSEL RAKAMLAR DOM METNİ DEĞİL (24 Ekim). `aria-hidden` erişilebilirlik
 * ağacını temiz tutuyordu ama METİN ÇIKARIMINI değil: şeritler HTML'de
 * yirmişer rakamlık düz metindi ve `textContent` /bilancolar'daki GOOGL
 * kartında "Gelir Beklentisi132 Mr $1012345678901234567893…" okuyordu
 * (sayfada 18 tane 12+ haneli dizi, ölçüldü); `innerText` de duran kopyayı
 * ikinci kez veriyordu ("132 Mr $ 1 3 2 M r $"). Botlar, önizlemeler, okuma
 * modu ve dış incelemeler bu metni okuyor. Şimdi şeridin, duran kopyanın ve
 * ayraçların glifi CSS `content`ten geliyor (`data-c`, `::before`);
 * belgede sayının tek metni `sr-only` kopya. Ölçü: 12+ haneli dizi 0.
 *
 * YALNIZCA İLK EKRANDA. Animasyon yüklemede oynuyor, görünüme girişte
 * değil; ekranın altındaki bir sayıya konursa okuyucu oraya indiğinde
 * dönüş çoktan bitmiş olur.
 *
 * EKRANIN ALTINDAKİ SAYI İÇİN İKİNCİ BİLEŞEN VAR: `components/themes/
 * RollingFigure` görünüme girişte oynuyor ve ilk ekrandaki sayıya hiç
 * dokunmuyor (tema kartları). İkisi aynı şeyin kopyası değil, iki ayrı
 * an: kahraman yüklemede, aşağıdaki kart okuyucu ona indiğinde. Birini
 * ötekine zorlamak ya ilk ekranı kıpırdatır ya da alttaki dönüşü
 * kimsenin görmediği bir anda oynatır (28 Eylül birleştirmesinde
 * karşılaştırıldı). Değer DEĞİŞİNCE sayan sayaçlar (vergi sonucu, makro
 * seçimi) üçüncü bir iş ve kendi bileşenlerinde.
 */
export function RollingFigure({
  value,
  className,
  delayMs = 0,
}: {
  value: string;
  className?: string;
  /** Aynı kahramandaki ikinci sayı birincinin ardından dönsün diye. */
  delayMs?: number;
}) {
  const chars = [...value];
  const digitCount = chars.filter((char) => char >= "0" && char <= "9").length;
  let seen = 0;

  return (
    <span className={cn(styles.figure, className)}>
      <span className="sr-only">{value}</span>
      <span aria-hidden className={styles.track}>
        {chars.map((char, index) => {
          if (char < "0" || char > "9") {
            return (
              <span key={index} className={styles.glyph} data-c={char} />
            );
          }
          /* Sağdaki rakam önce durur, soldaki en uzun döner: sayaç
             en küçük basamaktan oturuyormuş gibi okunuyor. */
          const order = digitCount - seen;
          seen += 1;
          return (
            <span
              key={index}
              className={styles.window}
              style={
                {
                  "--digit": Number(char),
                  "--order": order,
                  "--delay": `${delayMs}ms`,
                } as CSSProperties
              }
            >
              <span className={styles.sizer} data-c={char} />
              <span className={styles.strip} />
            </span>
          );
        })}
      </span>
    </span>
  );
}
