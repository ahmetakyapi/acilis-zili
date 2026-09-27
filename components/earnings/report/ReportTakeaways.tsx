import { Lightning } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/motion/PremiumMotion";
import { Panel } from "@/components/ui/primitives";
import { RichText } from "@/components/earnings/RichText";
import type { AutoLinker } from "@/lib/autolink";
import type { Dictionary } from "@/lib/i18n";
import { PanelHead } from "./PanelHead";
import styles from "./ReportExtras.module.css";

/**
 * Bilanço Özeti — "30 Saniyede".
 *
 * Kapaktan hemen sonra, rakamlar bölümünden ÖNCE. Kapak görüşü ve iki öncü
 * ölçüyü veriyor; okuyucunun bir sonraki sorusu "özetle ne oldu" ve o
 * cevap dokuz paragraflık Özet panelinin en altındaydı (1440'ta kapaktan
 * 2.300 piksel aşağıda). Üç madde ekranda paragraf değil, üç ayrı cümle:
 * yalnızca bunları okuyan da çeyreği bilir.
 *
 * Kayıtta yoksa HİÇ basılmaz — eski analizler bugünkü gibi çizilir.
 */
export function ReportTakeaways({
  takeaways,
  lang,
  t,
  linker,
}: {
  takeaways: string[];
  /** Maddelerin yazıldığı dil — çevirisi olmayan analiz orijinalini gösterir. */
  lang: string;
  t: Dictionary;
  /** Sayfanın tek bağlayıcısı — gerekçe `RichText`te. */
  linker: AutoLinker;
}) {
  if (takeaways.length === 0) return null;
  return (
    <Reveal>
      <Panel className={styles.panel} aria-labelledby="report-takeaways">
        <PanelHead
          icon={Lightning}
          title={t.earningsExtra.summaryTitle}
          meta={t.earningsExtra.summaryMeta}
          id="report-takeaways"
        />
        <ol className={styles.takeaways} lang={lang}>
          {takeaways.map((item, index) => (
            <li key={index} className={styles.takeaway}>
              <span aria-hidden className={styles.takeawayIndex}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <RichText text={item} linker={linker} />
              </span>
            </li>
          ))}
        </ol>
      </Panel>
    </Reveal>
  );
}
