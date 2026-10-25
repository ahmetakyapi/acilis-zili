import type { ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import styles from "./Brokers.module.css";

/**
 * KATLI SATIR — aracı kurum sayfasının tek katlama kalıbı (25 Ekim, kompakt
 * tur). Sahibinin sözü: "Burası da çok yer kaplıyor; detayları görmek
 * isteyen açarak baksın." Açıklama, varsayım ve kaynak blokları (Tüm Tarife
 * Ayrıntıları, Tabloda Olmayanlar, Kaynaklar, panonun Hesaplanamayanlar ve
 * Varsayımlar satırları) varsayılan KATLI; kapalıyken tek satır: başlık +
 * kısa özet + künye + ok.
 *
 * Yerli `<details>`: JavaScript'siz açılıyor, açılış geçişi globals.css'te
 * (`::details-content`), açılınca bastığın yerde uzuyor (`ExpandInPlace`
 * `summary`yi denetim sayıyor). Kaynak numarası gibi içerideki bir çapaya
 * gelen okur için katlamayı `RevealFoldAnchor` açıyor.
 *
 * Neden FoldToggle değil: o, listenin BİR KISMINI gösterip kalanını katlıyor
 * (`data-fold`); burada blok bütünüyle katlanıyor ve kapalı hâlin kendi
 * özeti var. Kartın içindeki "Ayrıntı" FoldToggle olarak kalıyor.
 *
 * Başlık `h2` (panel başlığı yerinde) ya da `h3` (bir panelin içindeki alt
 * satır). Özet dar ekranda başlığın altına iner; genişte tek satır, sığmayan
 * kısım üç noktayla biter (tamamı açılınca okunuyor).
 */
export function BrokerFold({
  id,
  title,
  headingId,
  level = 2,
  summary,
  meta,
  className,
  bodyClassName,
  children,
}: {
  id: string;
  title: string;
  headingId?: string;
  level?: 2 | 3;
  summary?: ReactNode;
  meta?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <details id={id} className={cn(styles.fold, styles.foldRow, className)} data-level={level}>
      <summary className={styles.foldLine}>
        <Heading
          id={headingId}
          className={
            level === 2
              ? cn("display-ink display-ink-tight w-fit text-lead font-bold tracking-[-0.015em]", styles.foldTitle)
              : styles.foldTitleSm
          }
        >
          {title}
        </Heading>
        {summary && <span className={styles.foldSummaryText}>{summary}</span>}
        <span className={styles.foldMeta}>
          {meta}
          <CaretDown size={14} weight="bold" aria-hidden className={styles.foldCaret} />
        </span>
      </summary>
      <div className={cn(styles.foldBody, bodyClassName)}>{children}</div>
    </details>
  );
}
