import type { Article } from "@phosphor-icons/react/dist/ssr";
import styles from "@/components/earnings/EarningsReport.module.css";
import { cn } from "@/lib/utils";

/**
 * Panel başlığı — ikon karosu, başlık, sağda künye.
 *
 * Güçlü Yönler / Riskler kartlarıyla aynı dil: sayfadaki her panel aynı
 * biçimde açılıyor, çıplak bir `<h2>` kalanın yanında yarım duruyordu.
 */
export function PanelHead({
  icon: Icon,
  title,
  meta,
  id,
}: {
  icon: typeof Article;
  title: string;
  meta?: string;
  /** Panelin `aria-labelledby`si için başlığın kimliği. */
  id?: string;
}) {
  return (
    /* flex-wrap: künye metni ("Açılış Zili Analiz Ekibi") telefonda başlığı
       iki satıra sıkıştırıyordu — sığmadığında kendi satırına düşer, başlık
       hep tek satır kalır. */
    <div className={cn(styles.panelHead, "mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line-soft pb-3")}>
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-wash text-primary-ink"
      >
        <Icon weight="duotone" size={15} />
      </span>
      <h2 id={id} className="whitespace-nowrap text-read font-bold tracking-[-0.01em] text-strong">
        {title}
      </h2>
      {meta && (
        <span className="plate ml-auto shrink-0 text-nano">
          {meta}
        </span>
      )}
    </div>
  );
}
