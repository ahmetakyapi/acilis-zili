"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowCounterClockwise, CaretDown, CheckCircle, LockSimple } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import { formatDecimalInput, isAmbiguous, parseDecimalInput } from "@/lib/decimal-input";
import { TCMB_MIN_DATE } from "@/lib/fx";
import {
  BLOCKING_FLAGS,
  importCsv,
  importPdfLines,
  mergeResults,
  type Broker,
  type ImportResult,
  type RowFlag,
  type SkippedLine,
} from "@/lib/tax-import";
import type { Locale } from "@/lib/i18n/config";
import { cn, isValidSymbol } from "@/lib/utils";
import { PdfPasswordError, pdfLines } from "./pdf-text";
import type { TaxLabels } from "./TaxCalculator";
import type { DividendRow, TradeRow } from "./tax-ui";
import styles from "./Tax.module.css";

/**
 * EKSTREDEN AKTARIM — okuma, önizleme ve onay.
 *
 * Bu modül (ayrıştırıcılarla birlikte) sayfanın ilk JS'inde DEĞİL:
 * hesaplayıcı onu okuyucu bir dosya seçtiğinde `next/dynamic` ile yüklüyor,
 * pdf.js'yi de PDF seçildiğinde `pdf-text.ts` çekiyor. Ölçüm TaxCalculator
 * başındaki notta.
 *
 * GİZLİLİK. Dosya `File` nesnesi olarak bellekte okunuyor; hiçbir `fetch`
 * yok, hiçbir depoya yazılmıyor. Önizleme kapanınca satırlar da gidiyor.
 *
 * ONAY ADIMI BİLİNÇLİ OLARAK ZORUNLU. Ayrıştırıcı ne kadar dikkatli olursa
 * olsun bir PDF'in metin katmanı sütun sınırını kaybedebiliyor; hesaplayıcıya
 * giden her satır okuyucunun gözünden geçiyor. Şüpheli satır (`BLOCKING_FLAGS`)
 * seçili gelmiyor; okuyucu hücreyi düzeltip kutuyu kendisi işaretliyor.
 */

type Phase =
  | { kind: "reading"; file: string; page: number; pages: number }
  | { kind: "password"; wrong: boolean }
  | { kind: "error"; message: string }
  | { kind: "review" };

type EditTrade = Omit<TradeRow, "id"> & { key: string; selected: boolean; fixed: RowFlag[]; source: string };
type EditDividend = {
  key: string;
  selected: boolean;
  symbol: string;
  date: string;
  gross: string;
  withheld: string;
  fixed: RowFlag[];
  source: string;
};

export type ImportPayload = {
  trades: Omit<TradeRow, "id">[];
  dividends: Omit<DividendRow, "id">[];
};

/** Tek dosyanın tavanı: aylık ekstre birkaç yüz KB, yıllık IBKR birkaç MB. */
const MAX_FILE_MB = 20;
const BYTES_PER_MB = 1024 * 1024;
/** Satır girişi kademesi: bundan sonrası aynı anda girer. */
const STAGGER_CAP = 14;
/** Aylık şeridin en fazla sütunu — iki yıldan uzun ekstrede ilk 24 ay. */
const MAX_MONTHS = 24;
const PERCENT = 100;
/** Stopaj oranında gösterilen ondalık. */
const PCT_DIGITS = 2;

/** Okunan satırlardan KALICI bayraklar: kaynağa dair, düzenleyince geçmeyen. */
const SOURCE_FLAGS: readonly RowFlag[] = ["currency", "amountMismatch", "unverified"];


export function StatementImport({
  files,
  labels,
  locale,
  today,
  onApply,
  onCancel,
  onPick,
}: {
  files: File[];
  labels: TaxLabels;
  locale: Locale;
  today: string;
  onApply: (payload: ImportPayload) => void;
  onCancel: () => void;
  /** "Başka Dosya": seçiciyi yeniden açar. */
  onPick: () => void;
}) {
  const L = labels.import;
  const reduced = useMotionPreference();
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "reading", file: files[0]?.name ?? "", page: 0, pages: 0 });
  const [broker, setBroker] = useState<Broker | null>(null);
  const [trades, setTrades] = useState<EditTrade[]>([]);
  const [dividends, setDividends] = useState<EditDividend[]>([]);
  const [skipped, setSkipped] = useState<SkippedLine[]>([]);
  const [hadPdfIbkr, setHadPdfIbkr] = useState(false);

  /* ---- Okuma ---- */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const results: ImportResult[] = [];
      let pdfIbkr = false;
      for (const file of files) {
        if (file.size > MAX_FILE_MB * BYTES_PER_MB) throw new ReadError(L.errorSize.replace("{mb}", String(MAX_FILE_MB)));
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        const isCsv = /csv|text\/plain/.test(file.type) || /\.(csv|txt)$/i.test(file.name);
        if (isCsv) {
          results.push(importCsv(await file.text()));
        } else if (isPdf) {
          const lines = await pdfLines(file, {
            password,
            onPage: (page, pages) => {
              if (!cancelled) setPhase({ kind: "reading", file: file.name, page, pages });
            },
          });
          if (lines.length === 0) throw new ReadError(L.errorBody);
          const result = importPdfLines(lines);
          if (result.broker === "ibkr") pdfIbkr = true;
          results.push(result);
        } else {
          throw new ReadError(L.errorType);
        }
      }
      return { merged: mergeResults(results), pdfIbkr };
    };
    run()
      .then(({ merged, pdfIbkr }) => {
        if (cancelled) return;
        setBroker(merged.broker);
        setHadPdfIbkr(pdfIbkr);
        setSkipped(merged.skipped);
        setTrades(
          merged.trades.map((t, i) => {
            const row: EditTrade = {
              key: `t${i}`,
              selected: false,
              side: t.side,
              symbol: t.symbol,
              date: t.date,
              /* Hücreler dilin ayracıyla: TR'de "1,845211", nokta binliktir
                 (lib/decimal-input.ts). */
              quantity: formatDecimalInput(t.quantity, locale),
              price: formatDecimalInput(t.priceUsd, locale, { money: true }),
              commission: t.commissionUsd === null ? "" : formatDecimalInput(t.commissionUsd, locale, { money: true }),
              fixed: t.flags.filter((f) => SOURCE_FLAGS.includes(f)),
              source: t.source,
            };
            /* Genel tanıyıcının satırları hiç seçili gelmez: sütun sırası
               bilinmeyen bir belgede okuma yalnızca bir öneri. */
            const blocked = merged.broker === null || tradeFlags(row, today).some((f) => BLOCKING_FLAGS.includes(f));
            return { ...row, selected: !blocked };
          }),
        );
        setDividends(
          merged.dividends.map((d, i) => {
            const row: EditDividend = {
              key: `d${i}`,
              selected: false,
              symbol: d.symbol,
              date: d.date,
              gross: formatDecimalInput(d.grossUsd, locale, { money: true }),
              withheld: d.withheldUsd === null ? "" : formatDecimalInput(d.withheldUsd, locale, { money: true }),
              fixed: d.flags.filter((f) => SOURCE_FLAGS.includes(f)),
              source: d.source,
            };
            const blocked = dividendFlags(row, today).some((f) => BLOCKING_FLAGS.includes(f));
            return { ...row, selected: !blocked };
          }),
        );
        setPhase({ kind: "review" });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof PdfPasswordError) {
          setPhase({ kind: "password", wrong: error.wrong });
          return;
        }
        setPhase({ kind: "error", message: error instanceof ReadError ? error.message : L.errorBody });
      });
    return () => {
      cancelled = true;
    };
  }, [files, password, today, L, locale]);

  const selectedTrades = trades.filter((t) => t.selected);
  const selectedDividends = dividends.filter((d) => d.selected);
  const selectedCount = selectedTrades.length + selectedDividends.length;

  const apply = () => {
    onApply({
      trades: selectedTrades.map((t) => ({
        side: t.side,
        symbol: t.symbol.trim().toUpperCase(),
        date: t.date,
        quantity: t.quantity,
        price: t.price,
        commission: t.commission,
      })),
      dividends: selectedDividends.map((d) => {
        const gross = parseDecimalInput(d.gross, locale);
        const withheld = parseDecimalInput(d.withheld, locale);
        const pct = gross && gross > 0 && withheld !== null ? (withheld / gross) * PERCENT : null;
        return {
          symbol: d.symbol.trim().toUpperCase(),
          date: d.date,
          gross: d.gross,
          withholding: pct === null ? "w8ben" : "statement",
          statementPct: pct === null ? null : Number(pct.toFixed(PCT_DIGITS)),
        };
      }),
    });
  };

  const brokerName = broker === "midas" ? L.brokerMidas : broker === "ibkr" ? L.brokerIbkr : L.brokerUnknown;
  const fade = reduced
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const },
      };

  return (
    <section className={styles.import} aria-labelledby="ekstre-baslik" aria-busy={phase.kind === "reading"}>
      <AnimatePresence mode="wait" initial={false}>
        {phase.kind === "reading" && (
          <motion.div key="reading" className={styles.importState} {...fade}>
            <h3 id="ekstre-baslik" className={styles.importTitle}>{L.reading}</h3>
            <div className={styles.progress} data-indeterminate={phase.pages === 0} aria-hidden>
              <span style={{ "--p": phase.pages ? phase.page / phase.pages : 0 } as React.CSSProperties} />
            </div>
            <p className={styles.importMeta} role="status">
              {phase.file}
              {phase.pages > 0 && ` · ${L.readingPage.replace("{page}", String(phase.page)).replace("{total}", String(phase.pages))}`}
            </p>
            <p className={styles.importBody}>{L.privacyBody}</p>
          </motion.div>
        )}

        {phase.kind === "password" && (
          <motion.form
            key="password"
            className={styles.importState}
            {...fade}
            onSubmit={(event) => {
              event.preventDefault();
              setPhase({ kind: "reading", file: files[0]?.name ?? "", page: 0, pages: 0 });
              setPassword(draft);
            }}
          >
            <h3 id="ekstre-baslik" className={styles.importTitle}>{L.passwordTitle}</h3>
            <p className={styles.importBody}>{L.passwordBody}</p>
            <label className={cn(styles.field, "max-w-80")}>
              <span className={styles.label}>{L.passwordLabel}</span>
              <input
                type="password"
                autoComplete="off"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-invalid={phase.wrong || undefined}
                className={styles.input}
                autoFocus
              />
              {phase.wrong && <span className={cn(styles.help, styles.warn)}>{L.passwordWrong}</span>}
            </label>
            <div className={styles.actions}>
              <button type="submit" className={buttonClass({ size: "sm" })} disabled={draft === ""}>
                {L.unlock}
              </button>
              <button type="button" onClick={onCancel} className={buttonClass({ variant: "ghost", size: "sm" })}>
                {L.cancel}
              </button>
            </div>
            <Privacy text={L.privacy} />
          </motion.form>
        )}

        {phase.kind === "error" && (
          <motion.div key="error" className={styles.importState} {...fade} role="alert">
            <h3 id="ekstre-baslik" className={styles.importTitle}>{L.errorTitle}</h3>
            <p className={styles.importBody}>{phase.message}</p>
            <div className={styles.actions}>
              <button type="button" onClick={onPick} className={buttonClass({ size: "sm" })}>
                <ArrowCounterClockwise size={14} weight="bold" aria-hidden />
                {L.another}
              </button>
              <button type="button" onClick={onCancel} className={buttonClass({ variant: "ghost", size: "sm" })}>
                {L.cancel}
              </button>
            </div>
          </motion.div>
        )}

        {phase.kind === "review" && trades.length + dividends.length === 0 && (
          <motion.div key="empty" className={styles.importState} {...fade}>
            <h3 id="ekstre-baslik" className={styles.importTitle}>{L.emptyTitle}</h3>
            <p className={styles.importBody}>{L.emptyBody}</p>
            <SkippedList labels={labels} skipped={skipped} />
            <div className={styles.actions}>
              <button type="button" onClick={onPick} className={buttonClass({ size: "sm" })}>
                <ArrowCounterClockwise size={14} weight="bold" aria-hidden />
                {L.another}
              </button>
              <button type="button" onClick={onCancel} className={buttonClass({ variant: "ghost", size: "sm" })}>
                {L.cancel}
              </button>
            </div>
          </motion.div>
        )}

        {phase.kind === "review" && trades.length + dividends.length > 0 && (
          <motion.div key="review" className={styles.review} {...fade}>
            <header className={styles.reviewHead}>
              <div className="min-w-0">
                <p className={styles.importMeta}>
                  <span className={styles.broker} data-known={broker !== null}>{brokerName}</span>
                  <span className="truncate">{files.map((f) => f.name).join(", ")}</span>
                </p>
                <h3 id="ekstre-baslik" className={styles.importTitle}>{L.reviewTitle}</h3>
                <p className={styles.importBody}>{L.reviewBody}</p>
              </div>
              <Tally
                items={[
                  { value: trades.length, label: L.tradesTitle },
                  { value: dividends.length, label: L.dividendsTitle },
                  { value: skipped.length, label: L.skippedTitle, muted: true },
                ]}
              />
            </header>

            {trades.length > 0 && <MonthStrip trades={trades} locale={locale} labels={labels} />}

            {broker === null && <p className={cn(styles.importBody, styles.warn)}>{L.unknownNote}</p>}
            {hadPdfIbkr && <p className={styles.importBody}>{L.ibkrTip}</p>}

            {trades.length > 0 && (
              <TradeTable labels={labels} locale={locale} rows={trades} today={today} setRows={setTrades} />
            )}
            {dividends.length > 0 && (
              <DividendTable labels={labels} locale={locale} rows={dividends} today={today} setRows={setDividends} />
            )}

            <FlagLegend
              labels={labels}
              flags={[
                ...trades.flatMap((t) => tradeFlags(t, today)),
                ...dividends.flatMap((d) => dividendFlags(d, today)),
              ]}
            />
            <SkippedList labels={labels} skipped={skipped} />

            <footer className={styles.reviewFoot}>
              <Privacy text={L.privacy} />
              <div className={styles.actions}>
                <button type="button" onClick={onCancel} className={buttonClass({ variant: "ghost", size: "sm" })}>
                  {L.cancel}
                </button>
                <button type="button" onClick={apply} disabled={selectedCount === 0} className={buttonClass({ size: "sm" })}>
                  <CheckCircle size={16} weight="bold" aria-hidden />
                  {L.apply.replace("{count}", String(selectedCount))}
                </button>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Metni doğrudan taşıyan hata: kullanıcıya gösterilecek cümle. */
class ReadError extends Error {}

/* --------------------------------------------------------------------------
   Bayraklar — canlı: okuyucu hücreyi düzeltince uyarı kalkar
   -------------------------------------------------------------------------- */

function dateFlags(date: string, today: string): RowFlag[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return ["noDate"];
  return date < TCMB_MIN_DATE || date > today ? ["dateRange"] : [];
}

function tradeFlags(row: Omit<EditTrade, "key" | "selected">, today: string): RowFlag[] {
  const flags: RowFlag[] = [...dateFlags(row.date, today)];
  if (!isValidSymbol(row.symbol.trim().toUpperCase())) flags.push("symbolOdd");
  if (row.commission.trim() === "") flags.push("noCommission");
  return [...flags, ...row.fixed];
}

function dividendFlags(row: Omit<EditDividend, "key" | "selected">, today: string): RowFlag[] {
  const flags: RowFlag[] = [...dateFlags(row.date, today)];
  if (!isValidSymbol(row.symbol.trim().toUpperCase())) flags.push("symbolOdd");
  if (row.withheld.trim() === "") flags.push("noWithholding");
  return [...flags, ...row.fixed];
}

/* --------------------------------------------------------------------------
   Parçalar
   -------------------------------------------------------------------------- */

function Privacy({ text }: { text: string }) {
  return (
    <p className={styles.privacy}>
      <LockSimple size={14} weight="bold" aria-hidden />
      {text}
    </p>
  );
}

/** Üç sayı: okunan işlem, temettü ve atlanan satır. */
function Tally({ items }: { items: { value: number; label: string; muted?: boolean }[] }) {
  return (
    <dl className={styles.tally}>
      {items.map((item, i) => (
        <div key={item.label} style={{ "--i": i } as React.CSSProperties} data-muted={item.muted || undefined}>
          <dt>{item.label}</dt>
          <dd className="numeral">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Aylık şerit: her ay bir sütun, alışlar ve satışlar üst üste. Ekstrenin
 * neyi kapsadığını bir bakışta söylüyor — boş bir ay, eksik bir PDF'in
 * işareti olabilir. Renkler hesaplayıcının satır etiketleriyle aynı: alış
 * mavi, satış pirinç (yeşil/kırmızı yalnızca kazanç yönü için).
 */
function MonthStrip({ trades, locale, labels }: { trades: EditTrade[]; locale: Locale; labels: TaxLabels }) {
  const months = useMemo(() => {
    const dated = trades.filter((t) => /^\d{4}-\d{2}/.test(t.date)).map((t) => ({ month: t.date.slice(0, 7), side: t.side }));
    if (dated.length === 0) return [];
    const sorted = dated.map((d) => d.month).sort();
    const [fy, fm] = sorted[0].split("-").map(Number);
    const [ly, lm] = sorted[sorted.length - 1].split("-").map(Number);
    const span = Math.min((ly - fy) * 12 + (lm - fm) + 1, MAX_MONTHS);
    return Array.from({ length: span }, (_, i) => {
      const total = fy * 12 + (fm - 1) + i;
      const key = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
      return {
        key,
        buy: dated.filter((d) => d.month === key && d.side === "buy").length,
        sell: dated.filter((d) => d.month === key && d.side === "sell").length,
      };
    });
  }, [trades]);
  if (months.length === 0) return null;
  const peak = Math.max(...months.map((m) => m.buy + m.sell), 1);
  const monthName = (key: string) =>
    new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
      new Date(`${key}-01T00:00:00Z`),
    );
  return (
    <figure className={styles.months} aria-label={`${labels.sideBuy} / ${labels.sideSell}`}>
      <ol style={{ "--n": months.length } as React.CSSProperties}>
        {months.map((m, i) => (
          <li key={m.key} style={{ "--i": Math.min(i, STAGGER_CAP) } as React.CSSProperties} title={`${monthName(m.key)} · ${m.buy} ${labels.sideBuy} · ${m.sell} ${labels.sideSell}`}>
            <span className={styles.monthBar} data-side="buy" style={{ "--h": m.buy / peak } as React.CSSProperties} />
            <span className={styles.monthBar} data-side="sell" style={{ "--h": m.sell / peak } as React.CSSProperties} />
          </li>
        ))}
      </ol>
      <figcaption>
        <span>{monthName(months[0].key)}</span>
        <span className={styles.monthKey}>
          <i data-side="buy" aria-hidden />
          {labels.sideBuy}
          <i data-side="sell" aria-hidden />
          {labels.sideSell}
        </span>
        <span>{monthName(months[months.length - 1].key)}</span>
      </figcaption>
    </figure>
  );
}

function FlagChips({ flags, labels }: { flags: RowFlag[]; labels: TaxLabels }) {
  const L = labels.import;
  if (flags.length === 0) {
    return (
      <span className={styles.flagOk}>
        <CheckCircle size={14} weight="fill" aria-hidden />
        {L.ok}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map((flag) => (
        <span key={flag} className={styles.flag} data-block={BLOCKING_FLAGS.includes(flag) || undefined}>
          {L.flags[flag]}
        </span>
      ))}
    </span>
  );
}

/** Tablodaki bayrakların açıklaması — yalnızca görünenler, bir kez. */
function FlagLegend({ flags, labels }: { flags: RowFlag[]; labels: TaxLabels }) {
  const shown = [...new Set(flags)];
  if (shown.length === 0) return null;
  return (
    <ul className={styles.legend}>
      {shown.map((flag) => (
        <li key={flag}>
          <span className={styles.flag} data-block={BLOCKING_FLAGS.includes(flag) || undefined}>
            {labels.import.flags[flag]}
          </span>
          {labels.import.flagHelp[flag]}
        </li>
      ))}
    </ul>
  );
}

function SkippedList({ skipped, labels }: { skipped: SkippedLine[]; labels: TaxLabels }) {
  const L = labels.import;
  if (skipped.length === 0) return null;
  return (
    <details className={cn(styles.disclosure, styles.skipped)}>
      <summary>
        <CaretDown size={14} weight="bold" aria-hidden />
        {L.skippedCount.replace("{count}", String(skipped.length))}
      </summary>
      <div>
        <p className={styles.help}>{L.skippedHint}</p>
        <ul>
          {skipped.map((line, i) => (
            <li key={`${i}:${line.source}`}>
              <span className={styles.flag}>{L.reasons[line.reason]}</span>
              <code>{line.source}</code>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** Tablonun "tümünü seç" kutusu: kısmi seçimde ara durum. */
function SelectAll({ rows, onChange, label }: { rows: { selected: boolean }[]; onChange: (value: boolean) => void; label: string }) {
  const all = rows.length > 0 && rows.every((r) => r.selected);
  const some = rows.some((r) => r.selected);
  return (
    <input
      type="checkbox"
      className={styles.check}
      checked={all}
      ref={(node) => {
        if (node) node.indeterminate = some && !all;
      }}
      onChange={(event) => onChange(event.target.checked)}
      aria-label={label}
    />
  );
}

function TradeTable({
  labels,
  locale,
  rows,
  today,
  setRows,
}: {
  labels: TaxLabels;
  locale: Locale;
  rows: EditTrade[];
  today: string;
  setRows: React.Dispatch<React.SetStateAction<EditTrade[]>>;
}) {
  const L = labels.import;
  const edit = (key: string, patch: Partial<EditTrade>) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <div className={styles.previewBlock}>
      <h4 className={styles.previewTitle}>
        {L.tradesTitle}
        <span className="numeral">{rows.filter((r) => r.selected).length}/{rows.length}</span>
      </h4>
      <ScrollEdges className={cn("scroll-x-hint", styles.previewScroll)} tabIndex={0} role="region" aria-label={L.tradesTitle} fixedStart>
        <table className={styles.preview}>
          <thead>
            <tr>
              <th scope="col" className={styles.stick}>
                <span className={styles.stickInner}>
                  <SelectAll rows={rows} label={L.selectAll} onChange={(value) => setRows((prev) => prev.map((r) => ({ ...r, selected: value })))} />
                  {labels.symbol}
                </span>
              </th>
              <th scope="col">{labels.side}</th>
              <th scope="col">{labels.date}</th>
              <th scope="col" className="text-right">{labels.quantity}</th>
              <th scope="col" className="text-right">{labels.priceUsd}</th>
              <th scope="col" className="text-right">{labels.commissionUsd}</th>
              <th scope="col">{L.colNote}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const flags = tradeFlags(row, today);
              return (
                <tr key={row.key} data-off={!row.selected || undefined} style={{ "--i": Math.min(i, STAGGER_CAP) } as React.CSSProperties}>
                  <th scope="row" className={styles.stick}>
                    <span className={styles.stickInner}>
                      <input
                        type="checkbox"
                        className={styles.check}
                        checked={row.selected}
                        onChange={(event) => edit(row.key, { selected: event.target.checked })}
                        aria-label={L.selectRow.replace("{symbol}", row.symbol || String(i + 1))}
                      />
                      <input
                        value={row.symbol}
                        maxLength={10}
                        spellCheck={false}
                        autoComplete="off"
                        aria-label={labels.symbol}
                        aria-invalid={flags.includes("symbolOdd") || undefined}
                        onChange={(event) => edit(row.key, { symbol: event.target.value.toUpperCase() })}
                        className={cn(styles.cell, styles.upper, "w-[76px] font-bold")}
                      />
                    </span>
                  </th>
                  <td>
                    <select
                      value={row.side}
                      aria-label={labels.side}
                      onChange={(event) => edit(row.key, { side: event.target.value === "sell" ? "sell" : "buy" })}
                      className={styles.cell}
                      data-side={row.side}
                    >
                      <option value="buy">{labels.sideBuy}</option>
                      <option value="sell">{labels.sideSell}</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="date"
                      value={row.date}
                      min={TCMB_MIN_DATE}
                      max={today}
                      aria-label={labels.date}
                      aria-invalid={flags.includes("noDate") || flags.includes("dateRange") || undefined}
                      onChange={(event) => edit(row.key, { date: event.target.value })}
                      className={styles.cell}
                    />
                  </td>
                  <td>
                    <NumberCell locale={locale} readAs={labels.readAs} value={row.quantity} label={labels.quantity} onChange={(quantity) => edit(row.key, { quantity })} />
                  </td>
                  <td>
                    <NumberCell locale={locale} readAs={labels.readAs} value={row.price} label={labels.priceUsd} onChange={(price) => edit(row.key, { price })} />
                  </td>
                  <td>
                    <NumberCell locale={locale} readAs={labels.readAs} value={row.commission} label={labels.commissionUsd} onChange={(commission) => edit(row.key, { commission })} />
                  </td>
                  <td>
                    <FlagChips flags={flags} labels={labels} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollEdges>
    </div>
  );
}

function DividendTable({
  labels,
  locale,
  rows,
  today,
  setRows,
}: {
  labels: TaxLabels;
  locale: Locale;
  rows: EditDividend[];
  today: string;
  setRows: React.Dispatch<React.SetStateAction<EditDividend[]>>;
}) {
  const L = labels.import;
  const edit = (key: string, patch: Partial<EditDividend>) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  return (
    <div className={styles.previewBlock}>
      <h4 className={styles.previewTitle}>
        {L.dividendsTitle}
        <span className="numeral">{rows.filter((r) => r.selected).length}/{rows.length}</span>
      </h4>
      <ScrollEdges className={cn("scroll-x-hint", styles.previewScroll)} tabIndex={0} role="region" aria-label={L.dividendsTitle} fixedStart>
        <table className={cn(styles.preview, styles.previewNarrow)}>
          <thead>
            <tr>
              <th scope="col" className={styles.stick}>
                <span className={styles.stickInner}>
                  <SelectAll rows={rows} label={L.selectAll} onChange={(value) => setRows((prev) => prev.map((r) => ({ ...r, selected: value })))} />
                  {labels.symbol}
                </span>
              </th>
              <th scope="col">{labels.paymentDate}</th>
              <th scope="col" className="text-right">{L.colGross}</th>
              <th scope="col" className="text-right">{L.colWithheld}</th>
              <th scope="col">{L.colNote}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const flags = dividendFlags(row, today);
              return (
                <tr key={row.key} data-off={!row.selected || undefined} style={{ "--i": Math.min(i, STAGGER_CAP) } as React.CSSProperties}>
                  <th scope="row" className={styles.stick}>
                    <span className={styles.stickInner}>
                      <input
                        type="checkbox"
                        className={styles.check}
                        checked={row.selected}
                        onChange={(event) => edit(row.key, { selected: event.target.checked })}
                        aria-label={L.selectRow.replace("{symbol}", row.symbol || String(i + 1))}
                      />
                      <input
                        value={row.symbol}
                        maxLength={10}
                        spellCheck={false}
                        autoComplete="off"
                        aria-label={labels.symbol}
                        onChange={(event) => edit(row.key, { symbol: event.target.value.toUpperCase() })}
                        className={cn(styles.cell, styles.upper, "w-[76px] font-bold")}
                      />
                    </span>
                  </th>
                  <td>
                    <input
                      type="date"
                      value={row.date}
                      min={TCMB_MIN_DATE}
                      max={today}
                      aria-label={labels.paymentDate}
                      onChange={(event) => edit(row.key, { date: event.target.value })}
                      className={styles.cell}
                    />
                  </td>
                  <td>
                    <NumberCell locale={locale} readAs={labels.readAs} value={row.gross} label={L.colGross} onChange={(gross) => edit(row.key, { gross })} />
                  </td>
                  <td>
                    <NumberCell locale={locale} readAs={labels.readAs} value={row.withheld} label={L.colWithheld} onChange={(withheld) => edit(row.key, { withheld })} />
                  </td>
                  <td>
                    <FlagChips flags={flags} labels={labels} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollEdges>
    </div>
  );
}

/**
 * Sayı hücresi. Belirsiz girişte ("1.845" TR'de binlik okunur) hücre pirinç
 * çerçeve alır ve okunan değer ipucunda yazar — dar tabloda alt satıra bir
 * cümle sığmıyor, ama yanlış okunan adet sessiz kalmamalı.
 */
function NumberCell({
  value,
  label,
  locale,
  readAs,
  onChange,
}: {
  value: string;
  label: string;
  locale: Locale;
  readAs: string;
  onChange: (value: string) => void;
}) {
  const parsed = parseDecimalInput(value, locale);
  const hint =
    parsed !== null && isAmbiguous(value, locale)
      ? readAs.replace("{value}", formatDecimalInput(parsed, locale))
      : undefined;
  return (
    <input
      inputMode="decimal"
      autoComplete="off"
      value={value}
      aria-label={hint ? `${label}. ${hint}` : label}
      title={hint}
      data-ambiguous={hint ? true : undefined}
      onChange={(event) => onChange(event.target.value)}
      className={cn(styles.cell, "numeral w-[96px] text-right")}
    />
  );
}
