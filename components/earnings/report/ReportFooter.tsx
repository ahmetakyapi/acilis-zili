import { ArrowUpRight, FileText } from "@phosphor-icons/react/dist/ssr";
import { sourceHost } from "@/lib/analysis-visuals";
import visuals from "./ReportVisuals.module.css";
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
            {/* KAYNAK KARTLARI (25 Ekim görsel zirve). Sekiz bağlantı tek
                paragraf gibi akıyordu; her kaynak artık kendi kartında: belge
                adı, altında alan adı (nereye gideceğini bağlantıya basmadan
                söylüyor), 56 piksel dokunma yüksekliği. Adres süzgeci aynı. */}
            <ul className={visuals.sources}>
              {sources.map((source, index) => {
                /* ADRES SÜZGEÇTEN GEÇER. Kaynak listesi `/api/analiz` POST
                   gövdesinden geliyor ve oradaki `z.string().url()` yetmiyor:
                   doğrulama `new URL()` tabanlı olduğu için
                   `javascript:alert(1)` de geçerli bir adres sayılıyor.
                   React'in JSX kaçışı `href` özniteliğini kapsamaz. */
                const href = safeExternalUrl(source.url);
                const host = sourceHost(href);
                const body = (
                  <>
                    <span aria-hidden className={visuals.sourceIcon}>
                      <FileText weight="duotone" size={15} />
                    </span>
                    <span className={visuals.sourceText}>
                      <b>{source.label}</b>
                      <span>{host ?? t.analysisVisuals.sourceDocument}</span>
                    </span>
                  </>
                );
                return (
                  <li key={`${source.label}-${index}`} className="min-w-0">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={visuals.source}>
                        {body}
                        <ArrowUpRight aria-hidden size={14} />
                      </a>
                    ) : (
                      <span className={visuals.source}>{body}</span>
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
