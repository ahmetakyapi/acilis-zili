import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import styles from "@/components/earnings/EarningsReport.module.css";
import type { Dictionary } from "@/lib/i18n";
import type { EarningsAnalysisRow } from "@/lib/schema";
import { cn, safeExternalUrl } from "@/lib/utils";

/** Alt bilgi — hazırlanış notu ve kaynak künyesi. */
export function ReportFooter({
  t,
  sources,
}: {
  t: Dictionary;
  sources: NonNullable<EarningsAnalysisRow["sources"]>;
}) {
  return (
    <>
      {/* ---- Alt bilgi ---- */}
      <footer id="report-sources" className={cn(styles.reportFooter, "flex flex-col gap-2 border-t border-line pt-3.5")}>
        <p className="text-tiny text-muted">
          {t.analysis.preparedWith} · {t.analysis.disclaimer}
        </p>
        {sources.length > 0 && (
          /* KAYNAK KÜNYESİ MERCEK'TEKİYLE AYNI KALIPTA. Burası bir dönem tek
             bir cümleydi: etiket satır başında, bağlantılar " · " ile
             ayrılmış satır içi `<span>`lerde. İki sorun birden çıkarıyordu.

             Bağlantılar 14 piksellik metin kutularıydı. Negatif kenar
             boşluğuyla 32'ye çıkarılmışlardı ama 44'e çıkarılamıyorlardı:
             ölçüldü, satır içi oldukları ve satırlara sardıkları için
             genişletme her seferinde bir alttaki satırın bağlantısını
             kapıyordu — beşinin beşi de.

             Aynı iş mercek yazılarında zaten LİSTE olarak kuruluydu ve orada
             ayraç da gerekmiyordu; aralık zaten ayırıyor. Aynı künye iki
             ekranda iki farklı biçimde yazılıyordu. Liste kalıbına geçince
             üçü birden çözüldü: ayraç öğeleri gitti, negatif kenar boşluğu
             gitti, hedef telefonda gerçekten 44 oldu. */
          <>
            {/* "Kaynaklar" sekmesi buraya iniyor; başlıksız bir alt
                bilgiye iniyordu. Etiket düzeyinde bir h2 — sayfanın üç
                başlık düzeyinin en küçüğü. */}
            <h2 className="plate text-read text-muted">
              {t.analysis.sourcesLabel}
            </h2>
            <ul className="flex flex-wrap gap-x-4 text-tiny text-muted">
              {sources.map((source, index) => {
                /* ADRES SÜZGEÇTEN GEÇER. Kaynak listesi `/api/analiz` POST
                   gövdesinden geliyor ve oradaki `z.string().url()` yetmiyor:
                   doğrulama `new URL()` tabanlı olduğu için
                   `javascript:alert(1)` de geçerli bir adres sayılıyor.
                   React'in JSX kaçışı `href` özniteliğini kapsamaz, yani
                   tıklanan bağlantı çalışan bir betiğe dönüşürdü. Aynı süzgeç
                   mercek sayfasında zaten vardı; burası o düzeltmenin dışında
                   kalmıştı. */
                const href = safeExternalUrl(source.url);
                return (
                  <li key={`${source.label}-${index}`}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex min-h-11 items-center text-primary hover:underline sm:min-h-8"
                      >
                        {source.label}
                        <ArrowUpRight aria-hidden size={14} />
                      </a>
                    ) : (
                      <span className="inline-flex min-h-11 items-center sm:min-h-8">
                        {source.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </footer>
    </>
  );
}
