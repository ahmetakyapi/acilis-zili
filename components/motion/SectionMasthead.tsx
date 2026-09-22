import type { ReactNode } from "react";
import { HeroAccent } from "./HeroAccent";
import styles from "./EditorialExperience.module.css";

/** Compact editorial opening: the page's live data or story stays above the fold.
 *
 * `aside` KAPAĞIN SAĞ YARISINI DOLDURUR. Kapak bir sütun akışıydı ve geniş
 * ekranda sağ yarısı (ölçüldü: /mercek 1440px'te 1320 piksellik kutunun 690
 * pikseli) tümüyle boştu; ekranın kendi denetimi hemen ALTINDA, ayrı bir
 * şeritte duruyordu. Denetim yukarı alınınca hem o boşluk iş görüyor hem de
 * ilk ekrana bir şerit kadar daha içerik giriyor. Dar ekranda ızgara tek
 * kolona iner ve denetim yine başlığın altına geçer.
 */
export function SectionMasthead({ eyebrow, title, description, aside, embedded = false }: {
  eyebrow: string; title: string; description: string; aside?: ReactNode; embedded?: boolean;
}) {
  return <header className={`${styles.masthead} page-masthead`} data-embedded={embedded} data-has-aside={!!aside}>
    {!embedded && <HeroAccent />}
    <div className="page-heading-copy"><p className={`${styles.eyebrow} page-eyebrow`}>{eyebrow}</p><h1>{title}</h1></div>
    <p className={styles.mastheadDescription}>{description}</p>
    {aside && <div data-masthead-aside className={styles.mastheadAside}>{aside}</div>}
  </header>;
}
