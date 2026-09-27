import { ScoreRing } from "@/components/earnings/ScoreRing";
import { ClampedHeadline } from "@/components/earnings/ClampedHeadline";
import styles from "@/components/earnings/EarningsReport.module.css";
import { verdictLabel, verdictTextClass, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EarningsAnalysisRow } from "@/lib/schema";
import { cn, formatPercentPlain, SIGN_GAP } from "@/lib/utils";
import { PLATE_LABEL, type Upside } from "./shared";

/**
 * Genel Görüş şeridi — skor, karar, iki cümlelik gerekçe ve analist hedefi
 * tek satırda. Sayfanın en üstünde duruyor çünkü okuyucunun ilk sorusu bu;
 * altındaki her şey bu satırın gerekçesi.
 *
 * TELEFONDA KAPAĞIN İKİNCİ BANDI (24 Eylül). Sayfa başındaki not ("mobilde
 * karne en üste çıkar") uygulanmamıştı: 390×844'te halka 789'da, sabit
 * sekme çubuğu 764'te başlıyordu — görüş ilk ekranda hiç görünmüyordu.
 * 640'ın altında şerit kimliğin hemen altında: solda 56 piksellik halka ve
 * karar, sağda hedef; gerekçe dört satıra kırpılıp "Devamını Oku" ile
 * açılıyor. Geniş ekranda sonuçlar yine önde (CSS `order`), orada ilk
 * ekrana ikisi de sığıyor.
 *
 * Potansiyelin hangi fiyattan ölçüldüğü artık rozetin altında yazılı ve
 * fiyat hedefin üstündeyse rozet "Hedefin Üzerinde" diyor — gerekçe sayfa
 * gövdesindeki `upside` hesabında.
 */
export function VerdictStrip({
  row,
  verdict,
  upside,
  targetText,
  locale,
  t,
}: {
  row: EarningsAnalysisRow;
  verdict: VerdictKey;
  upside: Upside | null;
  targetText: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className={styles.verdictPanel} aria-labelledby="report-verdict" data-has-target={targetText !== null}>
      <div className={styles.verdictScore}>
      <ScoreRing score={row.score} verdict={verdict} size={80} showDenominator />
      <div className={styles.verdictDecision}>
        {/* Etiket, manşet değil — sayfanın üç başlık düzeyinden en küçüğü
            (`.plate`): bölüm başlığı, panel başlığı, etiket. 11 piksellik
            başlık genel `main h2` degradesini alıyordu (globals.css,
            `data-ink` notu); `.plate` o kuralın dışında. */}
        <h2 id="report-verdict" className="plate text-body">
          {t.analysis.verdictLabel}
        </h2>
        <span
          className={cn(
            styles.verdictWord,
            "text-subdisplay font-bold leading-none tracking-[-0.03em]",
            verdictTextClass(verdict),
          )}
        >
          {verdictLabel(verdict, t)}
        </span>
      </div>
      </div>
      {/* ÖLÇÜ SINIRI. Paragraf hüküm bloğunun ortasında ve `flex-1` ile
          kalan yerin tamamını alıyordu: ölçüldü, 1440 pikselde satır başına
          127 karakter — okunabilir aralığın (45-75) çok üstünde ve göz satır
          sonunda yerini kaybediyor. Sınır modülde (`.verdictHeadline`);
          76ch bir dönem yetmedi — Schibsted'in "0"ı geniş olduğu için 709
          piksele, 93 karaktere çözülüyordu. */}
      <ClampedHeadline
        text={row.headline}
        lang={row.locale}
        className={styles.verdictHeadline}
        moreLabel={t.analysis.readMore}
        lessLabel={t.analysis.readLess}
      />
      {targetText !== null && (
        /* Analist hedefi bir ara BEYAZ bir kutuya alınmıştı: serbest akışta
           şeridin sağ ucunda yetim duruyordu, kutu ona yüzey veriyordu. Ama
           kutu bu kez tinted şeridin üstünde parlak bir yama gibi okundu —
           şeridin parçası olmak yerine üstüne yapıştırılmış duruyordu.
           Çözüm kutu değil AYRAÇ: hedef bloğu kendi sol çizgisini taşıyor
           ve ölçü kendi yüzeyi olmadan şeridin bir parçası olarak duruyor.

           İKİ KÜNYE, İKİ DAYANAK. Hedef kaydın, yani bilanço günü
           analistlerin ortalaması; potansiyel ise hangi fiyattan ölçüldüyse
           onu yazıyor. İkisi farklı anlara ait ve ikisi de adıyla. */
        <div className={styles.verdictTarget}>
          <span className={cn(PLATE_LABEL, "text-muted")}>
            {row.analystCount
              ? t.analysis.analystTargetCount.replace(
                  "{count}",
                  String(row.analystCount),
                )
              : t.analysis.analystTarget}
          </span>
          <span className={cn(styles.targetValue, "figure font-bold leading-none tracking-[-0.035em] text-strong")}>
            {targetText}
          </span>
          <span className="text-nano font-medium text-muted">{t.analysis.asOfReport}</span>
          {upside !== null && (
            <span className="flex flex-col items-start gap-1">
              <span
                className={cn(
                  "figure inline-flex items-baseline gap-1 rounded-md px-1.5 py-[2px] text-tiny font-bold",
                  upside.pct >= 0
                    ? "bg-up-wash text-up"
                    : "bg-down-wash text-down",
                )}
              >
                {/* Ok burada ayrı bir flex düğümü değil, dizeye bitişik
                    duruyor — aradaki dar boşluk bu yüzden `gap-*` ile değil
                    SIGN_GAP ile veriliyor. */}
                {upside.pct >= 0 ? "▲" : "▼"}
                {SIGN_GAP}
                {formatPercentPlain(upside.pct, locale, 1)}{" "}
                {upside.pct >= 0 ? t.analysis.upsidePotential : t.analysis.aboveTarget}
              </span>
              <span className="text-nano font-medium text-muted">
                {upside.basis === "today"
                  ? t.analysis.upsideFromToday
                  : t.analysis.upsideFromReport}
              </span>
            </span>
          )}
        </div>
      )}
    </section>
  );
}
