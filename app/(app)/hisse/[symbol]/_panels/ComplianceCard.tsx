import styles from "../stock.module.css";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { getStatus, getSymbolNames } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getQuote } from "@/lib/providers";
import { COMPLIANCE_THRESHOLD, screenCompliance } from "@/lib/compliance";
import { getKeyMetrics } from "@/lib/providers/finnhub";
import { cn, formatPercentPlain, NO_VALUE } from "@/lib/utils";

/**
 * Katılım taraması — faaliyet alanı + AAOIFI finansal eşikleri.
 * Sonuç bir fetva değil, ön elemedir; kartın altındaki not bunu söyler.
 */
export async function ComplianceCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [metricsResult, quoteResult, meta] = await Promise.all([
    getKeyMetrics(symbol),
    getQuote(symbol, status),
    /* PARA BİRİMİ ŞART — MetricsCard'daki gerekçenin aynısı (500 satır
       yukarıda). Metrik ucu hisse başı değerleri ana borsanın parasında
       veriyor, fiyat dolar; kart ikisini bölüp SKHY'de %47.685 gibi
       imkânsız oranlar, PDD ve NTES'te yanlış "Geçemiyor" basıyordu.
       `getSymbolNames` istek içinde önbellekli, sayfa başı zaten çağırıyor. */
    getSymbolNames([symbol]),
  ]);

  const metrics = metricsResult.ok ? metricsResult.data : null;
  const price = quoteResult.ok ? quoteResult.data.price : null;
  const currency = meta[symbol]?.currency ?? null;

  const result = screenCompliance({
    symbol,
    price,
    currency,
    bookValuePerShare: metrics?.bookValuePerShare ?? null,
    debtToEquity: metrics?.debtToEquity ?? null,
    cashPerShare: metrics?.cashPerShare ?? null,
    /* Ölçülerin bu hisseye ait olduğunu sınamak için — gerekçe
       lib/compliance.ts → `ComplianceInputs.low52`. Gösterilmiyorlar. */
    low52: metrics?.low52 ?? null,
    high52: metrics?.high52 ?? null,
  });

  const verdictLabel =
    result.verdict === "pass"
      ? t.stock.compliancePass
      : result.verdict === "fail"
        ? t.stock.complianceFail
        : t.stock.complianceReview;

  const verdictClass =
    result.verdict === "pass"
      ? "bg-up-wash text-up"
      : result.verdict === "fail"
        ? "bg-down-wash text-down"
        : "bg-surface-elevated text-body";

  const ratios: [string, number | null][] = [
    [t.stock.complianceDebt, result.debtRatio],
    [t.stock.complianceCash, result.cashRatio],
  ];

  return (
    /* `flex-1` orta sütunun ARTAN YERİNİ bu kart yutuyor; gerekçe sütunun
       kendi yorumunda. `flex flex-col` olmadan `flex-1` yalnızca dış
       yüksekliği büyütürdü — içerik üstte kalsın diye gövde de esneyebilir
       durumda. */
    <Panel className={styles.compliancePanel}>
      {/* HÜKÜM BAŞLIĞIN YANINDA. Rozet gövdenin ilk satırıydı ve kendi
          satırını tümüyle işgal ediyordu: 28 piksel rozet + 14 piksel
          aralık, üstünde de başlığın 16 piksellik alt dolgusu. Yani kartın
          tek cümlelik cevabı, başlıktan 58 piksel aşağıda başlıyordu.
          Başlığın `action` yuvası tam bunun için var ve komşu Analist
          kartında aynı rol aynı yerde duruyor (orada da rozet başlığın
          sağında). Ölçek de oraya uyduruldu: `text-tiny`, `py-0.5`.
          Dar ekranda `flex-wrap` rozeti kendiliğinden alt satıra indiriyor,
          başlık kesilmiyor. Ölçüldü: kart 264 → 214 piksel. */}
      <PanelHeader
        title={t.stock.compliance}
        className="pb-1.5"
        action={
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-tiny font-semibold",
              verdictClass,
            )}
          >
            {verdictLabel}
          </span>
        }
      />
      <div className={styles.complianceBody}>
        {result.businessReasonKey && (
          <p className="mt-2.5 text-xs leading-relaxed text-body">
            {t.stock.complianceReasons[result.businessReasonKey]}
          </p>
        )}

        {/* FAALİYET ALANI TARANAMADIYSA BUNU SÖYLE. Alt sektör yalnızca
            endeks tohumundan geliyor ve tohumda olmayan sembolde A kriteri
            hiç çalışmıyor. Eskiden bu sessizdi: kart üç ölçütten ikisine
            bakıp "Ön Elemeyi Geçiyor" diyordu ve tam da taramanın var olma
            sebebi olan kategorilerde yanılıyordu (DKNG bahis, SOFI faizli
            kredi — ikisi de geçiyor görünüyordu). Artık hüküm "İnceleme
            Gerekir" ve eksiğin ne olduğu burada yazılı. */}
        {!result.businessKnown && (
          <p className="mt-2.5 text-xs leading-relaxed text-body">
            {t.stock.complianceNoSector}
          </p>
        )}

        {result.ratiosKnown ? (
          <dl className={styles.complianceRatios}>
            {ratios.map(([label, value]) => {
              const over = value !== null && value >= COMPLIANCE_THRESHOLD;
              const width =
                value === null
                  ? 0
                  : Math.min((value / COMPLIANCE_THRESHOLD) * 100, 100);
              return (
                <div key={label} className={styles.complianceRatio}>
                  <div className={styles.complianceReading}>
                    <dt className="text-tiny leading-tight text-muted">
                      {label}
                    </dt>
                    <dd
                      className={cn(
                        "numeral shrink-0 text-xs font-semibold",
                        over ? "text-down" : "text-strong",
                      )}
                    >
                      {/* Yüzde işareti sözlüğe değil biçimlendiriciye ait:
                          elden yazılan "%" iki dilde de sonda kalıyordu
                          ("12,3%"), oysa Türkçede önde yazılır. */}
                      {value !== null
                        ? formatPercentPlain(value, locale, 1)
                        : NO_VALUE}
                    </dd>
                  </div>
                  {/* Eşiğe ne kadar yakın — çubuk %33'te dolar */}
                  <div className={styles.complianceTrack}>
                    <div
                      data-motion-draw="line"
                      className={cn("h-full", over ? "bg-down" : "bg-up")}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className={styles.complianceScale}><span className="numeral">0</span><span>{t.stock.complianceLimit} <b className="numeral">{formatPercentPlain(COMPLIANCE_THRESHOLD, locale, 0)}</b></span></div>
                </div>
              );
            })}
              {/* Yüzde işareti biçimlendiriciye ait — kartın 18 satır
                  yukarısındaki kural bunu açıkça yazıyor ve oranların
                  kendisi ona uyuyor. Sınır satırı atlanmıştı: elden yazılan
                  "%" iki dilde de önde kalıyordu, oysa İngilizcede sonda
                  yazılır ("33%"). `digits: 0` şart — varsayılan 1 olduğu için
                  argümansız çağrı "%33,0" basardı. */}
          </dl>
        ) : currency && currency !== "USD" ? (
          /* Oranlar bilerek hesaplanmadı: pay ana borsanın parasında, payda
             dolar. Kur uydurulmuyor; gerekçe lib/compliance.ts → `currency`. */
          <p className="mt-3 text-xs text-muted">
            {t.stock.complianceForeignCurrency}{" "}
            <span className="numeral font-semibold text-body">({currency})</span>
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted">{t.stock.complianceUnknown}</p>
        )}

        {/* İKİ UYARI KATLANDI — kart artık ÜÇ KOLONUN BOYUNU BELİRLİYOR.
            Ölçüldü: şerit 580 piksel ve bu boyu orta sütun kuruyor; sol
            (metrikler) ve sağ (analist) kartların içeriği 310-340'ta bitip
            altlarında ~240 piksel boş kalıyordu. Kartın 315 pikselinin 120'si
            bu iki paragraftı.

            EN ÖNEMLİ CÜMLE AÇIKTA: "Bu bir fetva değildir" katlanan yerin
            değil, tetikleyicinin kendisi. Katlanan şey o cümlenin
            AÇIKLAMASI ve taranamayan ölçüt — ikisi de sayfada duruyor, bir
            tık ötede. Uyarıyı tümüyle gizlemek dini uyum ekranında kabul
            edilebilir olmazdı.

            `<details>` KALIYOR, istemci durumu değil: katlama JS gelmeden de
            çalışıyor — emsali components/today/BriefBody.tsx. */}
        <details className="group/uyum mt-3 border-t border-line-soft pt-2.5">
          {/* `tap-44`: özet satırı 35 piksel yüksekliğindeydi (390'da ölçüldü);
              `min-h-9` (36) fare için yeterli, parmak için değil. */}
          <summary className="tap-44 inline-flex min-h-9 w-fit cursor-pointer list-none items-center gap-1.5 text-nano font-semibold text-muted transition-colors hover:text-body [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden
              className="transition-transform group-open/uyum:rotate-90"
            >
              ›
            </span>
            {t.stock.complianceNotFatwa}
          </summary>
          <p className="mt-1 text-nano leading-relaxed text-muted">
            {t.stock.complianceDisclaimer}
          </p>
          <p className="mt-1.5 text-nano leading-relaxed text-muted">
            {t.stock.complianceMissing}
          </p>
        </details>
      </div>
    </Panel>
  );
}
