import { HeroAccent } from "./HeroAccent";
import type { ReactNode } from "react";
import styles from "./DirectoryExperience.module.css";

/** Server-rendered editorial header; all figures and graphics come from its page.
 *
 * `control`: ekranın tek denetimi, başlığın SAĞINDA. Bilançolar
 * takviminin Hafta/Ay anahtarı bir dönem açıklamanın altında kendi
 * satırındaydı ve telefonda başlık kartını 24 + 44 piksel uzatıyordu;
 * ekran düzeni kuralı (CLAUDE.md) denetimi başlığın sağına koyuyor. */
export function DirectoryHeader({ title, description, children, visual, control, share, className = "" }: {
  title: string; description?: string; children?: ReactNode; visual?: ReactNode; control?: ReactNode;
  /** Paylaş düğmesi (`PageShare`) — açıklama cümlesinin ardında, her ekranda aynı yerde. */
  share?: ReactNode;
  className?: string;
}) {
  return <header className={`${styles.hero} page-frame ${className}`} data-has-visual={!!visual}>
    <HeroAccent />
    <div className={`${styles.heroCopy} page-heading-copy`}>
      {/* DENETİM BAŞLIĞIN YANINDA. İlk yerleşimde anahtar üst künyenin
          sağındaydı ve 390'da künye 117 piksellik anahtarın yanında iki
          satıra sarıyordu (ölçüldü). Başlık satırı kısa ("Bilançolar" 124
          piksel) ve anahtar orada rahat duruyor. Üst künye 9 Ekim 2026'da
          kalktı (`PageHeader` yorumu). */}
      <div className={styles.heroTitle}>
        <h1>{title}</h1>
        {control}
      </div>
      {description && <p className={styles.description}>{description}</p>}
      {share && <div className={styles.share}>{share}</div>}
      {children}
    </div>
    {visual && <div className={styles.heroVisual}>{visual}</div>}
  </header>;
}
