import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import type { CompanyRow } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { SECTOR_GROUPS, sectorGroupLabel, sectorGroupOf } from "@/lib/sectors";
import { sharePercent, shareSlices, stackSlices } from "@/lib/tool-visuals";
import styles from "./SectorDistribution.module.css";

/** SVG ölçeği — yatay 1000 birim, gerilir; dikey sabit piksel. */
const W = 1000;
const BAR_H = 26;
const RIBBON_H = 46;
const GAP = 3;
/** Parçanın içine yüzde yazılan en küçük pay. */
const LABEL_MIN = 0.06;
/** Telefonda künyede açık duran grup sayısı; fazlası ≥640'ta. */
const PHONE_LEGEND = 6;

/**
 * SEKTÖR DAĞILIMI (25 Ekim görsel turu) — /sirketler.
 *
 * Şeritteki çipler sektör başına ŞİRKET SAYISINI söylüyordu; piyasanın
 * nerede durduğunu (değerin hangi grupta yoğunlaştığını) söyleyen hiçbir şey
 * yoktu. İki şerit üst üste: üstte şirket sayısı, altta toplam piyasa
 * değeri, aynı grup sırasıyla; aralarındaki şerit (alüvyon) aynı grubun iki
 * payını bağlıyor. Az şirketle büyük değer tutan grup aşağı doğru GENİŞLİYOR,
 * kalabalık ama küçük grup DARALIYOR — yoğunlaşma tek bakışta.
 *
 * Renk (güncel karar): büyüklük markanın yumuşak mavisi, seçili/üzerine
 * gelinen grup doygun mavi (etkileşim). Her grup TEK bağlantı (`<a>` SVG
 * içinde: iki dikdörtgen + şerit birlikte vurgulanıyor, `:has` yok).
 *
 * Değer ÖNBELLEKTEKİ piyasa değeri (`getCompanies`); tablodaki canlı
 * değerden birkaç dakika geride olabilir ve künye bunu söylüyor. Toplam
 * başka bir yerde sayı olarak basılmıyor, yalnız pay olarak.
 */
export function SectorDistribution({
  companies,
  activeKey,
  hrefFor,
  locale,
  t,
}: {
  companies: CompanyRow[];
  activeKey: string | null;
  /** Grubun süzgeç adresi; null süzgeci kaldırır. */
  hrefFor: (key: string | null) => string;
  locale: Locale;
  t: Dictionary;
}) {
  const D = t.toolVisuals.companies;
  const slices = shareSlices(
    companies.map((company) => ({ key: sectorGroupOf(company.industry).key, value: company.marketCap })),
  );
  if (slices.length < 2) return null;
  const groupBy = new Map(SECTOR_GROUPS.map((group) => [group.key, group]));
  const labelOf = (key: string) => {
    const group = groupBy.get(key);
    return group ? sectorGroupLabel(group, locale) : key;
  };
  const pct = (share: number) => D.sharePct.replace("{p}", String(sharePercent(share)));

  /* Konumlar — boşluk payı düşülüp paylara bölünür. */
  const geo = stackSlices(slices, W, GAP);
  const top = slices[0];
  const lead = D.distLead
    .replace("{group}", labelOf(top.key))
    .replace("{c}", String(sharePercent(top.countShare)))
    .replace("{v}", String(sharePercent(top.valueShare)));
  const H = BAR_H * 2 + RIBBON_H;

  return (
    <Panel>
      <PanelHeader title={D.distTitle} meta={D.distMeta} />
      <div className={styles.body}>
        <p className={styles.lead}>{lead}</p>

        <div className={styles.figure}>
          <span className={styles.axisLabel}>{D.distCount}</span>
          <div className={styles.chart}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={styles.svg} role="list">
              {geo.map((g) => {
                const label = labelOf(g.key);
                const active = g.key === activeKey;
                const ribbon = [
                  `M${g.cx} ${BAR_H}`,
                  `C${g.cx} ${BAR_H + RIBBON_H / 2} ${g.vx} ${BAR_H + RIBBON_H / 2} ${g.vx} ${BAR_H + RIBBON_H}`,
                  `L${g.vx + g.vw} ${BAR_H + RIBBON_H}`,
                  `C${g.vx + g.vw} ${BAR_H + RIBBON_H / 2} ${g.cx + g.cw} ${BAR_H + RIBBON_H / 2} ${g.cx + g.cw} ${BAR_H}`,
                  "Z",
                ].join(" ");
                return (
                  /* `Link` SVG içinde de SVG `<a>` olarak doğuyor (React
                     ebeveynin ad alanını alır); istemci gezinmesi ve
                     scroll={false} korunuyor. */
                  <Link
                    key={g.key}
                    href={hrefFor(active ? null : g.key)}
                    scroll={false}
                    className={styles.group}
                    data-active={active || undefined}
                    role="listitem"
                    aria-label={D.distItemAria
                      .replace("{group}", label)
                      .replace("{n}", g.count.toLocaleString(locale))
                      .replace("{c}", String(sharePercent(g.countShare)))
                      .replace("{v}", String(sharePercent(g.valueShare)))}
                  >
                    <title>{`${label} · ${g.count} · ${pct(g.countShare)} / ${pct(g.valueShare)}`}</title>
                    <rect className={styles.count} x={g.cx} y={0} width={Math.max(g.cw, 0.5)} height={BAR_H} rx={4} />
                    <path className={styles.ribbon} d={ribbon} />
                    <rect className={styles.value} x={g.vx} y={BAR_H + RIBBON_H} width={Math.max(g.vw, 0.5)} height={BAR_H} rx={4} />
                  </Link>
                );
              })}
            </svg>
            {/* Yüzdeler HTML'de: gerilen SVG'de yazı da gerilirdi. */}
            {geo.map((g) =>
              g.countShare >= LABEL_MIN ? (
                <span key={`c-${g.key}`} aria-hidden className={`numeral ${styles.pct}`} style={{ left: `${((g.cx + 6) / W) * 100}%`, top: 0 }}>
                  {pct(g.countShare)}
                </span>
              ) : null,
            )}
            {geo.map((g) =>
              g.valueShare >= LABEL_MIN ? (
                <span
                  key={`v-${g.key}`}
                  aria-hidden
                  className={`numeral ${styles.pct} ${styles.pctValue}`}
                  data-active={g.key === activeKey || undefined}
                  style={{ left: `${((g.vx + 6) / W) * 100}%`, top: BAR_H + RIBBON_H }}
                >
                  {pct(g.valueShare)}
                </span>
              ) : null,
            )}
          </div>
          <span className={styles.axisLabel}>{D.distValue}</span>
        </div>

        <ol className={styles.legend}>
          {geo.map((g, i) => (
            <li key={g.key} className={i >= PHONE_LEGEND ? styles.wideOnly : undefined}>
              <Link
                href={hrefFor(g.key === activeKey ? null : g.key)}
                scroll={false}
                className={styles.legendLink}
                data-active={g.key === activeKey || undefined}
              >
                <span className={styles.legendName}>{labelOf(g.key)}</span>
                <span className={`numeral ${styles.legendCount}`}>{g.count.toLocaleString(locale)}</span>
                <span className={`numeral ${styles.legendShares}`}>
                  {pct(g.countShare)}
                  <span aria-hidden> → </span>
                  <b>{pct(g.valueShare)}</b>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        {geo.length > PHONE_LEGEND && (
          <p className={styles.phoneMore}>{D.distMore.replace("{n}", String(geo.length - PHONE_LEGEND))}</p>
        )}
        <p className={styles.note}>{D.distNote}</p>
      </div>
    </Panel>
  );
}
