import { ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import visuals from "@/components/motion/DirectoryVisuals.module.css";
import { LogoTile } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, verdictTextClass, type VerdictKey } from "@/lib/analysis";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import { stanceChangeLabel, technicalHref } from "@/lib/technical";
import type { TechnicalBoardEntry } from "@/lib/technical-data";
import { cn } from "@/lib/utils";
import { changeToneClass } from "./TechnicalCard";
import styles from "./Technical.module.css";

const VERDICTS: readonly VerdictKey[] = ["buy", "hold", "sell"];

/** Görüş süzgecinin radyo kimliği — başlıktaki satırlar `for` ile ona bağlanır. */
export function stanceFilterId(verdict: VerdictKey | "all"): string {
  return `technical-filter-${verdict}`;
}

/**
 * Başlığın görseli — on iki hissenin görüşe göre dağılımı.
 *
 * Sayılar tek yerde: oran çubuğunda yazı yok, sayı satırın başında bir kez.
 * Eski yayın şeridinde "AL 5 · TUT 5 · SAT 2" hapları vardı ve hangi hissenin
 * hangi grupta olduğunu söylemiyordu; burada her satır o görüşteki hisselerin
 * logolarını taşıyor ve logo hissenin analizine götürüyor.
 *
 * Satırın görüş etiketi aşağıdaki süzgecin radyosuna bağlı bir `<label>`:
 * basınca liste o görüşe süzülüyor, JavaScript gerekmiyor.
 */
export function TechnicalPulse({
  board,
  meta,
  t,
  variant = "directory",
}: {
  board: readonly TechnicalBoardEntry[];
  meta: Record<string, SymbolMeta>;
  t: Dictionary;
  /** `directory`: liste sayfasının başlık görseli — kendi başlığı var ve
      görüş etiketi süzgecin radyosuna bağlı. `panel`: ana sayfa paneli —
      başlığı panelin kendisi taşıyor, süzgeç yok, etiket düz metin. */
  variant?: "directory" | "panel";
}) {
  const filterable = variant === "directory";
  const groups = VERDICTS.map((verdict) => ({
    verdict,
    rows: board.filter(({ row }) => verdictOf(row.stance) === verdict),
  }));
  const changes = board.flatMap(({ row, previousStance }) => {
    const verdict = verdictOf(row.stance);
    const label = stanceChangeLabel(verdict, previousStance, t);
    return label ? [{ symbol: row.symbol, verdict, label }] : [];
  });

  return (
    <section
      className={styles.pulse}
      aria-labelledby={filterable ? "technical-distribution" : undefined}
      aria-label={filterable ? undefined : t.technical.distribution}
    >
      {filterable && (
        <div className={visuals.visualHeader}>
          <h2 id="technical-distribution">{t.technical.distribution}</h2>
          <span className="flex items-center gap-2 text-tiny font-semibold text-muted">
            {t.technical.stockCount.replace("{n}", String(board.length))}
            <ChartLineUp size={17} aria-hidden />
          </span>
        </div>
      )}

      {/* HAREKET VERİYİ ÇİZİYOR, SÜSLEMİYOR. Dilimler soldan kendi oranlarına
          uzuyor, satırlar ve logolar sırayla iniyor; ortak hareket sisteminin
          (`MotionExperience`) kancaları, azaltılmış harekette hepsi yerinde. */}
      <div className={styles.pulseBar} aria-hidden data-motion-stagger>
        {groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <span key={group.verdict} data-verdict={group.verdict} data-motion-draw="line" style={{ flexGrow: group.rows.length }} />
          ))}
      </div>

      <div className={styles.pulseRows} data-motion-stagger>
        {groups
          .filter((group) => group.rows.length > 0)
          .map((group) => (
            <div key={group.verdict} className={styles.pulseRow}>
              {filterable ? (
                <label htmlFor={stanceFilterId(group.verdict)} className={cn(styles.pulseStance, verdictTextClass(group.verdict))}>
                  {verdictLabel(group.verdict, t)}
                  <b>{group.rows.length}</b>
                </label>
              ) : (
                <span className={cn(styles.pulseStance, styles.pulseStanceStatic, verdictTextClass(group.verdict))}>
                  {verdictLabel(group.verdict, t)}
                  <b>{group.rows.length}</b>
                </span>
              )}
              <div className={styles.pulseLogos} data-motion-stagger>
                {group.rows.map(({ row }) => (
                  <Link
                    key={row.symbol}
                    href={technicalHref(row.symbol)}
                    prefetch={false}
                    className={styles.pulseLogo}
                    title={`${row.symbol} · ${meta[row.symbol]?.name ?? row.symbol}`}
                  >
                    <LogoTile symbol={row.symbol} logoUrl={meta[row.symbol]?.logoUrl ?? null} size="sm" />
                    <span className="sr-only">{row.symbol}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
      </div>

      {changes.length > 0 && (
        <div className={styles.pulseChanges}>
          <span>{t.technical.changesLabel}</span>
          {changes.map((change) => (
            <Link key={change.symbol} href={technicalHref(change.symbol)} prefetch={false} className={styles.pulseChange}>
              <LogoTile symbol={change.symbol} logoUrl={meta[change.symbol]?.logoUrl ?? null} size="xs" />
              {change.symbol}
              <span className={changeToneClass(change.verdict)}>{change.label}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
