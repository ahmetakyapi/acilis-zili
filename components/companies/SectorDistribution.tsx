import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { CompanyRow } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { SECTOR_GROUPS, sectorGroupLabel, sectorGroupOf } from "@/lib/sectors";
import { REST_SLICE, foldSlices, sharePercent, shareSlices, stackSlices } from "@/lib/tool-visuals";
import styles from "./SectorDistribution.module.css";

/** SVG ölçeği — yatay 1000 birim, gerilir; dikey sabit piksel. */
const W = 1000;
const BAR_H = 24;
const RIBBON_H = 36;
const GAP = 4;
/** Ayrı dilim olarak kalan grup sayısı; gerisi "kalan" dilimine katlanır. */
const KEEP = 5;
/** Parçanın içine yüzde yazılan en küçük pay (geniş ekranda). */
const LABEL_MIN = 0.07;
/** Telefonda şerit ~230 piksel: bu payın altındaki yüzde yazısı komşu
 *  parçaya taşar, orada gizlenir. */
const LABEL_PHONE_MIN = 0.14;

/**
 * SEKTÖR DAĞILIMI — kapağın ikinci sekmesi (25 Ekim, sahibinin isteği:
 * "Sektör dağılımı buraya tablı olsun").
 *
 * Önce kendi panelindeydi, ilk ekranı kapladığı için tablonun altına
 * indirildi; orada da okunmuyordu (sayfanın sonu). Artık başlık kartının
 * sağında "Piyasanın Devleri"nin yanında bir sekme ve devler panelinin
 * boyuna (≥640'ta ~236 piksel) sığan KOMPAKT sürüm:
 *
 * - İki bağlı şerit: üstte şirket sayısı payı, altta piyasa değeri payı,
 *   aynı grup sırasıyla; aradaki şerit aynı grubun iki payını bağlıyor.
 *   Az şirketle büyük değer tutan grup aşağı doğru GENİŞLİYOR.
 * - İlk beş grup ayrı, gerisi tek "Kalan N Grup" dilimi (`foldSlices`):
 *   on dört grubun kuyruğu 550 piksellik şeritte birkaç piksel kalıyordu.
 *   Tabloyu kuyruktaki bir gruba süzen okuyucu o grubu yine ayrı görür.
 * - Altında altı satırlık ölçü ızgarası: ad ve "%8 → %20".
 *
 * Sayfanın altındaki büyük panel KALKTI (tek yer): ondaki ek bilgi kuyruk
 * gruplarının ayrı payıydı; o grupların şirket sayısı zaten kapaktaki
 * sektör çiplerinde, seçilen grubun payı da burada ayrı dilim olarak.
 *
 * Renk: büyüklük markanın yumuşak mavisi, seçili/üzerine gelinen grup
 * doygun mavi (etkileşim); kalan dilim nötr çizgi tonu (bir grup değil,
 * tıklanmaz). Her grup TEK bağlantı (`<a>` SVG içinde; `:has` yok).
 *
 * Değer ÖNBELLEKTEKİ piyasa değeri (`getCompanies`); tablodaki canlı
 * değerden birkaç dakika geride olabilir ve künye bunu söylüyor.
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
  const all = shareSlices(
    companies.map((company) => ({ key: sectorGroupOf(company.industry).key, value: company.marketCap })),
  );
  if (all.length < 2) return null;
  const { slices, restGroups } = foldSlices(all, KEEP, activeKey);
  const groupBy = new Map(SECTOR_GROUPS.map((group) => [group.key, group]));
  const labelOf = (key: string) => {
    if (key === REST_SLICE) return D.distRest.replace("{n}", String(restGroups));
    const group = groupBy.get(key);
    return group ? sectorGroupLabel(group, locale) : key;
  };
  const pct = (share: number) => D.sharePct.replace("{p}", String(sharePercent(share)));
  const geo = stackSlices(slices, W, GAP);
  const H = BAR_H * 2 + RIBBON_H;

  const ariaOf = (g: (typeof geo)[number]) =>
    g.key === REST_SLICE
      ? D.distRestAria
          .replace("{n}", String(restGroups))
          .replace("{c}", g.count.toLocaleString(locale))
          .replace("{p}", String(sharePercent(g.countShare)))
          .replace("{v}", String(sharePercent(g.valueShare)))
      : D.distItemAria
          .replace("{group}", labelOf(g.key))
          .replace("{n}", g.count.toLocaleString(locale))
          .replace("{c}", String(sharePercent(g.countShare)))
          .replace("{v}", String(sharePercent(g.valueShare)));

  const labelClass = (share: number) =>
    share >= LABEL_PHONE_MIN ? styles.pct : `${styles.pct} ${styles.pctWide}`;

  return (
    <div className={styles.body}>
      <div className={styles.figure}>
        {/* Eksen adları şeritlerin SOLUNDA, kendi hizalarında: üstte ve
            altta ayrı satır olsalar kompakt panele 40 piksel eklerdi. */}
        <div className={styles.axis} aria-hidden>
          <span>{D.distCount}</span>
          <span>{D.distValue}</span>
        </div>
        <div className={styles.chart}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={styles.svg} role="list">
            {geo.map((g) => {
              const rest = g.key === REST_SLICE;
              const active = g.key === activeKey;
              const ribbon = [
                `M${g.cx} ${BAR_H}`,
                `C${g.cx} ${BAR_H + RIBBON_H / 2} ${g.vx} ${BAR_H + RIBBON_H / 2} ${g.vx} ${BAR_H + RIBBON_H}`,
                `L${g.vx + g.vw} ${BAR_H + RIBBON_H}`,
                `C${g.vx + g.vw} ${BAR_H + RIBBON_H / 2} ${g.cx + g.cw} ${BAR_H + RIBBON_H / 2} ${g.cx + g.cw} ${BAR_H}`,
                "Z",
              ].join(" ");
              const shapes = (
                <>
                  <title>{`${labelOf(g.key)} · ${g.count} · ${pct(g.countShare)} → ${pct(g.valueShare)}`}</title>
                  <rect className={styles.count} x={g.cx} y={0} width={Math.max(g.cw, 0.5)} height={BAR_H} rx={4} />
                  <path className={styles.ribbon} d={ribbon} />
                  <rect className={styles.value} x={g.vx} y={BAR_H + RIBBON_H} width={Math.max(g.vw, 0.5)} height={BAR_H} rx={4} />
                </>
              );
              /* Kalan dilim bir grup değil: süzülecek tek bir anahtarı yok,
                 bağlantı olmuyor. */
              return rest ? (
                <g key={g.key} className={styles.rest} role="listitem" aria-label={ariaOf(g)}>
                  {shapes}
                </g>
              ) : (
                /* `Link` SVG içinde de SVG `<a>` olarak doğuyor; istemci
                   gezinmesi ve scroll={false} korunuyor. */
                <Link
                  key={g.key}
                  href={hrefFor(active ? null : g.key)}
                  scroll={false}
                  className={styles.group}
                  data-active={active || undefined}
                  role="listitem"
                  aria-label={ariaOf(g)}
                >
                  {shapes}
                </Link>
              );
            })}
          </svg>
          {/* Yüzdeler HTML'de: gerilen SVG'de yazı da gerilirdi. */}
          {geo.map((g) =>
            g.countShare >= LABEL_MIN ? (
              <span key={`c-${g.key}`} aria-hidden className={`numeral ${labelClass(g.countShare)}`} style={{ left: `${((g.cx + 8) / W) * 100}%`, top: 0 }}>
                {pct(g.countShare)}
              </span>
            ) : null,
          )}
          {geo.map((g) =>
            g.valueShare >= LABEL_MIN ? (
              <span
                key={`v-${g.key}`}
                aria-hidden
                className={`numeral ${labelClass(g.valueShare)} ${styles.pctValue}`}
                data-active={g.key === activeKey || undefined}
                style={{ left: `${((g.vx + 8) / W) * 100}%`, top: BAR_H + RIBBON_H }}
              >
                {pct(g.valueShare)}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* Ölçü ızgarası — grup adı ve iki pay (şirket → değer). Şeritle aynı
          sıra; kalan dilim en sonda, bağlantısız. */}
      <ol className={styles.legend}>
        {geo.map((g) => {
          const shares = (
            <span className={`numeral ${styles.legendShares}`}>
              {pct(g.countShare)}
              <span aria-hidden> → </span>
              <b>{pct(g.valueShare)}</b>
            </span>
          );
          return (
            <li key={g.key}>
              {g.key === REST_SLICE ? (
                <span className={`${styles.legendRow} ${styles.legendRest}`}>
                  <span className={styles.legendName}>{labelOf(g.key)}</span>
                  {shares}
                </span>
              ) : (
                <Link
                  href={hrefFor(g.key === activeKey ? null : g.key)}
                  scroll={false}
                  className={`${styles.legendRow} ${styles.legendLink}`}
                  data-active={g.key === activeKey || undefined}
                >
                  <span className={styles.legendName}>{labelOf(g.key)}</span>
                  {shares}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <p className={styles.note}>{D.distNote}</p>
    </div>
  );
}
