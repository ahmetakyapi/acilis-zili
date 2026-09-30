import type { Dictionary } from "@/lib/i18n";
import type { FlowMember, FlowSurprise } from "@/lib/day-flow";
import styles from "./FlowFigures.module.css";

type Labels = Dictionary["dayFlow"];

/**
 * BİLANÇO SATIRININ ÖLÇÜLERİ — gelir ve hisse başına kâr, beklenti ile
 * açıklanan yan yana (1 Ekim, sahibinin isteği: "gelir beklentisi,
 * açıklanan, hisse başı kâr beklenti ve açıklanan").
 *
 * Satır eskiden yalnızca açıklanan EPS'yi yazıyordu: açıklanmadan önce
 * sağda hiçbir şey yoktu, açıklandıktan sonra "33,42 $" neyle
 * kıyaslanacağını söylemiyordu ve veritabanında duran gelir hiç
 * basılmıyordu. Şimdi her ölçü üç kat:
 *
 *   ad        Gelir            ·  açıklanmadıysa "Gelir Beklentisi"
 *   değer     54,2 Mr $ +%3,8  ·  açıklanmadıysa yalnızca beklenti
 *   künye     Beklenti 52,2 Mr $ (yalnızca açıklandıysa)
 *
 * İki sütunun katları AYNI HATTA biter (`subgrid`, CLAUDE.md "ölçü
 * ızgarası"): EPS açıklanıp gelir henüz gelmediğinde bir sütunun künyesi
 * olmuyor ve iki sayı yine aynı satırda duruyor. Değeri olmayan ölçü hiç
 * basılmıyor — tire bir sütun açıp "veri yok" demekten başka bir şey
 * söylemiyordu.
 *
 * Sürprizin rengi YALNIZCA yönden (`--up`/`--down`); beklentiye eşitse
 * nötr. Beklenti bir sentin altındaysa yüzde yok, yön kelimeyle yazılıyor
 * (gerekçe `epsSurprise`).
 */
export function FlowFigures({ member, labels, variant = "row" }: { member: FlowMember; labels: Labels; variant?: "row" | "detail" }) {
  const figures = [
    { key: "revenue", name: labels.revenue, estimateName: labels.revenueEstimate, actual: member.revenue, estimate: member.revenueEstimate, surprise: member.revenueSurprise },
    { key: "eps", name: labels.eps, estimateName: labels.epsEstimate, actual: member.eps, estimate: member.epsEstimate, surprise: member.epsSurprise },
  ].filter((figure) => figure.actual || figure.estimate);
  if (!figures.length) return null;
  return (
    <dl className={styles.figures} data-variant={variant}>
      {figures.map((figure) => (
        <div key={figure.key} className={styles.figure} data-fig data-released={figure.actual ? true : undefined}>
          <dt>{figure.actual ? figure.name : figure.estimateName}</dt>
          <dd className={styles.value} data-fig-value>
            <b className="numeral">{figure.actual ?? figure.estimate}</b>
            {figure.actual && figure.surprise && <Surprise surprise={figure.surprise} labels={labels} />}
          </dd>
          {figure.actual && figure.estimate && (
            <dd className={styles.foot} data-fig-foot>
              {labels.forecast} <span className="numeral">{figure.estimate}</span>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function Surprise({ surprise, labels }: { surprise: FlowSurprise; labels: Labels }) {
  return (
    <span className={`numeral ${styles.surprise}`} data-dir={surprise.direction}>
      {surprise.pct ? (
        <>
          {surprise.pct}
          <span className="sr-only"> {labels.surprise} · {labels[surprise.direction]}</span>
        </>
      ) : labels[surprise.direction]}
    </span>
  );
}
