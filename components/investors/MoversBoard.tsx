import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import type { Overview } from "@/lib/investor-data";
import type { CrowdEntry } from "@/lib/investor-view";
import { investorBySlug } from "@/lib/investors";
import { cn } from "@/lib/utils";
import { quarterLabel } from "./format";
import { Portrait } from "./Portrait";
import styles from "./Investors.module.css";

/**
 * "Bu Çeyreğin Hareketleri" — aynı hisseye aynı yönde giden yatırımcılar.
 *
 * İki sütun, iki yön: solda en çok alınanlar (yeni açan + artıran), sağda
 * en çok satılanlar (tamamen satan + azaltan). Her satırda kaç yatırımcının
 * ne yaptığı SAYI olarak, kimlerin yaptığı PORTRE olarak ve sayının
 * büyüklüğü bir ÇİZGİ olarak (CLAUDE.md: karşılaştırılan her büyüklük bir
 * de çizgi olarak okunur). Çizginin ölçeği iki sütunda ORTAK: soldaki 5
 * ile sağdaki 5 aynı uzunlukta.
 */
const PORTRAIT_STACK = 5;

export function MoversBoard({
  movers,
  known,
  locale,
  t,
}: {
  movers: Overview["movers"];
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Dictionary["investors"];
}) {
  const peak = Math.max(
    1,
    ...movers.buys.map((entry) => entry.opened.length + entry.added.length),
    ...movers.sells.map((entry) => entry.exited.length + entry.trimmed.length),
  );
  const empty = movers.buys.length === 0 && movers.sells.length === 0;

  return (
    <Panel className={styles.moversPanel}>
      <PanelHeader
        title={t.moversTitle}
        meta={
          movers.period
            ? t.moversMeta
                .replace("{period}", quarterLabel(movers.period, t))
                .replace("{count}", String(movers.investors))
            : undefined
        }
      />
      {empty ? (
        <p className="border-t border-line px-4 py-4 text-small text-muted sm:px-5">{t.moversEmpty}</p>
      ) : (
        <div className={styles.movers}>
          <MoverColumn
            title={t.buysTitle}
            tone="up"
            entries={movers.buys}
            parts={(entry) => [
              { count: entry.opened.length, label: t.opened, strong: true },
              { count: entry.added.length, label: t.added, strong: false },
            ]}
            who={(entry) => [...entry.opened, ...entry.added]}
            peak={peak}
            known={known}
            locale={locale}
          />
          <MoverColumn
            title={t.sellsTitle}
            tone="down"
            entries={movers.sells}
            parts={(entry) => [
              { count: entry.exited.length, label: t.exited, strong: true },
              { count: entry.trimmed.length, label: t.trimmed, strong: false },
            ]}
            who={(entry) => [...entry.exited, ...entry.trimmed]}
            peak={peak}
            known={known}
            locale={locale}
          />
        </div>
      )}
      <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">{t.moversNote}</p>
    </Panel>
  );
}

function MoverColumn({
  title,
  tone,
  entries,
  parts,
  who,
  peak,
  known,
}: {
  title: string;
  tone: "up" | "down";
  entries: CrowdEntry[];
  parts: (entry: CrowdEntry) => { count: number; label: string; strong: boolean }[];
  who: (entry: CrowdEntry) => string[];
  peak: number;
  known: Record<string, SymbolMeta>;
  locale: string;
}) {
  return (
    <section className={styles.moverColumn} data-tone={tone}>
      <h3 className={styles.moverTitle}>{title}</h3>
      <ol className={styles.moverList} data-motion-stagger>
        {entries.map((entry) => {
          const meta = entry.ticker ? known[entry.ticker] : undefined;
          const total = parts(entry).reduce((sum, part) => sum + part.count, 0);
          const slugs = who(entry);
          const body = (
            <>
              {entry.ticker ? (
                <LogoTile symbol={entry.ticker} logoUrl={meta?.logoUrl} size="md" />
              ) : (
                <span className={styles.noLogo} aria-hidden />
              )}
              <span className={styles.moverId}>
                <b className="numeral">{entry.ticker ?? entry.issuer}</b>
                <small>{meta?.name ?? entry.issuer}</small>
              </span>
              <span className={styles.moverFaces} aria-hidden>
                {/* "+1" YERİNE PORTRE (28 Eylül): tek bir yatırımcı artıyorsa
                    çip onun portresine dönüşüyor. Portre 24 piksel ve
                    öncekinin üstüne 5 piksel biniyor (19 piksel), "+1"
                    çipi 6 piksel boşluk + ~12 piksel metin — sütun
                    büyümüyor. */}
                {slugs.slice(0, slugs.length === PORTRAIT_STACK + 1 ? PORTRAIT_STACK + 1 : PORTRAIT_STACK).map((slug) => {
                  const investor = investorBySlug(slug);
                  return investor ? <Portrait key={slug} investor={investor} size="chip" /> : null;
                })}
                {slugs.length > PORTRAIT_STACK + 1 && <span className={styles.moverMore}>+{slugs.length - PORTRAIT_STACK}</span>}
              </span>
              <span className={styles.moverCounts}>
                {parts(entry)
                  .filter((part) => part.count > 0)
                  .map((part) => (
                    <span key={part.label} className={cn(styles.moverChip, part.strong && styles.moverChipStrong)}>
                      {part.label.replace("{count}", String(part.count))}
                    </span>
                  ))}
              </span>
              <span className={styles.moverTrack} aria-hidden>
                <i
                  className={styles.moverBar}
                  data-motion-draw="line"
                  style={{ width: `${(total / peak) * 100}%` }}
                />
              </span>
            </>
          );
          return (
            <li key={entry.key} className="min-w-0">
              {entry.ticker && meta ? (
                <Link href={`/hisse/${entry.ticker}`} prefetch={false} className={styles.moverRow} data-cc={entry.ticker}>
                  {body}
                </Link>
              ) : (
                <div className={styles.moverRow}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
