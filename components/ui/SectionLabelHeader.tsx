import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./SectionLabelHeader.module.css";

/**
 * Bölüm künyeli kapak — `PageHeader`ın görünümü, `h1`siz (14 Kasım 2026,
 * SEO denetimi ikinci tur).
 *
 * NEDEN: bülten sayısı (`/bulten/[tarih]`) ve günün grafiği
 * (`/gunun-grafigi/[tarih]`) sayfalarında `h1` bölümün adıydı ("Günlük
 * Bülten", "Günün Grafiği"): yüzlerce sayfa aynı `h1`i taşıyor, aranan
 * başlık (sayının manşeti) `h2`de kalıyordu. `h1` artık manşet; bölüm adı
 * bu kapakta künye olarak duruyor.
 *
 * GÖRÜNÜM DEĞİŞMEDİ, bilerek: kapağın bölüm adıyla açılması sahibinin
 * kararı (günün grafiği, 25 Ekim: "Başlık yok öncelikle"; rutinin başlığı
 * kartta). Değişen yalnız etiket: `h1` → `p`. `PageHeader`ın işaretlemesi
 * ve sınıfları aynen; `h1`e ETİKET SEÇİCİSİYLE gelen kurallar (globals.css
 * → `.page-heading-copy.page-heading-copy h1`, `main h1` degradesi ve
 * 0,12em'lik im payı, `title-rise` girişi) modülde sınıfla yeniden kuruldu.
 * Ölçüm modülün başında (kapak kutusu `/bulten` ile piksel piksel aynı).
 *
 * `PageHeader`a `as` prop'u eklemek daha temiz olurdu; `primitives.tsx`
 * paralel turda ana oturumun dosyası olduğu için burada ayrı duruyor.
 */
export function SectionLabelHeader({
  label,
  subtitle,
  action,
  className,
}: {
  /** Bölümün adı — başlık görünümünde ama başlık DEĞİL (`h1` sayfanın manşeti). */
  label: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("page-heading page-masthead flex flex-wrap items-start justify-between gap-4", className)} data-embedded={false}>
      <div className="min-w-0 page-heading-copy">
        <div>
          <p className={cn("display-ink", styles.label)}>{label}</p>
        </div>
        {subtitle && <p className="mt-[7px] max-w-3xl text-sm leading-relaxed text-body">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
