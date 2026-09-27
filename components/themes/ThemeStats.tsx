import { Panel, PanelHeader } from "@/components/ui/primitives";
import { median, type MoveSet } from "@/lib/theme-stats";
import { cn, directionOf, directionText, formatPercent, NO_VALUE } from "@/lib/utils";

/**
 * Temanın künye şeridi: kaç şirket, günün medyanı, kaç yükselen/düşen.
 *
 * MEDYAN, ORTALAMA DEĞİL. Sepette tek bir şirketin %20'lik bilanço günü
 * ortalamayı sürükleyip "tema bugün %2 yükseldi" dedirtir; medyan tipik
 * üyenin gününü söylüyor. Yükselen/düşen sayısı da aynı kümeden (aynı
 * seansı anlatan yüzdeler — `sameSessionMoves`), yani iki sayı birbirini
 * tutuyor.
 */
export function ThemeStats({
  count,
  moves,
  locale,
  labels,
}: {
  count: number;
  moves: MoveSet | null;
  locale: string;
  labels: {
    title: string;
    companies: string;
    median: string;
    medianSession: string;
    medianLastClose: string;
    medianMissing: string;
    breadth: string;
  };
}) {
  const mid = moves ? median(moves.values) : null;
  const up = moves ? moves.values.filter((value) => value > 0).length : null;
  const down = moves ? moves.values.filter((value) => value < 0).length : null;
  const [countNumber, countUnit] = splitCount(labels.companies, count);

  return (
    <Panel>
      {/* Plaka başlık: şerit okunacak değil BAKILACAK bir panel (bkz.
          `PanelHeader` künyesi) ama her panelin bir h2'si var. */}
      <PanelHeader title={labels.title} tone="plate" />
      <div className="grid grid-cols-2 border-t border-line sm:grid-cols-3">
      <div className="px-4 py-3.5 sm:px-5">
        <p className="plate text-nano">{countUnit}</p>
        <p className="numeral mt-1 text-title font-bold text-strong">{countNumber}</p>
      </div>
      <div className="border-l border-line-soft px-4 py-3.5 sm:px-5">
        <p className="plate text-nano">{labels.median}</p>
        <p
          className={cn(
            "numeral mt-1 text-title font-bold",
            mid === null
              ? "text-muted"
              : moves?.basis === "lastClose"
                ? "text-body"
                : directionText(directionOf(mid)),
          )}
        >
          {mid === null ? NO_VALUE : formatPercent(mid, locale)}
        </p>
        <p className="mt-0.5 text-tiny text-muted">
          {moves === null
            ? null
            : moves.basis === "session"
              ? labels.medianSession
              : labels.medianLastClose}
        </p>
      </div>
      <div className="col-span-2 border-t border-line-soft px-4 py-3.5 sm:col-span-1 sm:border-l sm:border-t-0 sm:px-5">
        <p className="plate text-nano">{labels.breadth}</p>
        <p className="numeral mt-1 text-title font-bold text-strong">
          {up === null ? (
            NO_VALUE
          ) : (
            <>
              <span className="text-up">{up}</span>
              <span className="px-1.5 text-muted">/</span>
              <span className="text-down">{down}</span>
            </>
          )}
        </p>
      </div>
      {moves === null && (
        <p className="col-span-2 border-t border-line px-4 py-3 text-small text-muted sm:col-span-3 sm:px-5">
          {labels.medianMissing}
        </p>
      )}
      </div>
    </Panel>
  );
}

/**
 * "{count} Şirket" kalıbını sayı ve birim olarak ayırır — sayı büyük
 * puntoda, birim künyede. Yer tutucu sözlükte kaldığı için sözcük sırası
 * dile ait kalıyor; ayrım yalnızca çizim için.
 */
function splitCount(template: string, count: number): [string, string] {
  const unit = template.replace("{count}", "").trim();
  return [String(count), unit];
}
