import type { CSSProperties } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import type { FundDetail as FundDetailData } from "@/lib/investor-data";
import type { HoldingRecord, Move, PositionView, SoldView } from "@/lib/investor-view";
import type { Investor } from "@/lib/investors";
import { secFilingUrl } from "@/lib/providers/sec-13f";
import { cn, formatEtDateMedium, formatMoneyCompact, formatPercent } from "@/lib/utils";
import { asOfLabel, formatShares, formatWeight, moveLabel, moveTone, quarterLabel } from "./format";
import { InvestorTreemap, MAP_MAX, type MapPosition } from "./InvestorTreemap";
import styles from "./Investors.module.css";

/**
 * 13F yatırımcısının detay gövdesi — kapağın altındaki her şey, ekran
 * düzeni sırasıyla (CLAUDE.md): künye şeridi → ana görsel (harita) →
 * hareketler → tam tablo ve opsiyonlar → geçmiş. Künyeler ve uyarı
 * sayfanın kendisinde.
 */

/** Hareket sütununda grup başına görünen satır. */
const GROUP_ROWS = 7;
/** Tabloda açık gelen satır; kalanı açılır bölümde. */
const TABLE_ROWS = 25;

type Labels = Dictionary["investors"];

export function FundStrip({
  detail,
  locale,
  t,
}: {
  detail: FundDetailData;
  locale: string;
  t: Labels;
}) {
  return (
    <dl className={styles.strip}>
      <div>
        <dt>{t.periodLabel}</dt>
        <dd className="numeral">{quarterLabel(detail.period, t)}</dd>
        <small>{asOfLabel(detail.period, locale, t)}</small>
      </div>
      <div>
        <dt>{t.stripFiled}</dt>
        <dd className="numeral">{formatEtDateMedium(detail.filedAt, locale)}</dd>
      </div>
      <div>
        <dt>{t.positionsLabel}</dt>
        <dd className="numeral">{detail.diff.positions.length}</dd>
      </div>
      {detail.diff.optionValue > 0 && (
        <div>
          <dt>{t.stripOptions}</dt>
          <dd className="numeral">{formatMoneyCompact(detail.diff.optionValue, locale)}</dd>
        </div>
      )}
      <div>
        <dt>{t.stripSource}</dt>
        <dd>
          <a
            href={secFilingUrl(detail.cik, detail.accession)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.stripLink}
          >
            {t.sourceSec}
            <ArrowSquareOut size={13} weight="bold" aria-hidden />
          </a>
        </dd>
      </div>
    </dl>
  );
}

export function FundBody({
  detail,
  investor,
  known,
  locale,
  t,
}: {
  detail: FundDetailData;
  investor: Investor;
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Labels;
}) {
  const tickerOf = (cusip: string) => detail.tickers[cusip] ?? null;
  const decorate = (position: PositionView): MapPosition => {
    const ticker = tickerOf(position.cusip);
    const meta = ticker ? known[ticker] : undefined;
    /* Sembolü bilinmeyen pozisyonda sınıf da yazılıyor: Burry'nin "BRUKER
       CORP" yeni satırı imtiyazlı hisse (6.375 PREF SER A), satılan BRKR
       adi hisse — adları aynı, menkul kıymetleri farklı. */
    /* Bilinen sembolde ad kendi tablomuzdan: SEC'in adı büyük harfli ve
       kısaltılmış ("BANK OF AMER CORP"), dizindeki hareket panosu ise
       aynı şirketi "Bank of America Corp" diye yazıyordu. */
    const issuer = meta?.name ?? (ticker ? position.issuer : [position.issuer, position.titleOfClass].filter(Boolean).join(" · "));
    return { ...position, issuer, ticker, linkable: Boolean(meta), logoUrl: meta?.logoUrl ?? null };
  };
  const positions = detail.diff.positions.map(decorate);
  const closed = investor.status === "closed";

  return (
    <>
      <Panel className={styles.mapPanel}>
        <PanelHeader title={t.mapTitle} action={<MoveLegend t={t} />} />
        <div className={styles.mapBody}>
          <p className={styles.mapHint}>
            {closed ? t.mapHintClosed : t.mapHint}
            {positions.length > MAP_MAX ? ` ${t.mapTop.replace("{count}", String(MAP_MAX))}` : ""}
          </p>
          <InvestorTreemap positions={positions} locale={locale} t={t} />
        </div>
      </Panel>

      <MovesPanel detail={detail} positions={positions} known={known} closed={closed} locale={locale} t={t} />

      <PositionsTable positions={positions} compared={detail.diff.compared} locale={locale} t={t} />

      {detail.diff.options.length > 0 && (
        <OptionsTable options={detail.diff.options} tickerOf={tickerOf} known={known} locale={locale} t={t} />
      )}

      {detail.history.length > 1 && <HistoryPanel history={detail.history} locale={locale} t={t} />}
    </>
  );
}

function MoveLegend({ t }: { t: Labels }) {
  const steps = [
    { label: t.moveNew, tone: "up", level: 4 },
    { label: t.moveIncreased, tone: "up", level: 2 },
    { label: t.moveUnchanged, tone: "flat", level: 0 },
    { label: t.moveDecreased, tone: "down", level: 2 },
  ] as const;
  return (
    <ul className={styles.legend}>
      {steps.map((step) => (
        <li key={step.label}>
          <i className={styles.legendSwatch} data-tone={step.tone} data-level={step.level} aria-hidden />
          {step.label}
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------------------
   Bu çeyrek ne yaptı
   -------------------------------------------------------------------------- */

type GroupItem = {
  cusip: string;
  ticker: string | null;
  issuer: string;
  value: number;
  changePct: number | null;
  linkable: boolean;
  logoUrl: string | null;
};

function MovesPanel({
  detail,
  positions,
  known,
  closed,
  locale,
  t,
}: {
  detail: FundDetailData;
  positions: MapPosition[];
  known: Record<string, SymbolMeta>;
  closed: boolean;
  locale: string;
  t: Labels;
}) {
  const pick = (move: Move) =>
    positions
      .filter((position) => position.move === move)
      .sort((a, b) => (move === "new" ? b.value - a.value : Math.abs(b.changePct ?? 0) * b.value - Math.abs(a.changePct ?? 0) * a.value))
      .map<GroupItem>((position) => ({
        cusip: position.cusip,
        ticker: position.ticker,
        issuer: position.issuer,
        value: position.value,
        changePct: position.changePct,
        linkable: position.linkable,
        logoUrl: position.logoUrl,
      }));
  const soldItems = detail.diff.sold.map<GroupItem>((sold: SoldView) => {
    const ticker = detail.tickers[sold.cusip] ?? null;
    const meta = ticker ? known[ticker] : undefined;
    return {
      cusip: sold.cusip,
      ticker,
      issuer: meta?.name ?? sold.issuer,
      value: sold.prevValue,
      changePct: -100,
      linkable: Boolean(meta),
      logoUrl: meta?.logoUrl ?? null,
    };
  });
  const groups = [
    { key: "new", title: t.moveNew, tone: "up", items: pick("new") },
    { key: "increased", title: t.moveIncreased, tone: "up", items: pick("increased") },
    { key: "decreased", title: t.moveDecreased, tone: "down", items: pick("decreased") },
    { key: "soldOut", title: t.moveSoldOut, tone: "down", items: soldItems },
  ] as const;

  return (
    <Panel>
      <PanelHeader
        title={closed ? t.lastQuarterTitle : t.didTitle}
        meta={
          detail.previousPeriod
            ? t.didMeta
                .replace("{prev}", quarterLabel(detail.previousPeriod, t))
                .replace("{cur}", quarterLabel(detail.period, t))
            : undefined
        }
      />
      {detail.diff.compared ? (
        <div className={styles.moves}>
          {groups.map((group) => (
            <section key={group.key} className={styles.moveGroup} data-tone={group.tone}>
              <h3 className={styles.moveGroupTitle}>
                <span>{group.title}</span>
                <b className="numeral">{group.items.length}</b>
              </h3>
              {group.items.length === 0 ? (
                <p className={styles.moveEmpty}>{t.didEmpty}</p>
              ) : (
                <ol className={styles.moveList} data-motion-stagger>
                  {group.items.slice(0, GROUP_ROWS).map((item) => {
                    const body = (
                      <>
                        {item.ticker ? (
                          <LogoTile symbol={item.ticker} logoUrl={item.logoUrl} size="sm" />
                        ) : (
                          <span className={styles.noLogo} aria-hidden />
                        )}
                        <span className={styles.moveId}>
                          <b className="numeral">{item.ticker ?? item.issuer}</b>
                          <small>{item.issuer}</small>
                        </span>
                        <span className={styles.moveFigures}>
                          {group.key !== "new" && group.key !== "soldOut" && item.changePct !== null && (
                            <b className="numeral">{formatPercent(item.changePct, locale, 0)}</b>
                          )}
                          <small className="numeral">{formatMoneyCompact(item.value, locale)}</small>
                        </span>
                      </>
                    );
                    return (
                      <li key={item.cusip} className="min-w-0">
                        {item.linkable && item.ticker ? (
                          <Link href={`/hisse/${item.ticker}`} prefetch={false} className={styles.moveRow}>
                            {body}
                          </Link>
                        ) : (
                          <div className={styles.moveRow}>{body}</div>
                        )}
                      </li>
                    );
                  })}
                  {group.items.length > GROUP_ROWS && (
                    <li className={styles.moveMore}>{t.more.replace("{count}", String(group.items.length - GROUP_ROWS))}</li>
                  )}
                </ol>
              )}
            </section>
          ))}
        </div>
      ) : (
        <p className="border-t border-line px-4 py-4 text-small text-muted sm:px-5">{t.didFirst}</p>
      )}
    </Panel>
  );
}

/* --------------------------------------------------------------------------
   Tam tablo
   -------------------------------------------------------------------------- */

function PositionsTable({
  positions,
  compared,
  locale,
  t,
}: {
  positions: MapPosition[];
  compared: boolean;
  locale: string;
  t: Labels;
}) {
  const peak = Math.max(...positions.map((position) => position.weight), 0.0001);
  const head = (
    <thead>
      <tr>
        <th scope="col" className={styles.colRank}>
          <span className="sr-only">{t.colRank}</span>
        </th>
        <th scope="col">{t.colCompany}</th>
        <th scope="col" className={styles.num}>{t.colShares}</th>
        <th scope="col" className={styles.num}>{t.colValue}</th>
        <th scope="col" className={styles.colWeight}>{t.colWeight}</th>
        {compared && <th scope="col" className={styles.num}>{t.colChange}</th>}
      </tr>
    </thead>
  );
  const row = (position: MapPosition, index: number) => (
    <tr key={position.cusip}>
      <td className={cn("numeral", styles.colRank)}>{index + 1}</td>
      <th scope="row" className={styles.companyCell}>
        {position.linkable && position.ticker ? (
          <Link href={`/hisse/${position.ticker}`} prefetch={false} className={styles.company}>
            <CompanyInner position={position} />
          </Link>
        ) : (
          <span className={styles.company}>
            <CompanyInner position={position} />
          </span>
        )}
      </th>
      <td className={cn("numeral", styles.num)}>
        {formatShares(position.amount, locale)}
        {position.amountType === "PRN" && <small className={styles.cellNote}>{t.principal}</small>}
      </td>
      <td className={cn("numeral", styles.num)}>{formatMoneyCompact(position.value, locale)}</td>
      <td className={styles.colWeight}>
        <span className={styles.weightCell}>
          <span className="numeral">{formatWeight(position.weight, locale)}</span>
          <span className={styles.weightTrack} aria-hidden>
            <i style={{ width: `${(position.weight / peak) * 100}%` }} />
          </span>
        </span>
      </td>
      {compared && (
        <td className={styles.num}>
          <span className={styles.moveChip} data-tone={moveTone(position.move)}>
            {moveLabel(position.move, t)}
            {position.changePct !== null && position.move !== "unchanged" && (
              <b className="numeral">{formatPercent(position.changePct, locale, 0)}</b>
            )}
          </span>
          {position.split && (
            <small className={styles.cellNote}>{t.splitNote.replace("{ratio}", String(position.split))}</small>
          )}
        </td>
      )}
    </tr>
  );
  const first = positions.slice(0, TABLE_ROWS);
  const rest = positions.slice(TABLE_ROWS);
  return (
    <Panel className={styles.tablePanel}>
      <PanelHeader title={t.tableTitle} meta={t.positions.replace("{count}", String(positions.length))} />
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          {head}
          <tbody>{first.map(row)}</tbody>
        </table>
      </div>
      {rest.length > 0 && (
        <details className={styles.tableMore}>
          <summary>{t.tableRest.replace("{count}", String(rest.length))}</summary>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              {head}
              <tbody>{rest.map((position, index) => row(position, index + TABLE_ROWS))}</tbody>
            </table>
          </div>
        </details>
      )}
    </Panel>
  );
}

function CompanyInner({ position }: { position: { ticker: string | null; logoUrl: string | null; issuer: string } }) {
  return (
    <>
      {position.ticker ? (
        <LogoTile symbol={position.ticker} logoUrl={position.logoUrl} size="sm" />
      ) : (
        <span className={styles.noLogo} aria-hidden />
      )}
      <span className={styles.companyText}>
        <b className="numeral">{position.ticker ?? position.issuer}</b>
        <small>{position.issuer}</small>
      </span>
    </>
  );
}

function OptionsTable({
  options,
  tickerOf,
  known,
  locale,
  t,
}: {
  options: HoldingRecord[];
  tickerOf: (cusip: string) => string | null;
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Labels;
}) {
  return (
    <Panel className={styles.tablePanel}>
      <PanelHeader title={t.optionsTitle} />
      <p className="border-t border-line px-4 py-3 text-small text-body sm:px-5">{t.optionsNote}</p>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t.colCompany}</th>
              <th scope="col">{t.colType}</th>
              <th scope="col" className={styles.num}>{t.colShares}</th>
              <th scope="col" className={styles.num}>{t.colUnderlying}</th>
            </tr>
          </thead>
          <tbody>
            {options.map((option) => {
              const ticker = tickerOf(option.cusip);
              const meta = ticker ? known[ticker] : undefined;
              const position = { ticker, logoUrl: meta?.logoUrl ?? null, issuer: meta?.name ?? option.issuer };
              return (
                <tr key={`${option.cusip}-${option.position}`}>
                  <th scope="row" className={styles.companyCell}>
                    {meta && ticker ? (
                      <Link href={`/hisse/${ticker}`} prefetch={false} className={styles.company}>
                        <CompanyInner position={position} />
                      </Link>
                    ) : (
                      <span className={styles.company}>
                        <CompanyInner position={position} />
                      </span>
                    )}
                  </th>
                  <td>
                    <span className={styles.moveChip} data-tone={option.position === "call" ? "up" : "down"}>
                      {option.position === "call" ? t.optionCall : t.optionPut}
                    </span>
                  </td>
                  <td className={cn("numeral", styles.num)}>{formatShares(option.amount, locale)}</td>
                  <td className={cn("numeral", styles.num)}>{formatMoneyCompact(option.value, locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------------------------
   Geçmiş
   -------------------------------------------------------------------------- */

function HistoryPanel({
  history,
  locale,
  t,
}: {
  history: FundDetailData["history"];
  locale: string;
  t: Labels;
}) {
  const peak = Math.max(...history.map((point) => point.longValue), 1);
  return (
    <Panel>
      <PanelHeader title={t.historyTitle} />
      <div className={styles.history}>
        <ol className={styles.historyBars} style={{ "--count": history.length } as CSSProperties}>
          {history.map((point, index) => (
            <li key={point.period} data-current={index === history.length - 1 || undefined}>
              <span className={cn("numeral", styles.historyValue)}>{formatMoneyCompact(point.longValue, locale)}</span>
              <span className={styles.historyTrack}>
                <i data-motion-draw="bar" style={{ height: `${Math.max(2, (point.longValue / peak) * 100)}%` }} />
              </span>
              <span className={cn("numeral", styles.historyLabel)}>{quarterLabel(point.period, t)}</span>
              <small className="numeral">{t.positions.replace("{count}", String(point.positionCount))}</small>
            </li>
          ))}
        </ol>
        <p className={styles.historyNote}>{t.historyNote}</p>
      </div>
    </Panel>
  );
}
