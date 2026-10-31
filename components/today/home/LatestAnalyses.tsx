import { SpotlightCard } from "@/components/motion/PremiumMotion";
import { VerdictPill } from "@/components/ui/VerdictPill";
import styles from "@/components/today/TodayExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { Panel, PanelHeader, PanelLink, LogoTile } from "@/components/ui/primitives";
import { getAnalyses, getSymbolNames } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { analysisHref, verdictLabel, verdictOf, } from "@/lib/analysis";
import { cn, formatEtDateCompact, formatPercentPlain } from "@/lib/utils";
import { MetricStrip } from "@/components/earnings/MetricStrip";
import { robustScale } from "@/lib/analysis-visuals";

/* Sol kolonun yedek kapasitesi — gerekçe `LatestAnalyses` içinde. */
const ANALYSES_BASE = 5;
const ANALYSES_MAX = 16;

/* ==========================================================================
   Son analizler
   ========================================================================== */

/**
 * Son bilanço analizleri.
 *
 * Kapı (Tümünü Gör) başlıkta duruyor. Boş liste basılmıyor: analiz yoksa
 * panel hiç çıkmıyor ve ızgara satırı kendiliğinden kapanıyor — okuma girişi
 * yukarıdaki Mercek bloğunda zaten var.
 */
export async function LatestAnalyses({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  /* BEŞ SATIR TABAN, SEKİZE KADAR YEDEK — favoriler listesindekiyle aynı
     kurgu, bu kez SOL kolon için. Sol kolonun boyu o günün verisine bağlı:
     bilanço açıklayan şirket yoksa "Bugün Bilanço Açıklayanlar" boş duruma
     düşüyor ve panel 156 piksele iniyor. Ölçüldü — böyle bir günde sol kolon
     1440 pikselde 127 piksel kısa kalıyordu ve o boşluğu kapatacak hiçbir
     şey yoktu.
     Sunucu sekiz satırın tamamını basıyor, beşten sonrası `hidden`;
     kaçının açılacağına tarayıcı iki kolonun dibini ölçerek karar veriyor
     (`FillColumn`). JavaScript kapalıysa beş satır kalıyor.
     SEKİZ → ON ALTI (29 Ekim, sahibinin ekranı: "sol taraf çok kısa, sağ
     taraf çok uzun"). Giriş yapmış okurda favoriler listesi ve Claude'un
     notu yan kolonu ~400 piksel uzatıyor; sekiz satırın hepsi açılmış ve
     sol kolon yine ~500 piksel kısa kalmıştı. Satır ~62 piksel; on altı
     satır o farkı kapatıyor, sığmayan yedek gizli kalıyor. */
  const analyses = await getAnalyses(locale, { limit: ANALYSES_MAX });

  if (analyses.length === 0) return null;

  const meta = await getSymbolNames([
    ...new Set(analyses.map((row) => row.symbol)),
  ]);
  /* Öne çıkan kartın üç ölçüsü listenin ortak ölçeğinde — kartın şeridi
     aşağıdaki satırların büyüklüğüyle aynı dilde okunsun. */
  const scales = {
    revenue: robustScale(analyses.map((row) => row.revenueYoyPct)),
    eps: robustScale(analyses.map((row) => row.epsSurprisePct)),
    reaction: robustScale(analyses.map((row) => row.reactionPct)),
  };
  const L = t.analysisVisuals.list;

  return (
    <Panel className="min-w-0">
      <PanelHeader
        /* Başlık tonu ANA KOLONDA `title`: rol ayrımı yere değil İŞE bağlı
           ve bu bir kayıt listesi, gösterge değil. Panel bir tur yan kolonda
           dururken plakaya inmişti. */
        title={t.today.latestAnalyses}
        action={
          <PanelLink href="/bilancolar/analizler">{t.common.showAll}</PanelLink>
        }
      />
      <ul className="divide-y divide-line-soft">
        {analyses.map((row, index) => {
          const verdict = verdictOf(row.verdict);
          const logo = meta[row.symbol]?.logoUrl;
          if (index === 0) {
            /* ÖNE ÇIKAN KART (31 Ekim). Halka "/ 100" paydası, altta küçük
               bir "Oku" ve ikinci kez yazılmış bir AL hapı taşıyordu;
               sahibinin itirazı "anlamsız duruyor". Artık görüş halkanın
               yanında adıyla, çeyreğin üç ölçüsü şeritle (bilanço karnesinin
               dili) ve tek, belirgin bir eylem. */
            const figures = [
              { key: "revenue", label: L.revenue, value: row.revenueYoyPct, digits: 0, scale: scales.revenue },
              { key: "eps", label: L.eps, value: row.epsSurprisePct, digits: 1, scale: scales.eps },
              { key: "reaction", label: L.reaction, value: row.reactionPct, digits: 1, scale: scales.reaction },
            ].filter((figure): figure is typeof figure & { value: number } => figure.value !== null);
            return (
              <li key={`${row.symbol}-${row.period}`}>
                <Link href={analysisHref(row.symbol, row.period)} prefetch={false} className={styles.analysisLeadLink} data-verdict={verdict}>
                  <SpotlightCard className={styles.analysisLead}>
                    <div className={styles.analysisIdentity}>
                      <LogoTile symbol={row.symbol} logoUrl={logo} size="md" />
                      <div><h3>{row.company}</h3><small>{row.symbol} · {row.periodLabel} · {formatEtDateCompact(row.reportDate, locale)}</small></div>
                    </div>
                    <div className={styles.analysisScore}>
                      <ScoreRing score={row.score} verdict={verdict} size={64} />
                      <span className={styles.analysisVerdict}>
                        <span>{t.analysis.verdictLabel}</span>
                        <b data-verdict={verdict}>{verdictLabel(verdict, t)}</b>
                      </span>
                    </div>
                    <p lang={row.locale} className={styles.analysisExcerpt}>{row.headline}</p>
                    {figures.length > 0 && (
                      <dl className={styles.analysisFigures}>
                        {figures.map((figure) => (
                          <div key={figure.key}>
                            <dt>{figure.label}</dt>
                            <dd className={cn("numeral", figure.value >= 0 ? "text-up" : "text-down")}>
                              {figure.value >= 0 ? "▲" : "▼"} {formatPercentPlain(figure.value, locale, figure.digits)}
                            </dd>
                            <MetricStrip value={figure.value} scale={figure.scale} />
                          </div>
                        ))}
                      </dl>
                    )}
                    <div className={styles.analysisFooter}>
                      <span className={styles.analysisCta}>{t.dayFlow.readAnalysis}<ArrowUpRight size={15} weight="bold" /></span>
                    </div>
                  </SpotlightCard>
                </Link>
              </li>
            );
          }
          return (
            <li
              key={`${row.symbol}-${row.period}`}
              /* `hidden` bu satırda React'in değil FillColumn'un: akışla gelen bölüm
                 henüz hydrate olmadan ölçüp açabiliyor ve React sunucudaki
                 `hidden`ı istemcidekiyle karşılaştırıp uyumsuzluk yazıyordu
                 (ana sayfa, 1440, aralıklı; ölçüldü). Nitelik bilerek React
                 dışında değişiyor; uyarı bastırılıyor, yama yapılmıyor. */
              data-fill={index >= ANALYSES_BASE ? "" : undefined}
              hidden={index >= ANALYSES_BASE}
              suppressHydrationWarning
            >
              <Link
                href={analysisHref(row.symbol, row.period)}
                prefetch={false}
                className="flex items-center gap-2.5 px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
              >
                <LogoTile symbol={row.symbol} logoUrl={logo} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-strong">
                    {row.company}
                  </span>
                  <span className="numeral block text-tiny text-muted">
                    {row.symbol} · {row.periodLabel}
                    <span aria-hidden className="mx-1.5">
                      ·
                    </span>
                    {formatEtDateCompact(row.reportDate, locale)}
                  </span>
                </span>
                <VerdictPill verdict={verdict} label={verdictLabel(verdict, t)} score={row.score} />
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
