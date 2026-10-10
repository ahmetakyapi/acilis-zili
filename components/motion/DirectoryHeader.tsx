import { HeroAccent } from "./HeroAccent";
import type { ReactNode } from "react";
import styles from "./DirectoryExperience.module.css";

/** Server-rendered editorial header; all figures and graphics come from its page.
 *
 * `control`: ekranın tek denetimi, başlığın SAĞINDA. Bilançolar
 * takviminin Hafta/Ay anahtarı bir dönem açıklamanın altında kendi
 * satırındaydı ve telefonda başlık kartını 24 + 44 piksel uzatıyordu;
 * ekran düzeni kuralı (CLAUDE.md) denetimi başlığın sağına koyuyor. */
export function DirectoryHeader({ title, description, children, visual, control, share, shareInTitle = false, className = "" }: {
  title: string; description?: string; children?: ReactNode; visual?: ReactNode; control?: ReactNode;
  /** Paylaş düğmesi (`PageShare`) — varsayılan olarak açıklamanın ardında. */
  share?: ReactNode;
  /** Dizinlerde başlığın sağı; dar ekranda ek denetim bir alt satıra iner. */
  shareInTitle?: boolean;
  className?: string;
}) {
  return <header className={`${styles.hero} page-frame ${className}`} data-has-visual={!!visual}>
    {/* Sağ sütunda görsel varken yay YOK (10 Ekim): verinin arkasından
        geçiyordu (tasarım denetimi, /bilancolar ve /teknik). */}
    {!visual && <HeroAccent />}
    <div className={`${styles.heroCopy} page-heading-copy`}>
      {/* DENETİM BAŞLIĞIN YANINDA. İlk yerleşimde anahtar üst künyenin
          sağındaydı ve 390'da künye 117 piksellik anahtarın yanında iki
          satıra sarıyordu (ölçüldü). Başlık satırı kısa ("Bilançolar" 124
          piksel) ve anahtar orada rahat duruyor. Üst künye 9 Ekim 2026'da
          kalktı (`PageHeader` yorumu). */}
      <div className={styles.heroTitle} data-title-share={shareInTitle || undefined}>
        <h1>{title}</h1>
        {(control || (shareInTitle && share)) && <div className="page-title-actions">
          {control && <div data-header-control>{control}</div>}
          {shareInTitle && share}
        </div>}
      </div>
      {description && <p className={styles.description}>{description}</p>}
      {!shareInTitle && share && <div className={styles.share}>{share}</div>}
      {children}
    </div>
    {visual && <div className={styles.heroVisual}>{visual}</div>}
  </header>;
}
