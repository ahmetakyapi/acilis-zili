import type { ReactNode } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { MetricStrip } from "@/components/earnings/MetricStrip";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { robustScale } from "@/lib/analysis-visuals";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
  verdictTextClass,
} from "@/lib/analysis";
import type { AnalysisIndexRow } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, formatEtDateLong, formatPercentPlain } from "@/lib/utils";
import styles from "./SymbolAnalyses.module.css";

/**
 * Bir şirketin yayımlanmış bilanço analizleri — hisse sayfasında.
 *
 * Geçmiş Bilançolar tablosunun HEMEN ÜSTÜNDE duruyor: tablo çeyreklerin
 * rakamları, bu panel o rakamların okunmuş hâli. Aralarına başka bir kart
 * girerse ikisi arasındaki bağ kopuyor.
 *
 * Analizi olmayan şirkette hiçbir şey basmaz — boş bir "henüz analiz yok"
 * kartı, beş yüzden fazla hisse sayfasının her birinde tekrar eden ve
 * hiçbir şey söylemeyen bir gürültü olurdu.
 */
/* SATIRLAR PROP — bileşen kendi sorgusunu ARTIK ATMIYOR. Panel
   `<Suspense fallback={null}>` içinde akıyordu ve geç gelince altındaki her
   şeyi aşağı itiyordu; aynı hatanın ölçülmüş hâli bu sayfanın mercek
   bloğunda yazılı (NVDA'da mobil CLS 0,266). Yer tutucu koymak da çözüm
   değildi: sembollerin çoğunda analiz yok, yani yer tutucu çoğu sayfada hiç
   gelmeyecek bir blok için boşluk ayırırdı.
   Sorgu yerel bir veritabanı okuması, sağlayıcıya gitmiyor — o yüzden
   sayfanın kendisi çekiyor, akışa bırakmıyor. Bloğun akacak hiçbir parçası
   kalmadığı için Suspense sınırı da gitti. */
export function SymbolAnalyses({
  rows,
  locale,
  t,
  footer,
}: {
  rows: AnalysisIndexRow[];
  locale: Locale;
  t: Dictionary;
  /**
   * Panelin son satırı — şirketin bilanço sayfası buraya en yeni analizin
   * hikâye girişini koyuyor (24 Ekim). Satır ayırıcısı listeninkiyle aynı
   * (`border-t`); hisse sayfası vermiyor, panel eski hâliyle.
   */
  footer?: ReactNode;
}) {
  if (rows.length === 0) return null;
  /* Tepki şeritleri panelin ortak ölçeğinde — analiz listelerinin dili
     (`RecentAnalysesStrip`, `LatestAnalyses`). */
  const L = t.analysisVisuals.list;
  /* ÜÇ ÖLÇÜ, ÜÇ ŞERİT: gelirin yıllık büyümesi, HBK sürprizi, ilk tepki —
     analiz listesinin kart görünümündeki üçlüyle aynı ad ve aynı sıra
     (`AnalysisCardGrid`). Her ölçü kendi ortak ölçeğinde; dar kapta yalnız
     tepki kalır (kap sorgusu, CSS). */
  const metrics = [
    { key: "revenue", label: L.revenue, pick: (row: AnalysisIndexRow) => row.revenueYoyPct, extra: true },
    { key: "eps", label: L.eps, pick: (row: AnalysisIndexRow) => row.epsSurprisePct, extra: true },
    { key: "reaction", label: L.reaction, pick: (row: AnalysisIndexRow) => row.reactionPct, extra: false },
  ].map((metric) => ({ ...metric, scale: robustScale(rows.map(metric.pick)) }));

  return (
    <Panel>
      <PanelHeader
        title={t.analysis.symbolPanelTitle}
        action={
          <PanelLink href="/bilancolar/analizler">
            {t.analysis.symbolPanelAll}
          </PanelLink>
        }
      />
      <ul className={styles.list}>
        {rows.map((row) => {
          const verdict = verdictOf(row.verdict);
          return (
            <li key={`${row.symbol}-${row.period}`}>
              <Link
                href={analysisHref(row.symbol, row.period)}
                prefetch={false}
                /* SATIR DÖRT BÖLGE (10 Kasım, görsel kalite turu): halka ·
                   dönem + manşet · ilk tepki · ok. Satır iki bölgeydi ve
                   manşet panelin tamamına yayılıyordu: 1440'ta ~1218 piksel,
                   ~205 karakterlik satır — okunmuyor, iki satıra kırpılmış
                   bir duvar gibi duruyordu; tarih ise dönem adından ~1050
                   piksel uzakta, sağ uçtaydı. Manşet 84 karakterde bitiyor,
                   tarih dönemin yanına indi, açılan yere sorgunun ZATEN
                   getirdiği ilk tepki (`reactionPct`) sıfır merkezli şeritte
                   girdi: çeyreğin puanının yanında piyasanın o gün ne dediği.
                   Geniş kapta yanına aynı sorgunun iki ölçüsü daha gelir
                   (gelirin yıllık büyümesi, HBK sürprizi).
                   Ok satırın bağlantı olduğunu söyler. Düzen ve ölçüm
                   `SymbolAnalyses.module.css`. */
                className={styles.row}
              >
                {/* PUAN HALKASI, DÜZ HAP DEĞİL. Satırın tamamı tek bir metin
                    şerididir: 12 puntoluk bir hap, üç kelime ve kırpılmış bir
                    cümle — panelin taşıdığı asıl bilgi (bu çeyrek kaç puan
                    aldı) hiçbir görsel ağırlık taşımıyordu. Halka bu sitede
                    zaten var ve analiz sayfasının kendi dili
                    (`components/earnings/ScoreRing.tsx`); panel de artık onu
                    konuşuyor. Renk tek başına bırakılmıyor — yanında AL/TUT/
                    SAT yazısı duruyor. */}
                {/* KARAR SÖZÜ PUANIN ALTINDA. Başlık satırında duruyordu ve
                    orada dönem etiketiyle yarışıyordu; oysa "93" ile "AL"
                    aynı hükmün iki yazımı — biri sayı, öteki kelime. Yan
                    yana değil alt alta durunca tek bir işaret oluyorlar ve
                    başlık satırı yalnızca döneme kalıyor. Renk yine tek
                    başına konuşmuyor: kelime halkanın altında yazılı. */}
                <span className={styles.score}>
                  <ScoreRing score={row.score} verdict={verdict} size={44} />
                  <span
                    className={cn(
                      /* `uppercase` YOK: sözlükteki değerler zaten
                         büyük harfli ("AL"/"TUT"/"SAT") ve CSS ile
                         ikinci kez büyütmek Türkçede i→I tuzağını
                         davet ederdi. */
                      "text-nano font-bold",
                      verdictTextClass(verdict),
                    )}
                  >
                    {verdictLabel(verdict, t)}
                  </span>
                </span>
                <span className={styles.main}>
                  <span className={styles.head}>
                    <span className={styles.period}>{row.periodLabel}</span>
                    <span className={cn("numeral", styles.date)}>
                      {formatEtDateLong(row.reportDate, locale)}
                    </span>
                    {row.reactionPct !== null && (
                      <b className={cn("numeral", styles.reactionInline, row.reactionPct >= 0 ? "text-up" : "text-down")}>
                        {row.reactionPct >= 0 ? "▲" : "▼"} {formatPercentPlain(row.reactionPct, locale, 1)}
                      </b>
                    )}
                  </span>
                  {/* Manşet iki satıra kadar açılıyor. Tek satıra kırpılmıştı
                      ve cümlenin yarısı "…" ile bitiyordu: dizin olsun diye
                      okunmaz hâle gelmişti. İki satır, hem cümleyi
                      tamamlıyor hem de satıra gövde kazandırıyor. */}
                  <span className={styles.headline}>{row.headline}</span>
                </span>
                {metrics.map((metric) => {
                  const value = metric.pick(row);
                  return value !== null && value !== undefined ? (
                    <span key={metric.key} className={styles.reaction} data-extra={metric.extra || undefined}>
                      <span className={styles.reactionHead}>
                        <span>{metric.label}</span>
                        <b className={cn("numeral", value >= 0 ? "text-up" : "text-down")}>
                          {value >= 0 ? "▲" : "▼"} {formatPercentPlain(value, locale, 1)}
                        </b>
                      </span>
                      <MetricStrip value={value} scale={metric.scale} />
                    </span>
                  ) : (
                    <span key={metric.key} aria-hidden className={styles.reaction} data-extra={metric.extra || undefined} />
                  );
                })}
                <ArrowRight aria-hidden size={16} weight="bold" className={styles.arrow} />
              </Link>
            </li>
          );
        })}
      </ul>
      {footer && <div className="border-t border-line">{footer}</div>}
    </Panel>
  );
}
