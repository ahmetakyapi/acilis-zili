import { HeroAccent } from "./HeroAccent";
import type { ReactNode } from "react";
import styles from "./DirectoryExperience.module.css";

/** Server-rendered editorial header; all figures and graphics come from its page.
 *
 * `control`: ekranın tek denetimi, başlığın SAĞINDA. Bilançolar
 * takviminin Hafta/Ay anahtarı bir dönem açıklamanın altında kendi
 * satırındaydı ve telefonda başlık kartını 24 + 44 piksel uzatıyordu;
 * ekran düzeni kuralı (CLAUDE.md) denetimi başlığın sağına koyuyor. */
export function DirectoryHeader({ eyebrow, title, description, children, visual, control }: {
  eyebrow: string; title: string; description?: string; children?: ReactNode; visual?: ReactNode; control?: ReactNode;
}) {
  return <header className={`${styles.hero} page-frame`} data-has-visual={!!visual}>
    <HeroAccent />
    <div className={`${styles.heroCopy} page-heading-copy`}>
      <p className={`${styles.eyebrow} page-eyebrow`}>{eyebrow}</p>
      {/* DENETİM BAŞLIĞIN YANINDA, ÜST KÜNYENİN DEĞİL. İlk yerleşimde
          anahtar üst künyenin sağındaydı ve 390'da "Finansal Sonuçlar ve
          Beklentiler" 117 piksellik anahtarın yanında iki satıra sarıyordu
          (ölçüldü: 183 piksel kaldı, künye 200 istiyor). Başlık satırı
          kısa ("Bilançolar" 124 piksel) ve anahtar orada rahat duruyor. */}
      <div className={styles.heroTitle}>
        <h1>{title}</h1>
        {control}
      </div>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </div>
    {visual && <div className={styles.heroVisual}>{visual}</div>}
  </header>;
}
