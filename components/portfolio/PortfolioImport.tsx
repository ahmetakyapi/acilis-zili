"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle,
  CircleNotch,
  FileArrowUp,
  LockSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { importPositionsAction } from "@/app/actions/portfolio";
import { buttonClass, LogoTile } from "@/components/ui/primitives";
import { formatIsoDate } from "@/lib/fx";
import type { Locale } from "@/lib/i18n/config";
import { netPositions, planImport, type ExistingPosition } from "@/lib/portfolio-import";
import {
  BLOCKING_FLAGS,
  importCsv,
  importPdfLines,
  mergeResults,
  type Broker,
  type ImportedTrade,
  type ImportResult,
  type RowFlag,
} from "@/lib/tax-import";
import { PdfPasswordError, pdfLines } from "@/lib/tax-import/pdf-text";
import { cn, formatPrice, isValidSymbol, plural } from "@/lib/utils";
import type { PortfolioLabels } from "./PortfolioWorkbench";
import styles from "./Workbench.module.css";

/**
 * EKSTREDEN PORTFÖYE — seç, oku, gözden geçir, ekle.
 *
 * AYRIŞTIRICI VERGİ EKRANIYLA ORTAK: `lib/tax-import` (Midas PDF, IBKR PDF
 * ve CSV) ve `lib/tax-import/pdf-text.ts` (pdf.js, tarayıcıda). İki ekran
 * aynı satırı aynı biçimde okuyor; bir kurumun biçimi değişirse tek yerde
 * düzeltiliyor. Net pozisyon hesabı `lib/portfolio-import.ts`te (FIFO).
 *
 * GİZLİLİK. Dosya `File` olarak bellekte okunuyor; hiçbir `fetch` yok. Sunucuya
 * yalnızca okuyucunun onayladığı SATIRLAR gidiyor (sembol, adet, fiyat,
 * gün) ve onlar da tek satırlık eklemeyle aynı şemadan geçiyor. Bu modül ve
 * pdf.js pencere açılınca iniyor, sayfanın ilk JS'inde değil.
 *
 * ONAY ADIMI ZORUNLU (vergi ekranındaki gerekçe): PDF'in metin katmanı
 * sütun sınırını kaybedebilir. Şüpheli satır seçili gelmez; tarihi, sembolü
 * ya da para birimi okunamayan satır hiç seçilemez, çünkü portföy satırı
 * üçüne de muhtaç ve tahmin edilmiyor.
 */

type Phase =
  | { kind: "pick"; error?: string }
  | { kind: "reading"; file: string; page: number; pages: number }
  | { kind: "password"; wrong: boolean }
  | { kind: "review" };

type Row = {
  key: string;
  trade: ImportedTrade;
  flags: RowFlag[];
  selectable: boolean;
  selected: boolean;
};

/** Tek dosyanın tavanı — vergi ekranıyla aynı. */
const MAX_FILE_MB = 20;
const BYTES_PER_MB = 1024 * 1024;
const QTY_DECIMALS = 8;
const COST_DECIMALS = 6;
const EASE = [0.22, 1, 0.36, 1] as const;

class ReadError extends Error {}

export function PortfolioImport({
  labels,
  locale,
  today,
  minDate,
  maxPositions,
  existing,
  onCancel,
  onImported,
}: {
  labels: PortfolioLabels;
  locale: Locale;
  today: string;
  minDate: string;
  maxPositions: number;
  existing: ExistingPosition[];
  onCancel: () => void;
  onImported: (ids: string[]) => void;
}) {
  const L = labels.importer;
  const inputRef = useRef<HTMLInputElement>(null);
  const runRef = useRef(0);
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [dragging, setDragging] = useState(false);
  const [password, setPassword] = useState("");
  const [broker, setBroker] = useState<Broker | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<"lots" | "symbol">("lots");
  const [decisions, setDecisions] = useState<Record<string, "merge" | "skip">>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* ---- Okuma ---- */
  async function read(list: File[], pdfPassword?: string) {
    const run = ++runRef.current;
    setFiles(list);
    setSaveError(null);
    setPhase({ kind: "reading", file: list[0]?.name ?? "", page: 0, pages: 0 });
    try {
      const results: ImportResult[] = [];
      for (const file of list) {
        if (file.size > MAX_FILE_MB * BYTES_PER_MB) throw new ReadError(L.errorSize.replace("{mb}", String(MAX_FILE_MB)));
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        const isCsv = /csv|text\/plain/.test(file.type) || /\.(csv|txt)$/i.test(file.name);
        if (isCsv) {
          results.push(importCsv(await file.text()));
        } else if (isPdf) {
          const lines = await pdfLines(file, {
            password: pdfPassword,
            onPage: (page, pages) => {
              if (runRef.current === run) setPhase({ kind: "reading", file: file.name, page, pages });
            },
          });
          if (lines.length === 0) throw new ReadError(L.errorBody);
          results.push(importPdfLines(lines));
        } else {
          throw new ReadError(L.errorType);
        }
      }
      if (runRef.current !== run) return;
      const merged = mergeResults(results);
      if (merged.trades.length === 0) {
        throw new ReadError(merged.broker === null ? (merged.skipped.length > 0 ? L.errorUnknown : L.errorBody) : L.errorNoTrades);
      }
      setBroker(merged.broker);
      setRows(
        merged.trades.map((trade, i) => {
          const flags = [...trade.flags];
          const dated = /^\d{4}-\d{2}-\d{2}$/.test(trade.date);
          if (dated && (trade.date < minDate || trade.date > today)) flags.push("dateRange");
          /* Portföy satırı gün, sembol ve DOLAR fiyat olmadan kurulamıyor. */
          const selectable = dated && trade.date >= minDate && trade.date <= today && isValidSymbol(trade.symbol) && !flags.includes("currency");
          const selected = selectable && merged.broker !== null && !flags.some((f) => BLOCKING_FLAGS.includes(f));
          return { key: `t${i}`, trade, flags, selectable, selected };
        }),
      );
      setDecisions({});
      setPhase({ kind: "review" });
    } catch (error) {
      if (runRef.current !== run) return;
      if (error instanceof PdfPasswordError) {
        setPhase({ kind: "password", wrong: error.wrong });
        return;
      }
      setPhase({ kind: "pick", error: error instanceof ReadError ? error.message : L.errorBody });
    }
  }

  function take(list: FileList | null) {
    const picked = list ? [...list] : [];
    if (picked.length > 0) void read(picked);
  }

  /* ---- Plan ---- */
  const selectedTrades = useMemo(() => rows.filter((r) => r.selected).map((r) => r.trade), [rows]);
  const plans = useMemo(() => netPositions(selectedTrades), [selectedTrades]);
  const imports = useMemo(() => planImport(plans, existing, mode), [plans, existing, mode]);
  const importBySymbol = new Map(imports.map((item) => [item.symbol, item]));
  const conflicts = imports.filter((item) => item.conflict);
  const pending = conflicts.filter((item) => !decisions[item.symbol]);
  const toAdd = imports.flatMap((item) => (!item.conflict || decisions[item.symbol] === "merge" ? item.lots : []));
  const overLimit = existing.length + toAdd.length > maxPositions;

  const money = (value: number, digits = 2) => formatPrice(value, locale, { currency: true, digits });
  const qtyText = (value: number) =>
    new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: QTY_DECIMALS }).format(value);
  const brokerName = broker === "midas" ? L.brokerMidas : broker === "ibkr" ? L.brokerIbkr : broker === "acilis-zili" ? L.brokerOwn : L.brokerUnknown;

  async function apply() {
    if (toAdd.length === 0 || pending.length > 0 || overLimit) return;
    setSaving(true);
    setSaveError(null);
    /* Eylem fırlatırsa (ağ, dağıtım sonrası eski sekme) düğme sonsuza dek
       "Ekleniyor" kalıyordu; hata sonucu olarak okunuyor (28 Eylül denetimi). */
    let result: Awaited<ReturnType<typeof importPositionsAction>>;
    try {
      result = await importPositionsAction(
        toAdd.map((lot) => ({
          symbol: lot.symbol,
          quantity: Number(lot.quantity.toFixed(QTY_DECIMALS)),
          costUsd: Number(lot.costUsd.toFixed(COST_DECIMALS)),
          boughtAt: lot.date,
        })),
      );
    } catch {
      setSaving(false);
      setSaveError(labels.errors.failed);
      return;
    }
    setSaving(false);
    if (result.status === "saved" && result.ids) {
      onImported(result.ids);
      return;
    }
    setSaveError(
      result.error === "limit"
        ? L.limit.replace("{max}", String(maxPositions))
        : labels.errors[result.error ?? "failed"],
    );
  }

  /* ======================================================================
     Seç / oku / şifre
     ====================================================================== */
  if (phase.kind !== "review") {
    return (
      <div className={styles.importer}>
        <AnimatePresence mode="wait" initial={false}>
          {phase.kind === "reading" ? (
            <motion.div
              key="reading"
              className={styles.readingCard}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              role="status"
            >
              <CircleNotch size={28} weight="bold" className={cn(styles.spin, styles.readingIcon)} aria-hidden />
              <p className={styles.readingTitle}>{L.reading.replace("{file}", phase.file)}</p>
              {phase.pages > 0 && (
                <>
                  <p className={cn("numeral", styles.readingMeta)}>
                    {L.readingPage.replace("{page}", String(phase.page)).replace("{pages}", String(phase.pages))}
                  </p>
                  <span className={styles.progress} aria-hidden>
                    <span className={styles.progressFill} style={{ transform: `scaleX(${phase.page / phase.pages})` }} />
                  </span>
                </>
              )}
            </motion.div>
          ) : phase.kind === "password" ? (
            <motion.form
              key="password"
              className={styles.readingCard}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              onSubmit={(event) => {
                event.preventDefault();
                if (password) void read(files, password);
              }}
            >
              <LockSimple size={28} weight="duotone" className={styles.readingIcon} aria-hidden />
              <p className={styles.readingTitle}>{L.passwordTitle}</p>
              <p className={styles.readingMeta}>{L.passwordBody}</p>
              <label className={cn(styles.fieldBlock, "w-full max-w-xs")}>
                <span className={styles.label}>{L.passwordLabel}</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={phase.wrong || undefined}
                  className={styles.input}
                  data-autofocus
                  ref={(node) => node?.focus({ preventScroll: true })}
                />
                {phase.wrong && <span className={styles.fieldError} role="alert">{L.passwordWrong}</span>}
              </label>
              <div className="flex gap-2">
                <button type="button" className={buttonClass({ variant: "quiet", size: "md" })} onClick={() => setPhase({ kind: "pick" })}>
                  {L.back}
                </button>
                <button type="submit" className={buttonClass({ size: "md" })} disabled={!password}>
                  {L.unlock}
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.div
              key="pick"
              className={styles.pickStack}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              {phase.error && (
                <div className={styles.importError} role="alert">
                  <WarningCircle size={20} weight="duotone" aria-hidden />
                  <div>
                    <p className={styles.importErrorTitle}>{L.errorTitle}</p>
                    <p>{phase.error}</p>
                  </div>
                </div>
              )}
              <label
                className={styles.drop}
                data-dragging={dragging || undefined}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  take(event.dataTransfer.files);
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.csv,application/pdf,text/csv"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    take(event.target.files);
                    event.target.value = "";
                  }}
                />
                <span className={styles.dropIcon} aria-hidden>
                  <FileArrowUp size={26} weight="duotone" />
                </span>
                <span className={styles.dropTitle}>{L.dropTitle}</span>
                <span className={styles.dropBody}>{L.dropBody}</span>
                <span className={buttonClass({ size: "md", className: "pointer-events-none mt-1" })}>{L.choose}</span>
              </label>
              <p className={styles.privacy}>
                <LockSimple size={15} weight="duotone" aria-hidden />
                {L.privacy}
              </p>
              <div className={styles.supported}>
                <p className={styles.supportedTitle}>{L.supportedTitle}</p>
                <ul>
                  <li>{L.supportedMidas}</li>
                  <li>{L.supportedIbkr}</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  /* ======================================================================
     Gözden geçir
     ====================================================================== */
  const selectableRows = rows.filter((r) => r.selectable);
  const allSelected = selectableRows.length > 0 && selectableRows.every((r) => r.selected);

  return (
    <div className={styles.importer}>
      {/* ---- Künye şeridi ---- */}
      <div className={styles.reviewHead}>
        <span className={styles.brokerBadge} data-unknown={broker === null || undefined}>
          {broker !== null && <CheckCircle size={15} weight="fill" aria-hidden />}
          {brokerName}
        </span>
        <span className="numeral text-small text-muted">{plural(rows.length, L.tradesCountOne, L.tradesCount).replace("{n}", String(rows.length))}</span>
        <span className="numeral text-small text-muted">{L.selectedCount.replace("{n}", String(selectedTrades.length))}</span>
        <button type="button" className={cn(styles.linkButton, "ml-auto")} onClick={() => inputRef.current?.click()}>
          {L.another}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.csv,application/pdf,text/csv"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            take(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {broker === null && <p className={styles.importHint}>{L.unknownHint}</p>}

      {/* ---- İşlemler ---- */}
      <section aria-labelledby="import-trades" className={styles.reviewSection}>
        <h3 id="import-trades" className={styles.reviewTitle}>{L.reviewTitle}</h3>
        <div className={styles.tradeScroll} tabIndex={0} role="region" aria-labelledby="import-trades">
          <table className={styles.tradeTable}>
            <thead>
              <tr>
                <th scope="col" className={styles.checkCell}>
                  <input
                    type="checkbox"
                    aria-label={L.selectAll}
                    checked={allSelected}
                    disabled={selectableRows.length === 0}
                    onChange={(event) => {
                      const on = event.target.checked;
                      setRows((prev) => prev.map((r) => (r.selectable ? { ...r, selected: on } : r)));
                    }}
                    className={styles.check}
                  />
                </th>
                <th scope="col">{L.colSymbol}</th>
                <th scope="col">{L.colDate}</th>
                <th scope="col">{L.colSide}</th>
                <th scope="col" className="text-right">{L.colQuantity}</th>
                <th scope="col" className="text-right">{L.colPrice}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const side = row.trade.side === "buy" ? L.sideBuy : L.sideSell;
                const date = row.trade.date ? formatIsoDate(row.trade.date, locale) : "";
                const shownFlags = row.flags.filter((f) => BLOCKING_FLAGS.includes(f));
                return (
                  <tr key={row.key} data-selected={row.selected || undefined} data-disabled={!row.selectable || undefined}>
                    <td className={styles.checkCell}>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={!row.selectable}
                        aria-label={L.includeRow.replace("{symbol}", row.trade.symbol).replace("{date}", date).replace("{side}", side)}
                        onChange={(event) => {
                          const on = event.target.checked;
                          setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, selected: on } : r)));
                        }}
                        className={styles.check}
                      />
                    </td>
                    <td>
                      <span className="numeral font-bold text-strong">{row.trade.symbol}</span>
                      {shownFlags.length > 0 && (
                        <span className={styles.flags}>
                          {shownFlags.map((flag) => (
                            <span key={flag} className={styles.flag}>{L.flags[flag]}</span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="numeral whitespace-nowrap">{date || "?"}</td>
                    <td>
                      <span className={styles.side} data-side={row.trade.side}>{side}</span>
                    </td>
                    <td className="numeral text-right">{qtyText(row.trade.quantity)}</td>
                    <td className="numeral text-right">{money(row.trade.priceUsd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.some((r) => !r.selected && r.flags.some((f) => BLOCKING_FLAGS.includes(f))) && (
          <p className={styles.importHint}>{L.flagHint}</p>
        )}
      </section>

      {/* ---- Net pozisyonlar ---- */}
      <section aria-labelledby="import-positions" className={styles.reviewSection}>
        <div className={styles.reviewTitleRow}>
          <h3 id="import-positions" className={styles.reviewTitle}>{L.positionsTitle}</h3>
          <div className={styles.segment} role="radiogroup" aria-label={L.modeLabel}>
            {(["lots", "symbol"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={mode === option}
                className={styles.segmentItem}
                onClick={() => setMode(option)}
              >
                {mode === option && <motion.span layoutId="import-mode" className={styles.segmentThumb} transition={{ duration: 0.3, ease: EASE }} />}
                <span className={styles.segmentText}>{option === "lots" ? L.modeLots : L.modeSymbol}</span>
              </button>
            ))}
          </div>
        </div>

        {conflicts.length > 1 && (
          <div className={styles.bulk}>
            <button type="button" className={styles.linkButton} onClick={() => setDecisions(Object.fromEntries(conflicts.map((c) => [c.symbol, "merge"])))}>
              {L.mergeAll}
            </button>
            <button type="button" className={styles.linkButton} onClick={() => setDecisions(Object.fromEntries(conflicts.map((c) => [c.symbol, "skip"])))}>
              {L.skipAll}
            </button>
          </div>
        )}

        {plans.length === 0 ? (
          <p className={styles.importHint}>{L.nothingToAdd}</p>
        ) : (
          <ul className={styles.planList}>
            {plans.map((plan, i) => {
              const item = importBySymbol.get(plan.symbol);
              const lots = item?.lots ?? [];
              const status =
                plan.status === "closed"
                  ? { label: L.statusClosed, tone: "muted" }
                  : plan.status === "incomplete"
                    ? { label: L.statusIncomplete, tone: "warn" }
                    : item && lots.length === 0
                      ? { label: L.statusDuplicate, tone: "muted" }
                      : item?.conflict
                        ? { label: L.statusConflict, tone: "warn" }
                        : { label: L.statusNew, tone: "ok" };
              const decision = decisions[plan.symbol];
              return (
                <motion.li
                  key={plan.symbol}
                  className={styles.plan}
                  data-dim={plan.status !== "open" || (item?.conflict && decision === "skip") || undefined}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04, ease: EASE }}
                >
                  <div className={styles.planMain}>
                    <LogoTile symbol={plan.symbol} size="md" />
                    <div className={styles.planText}>
                      <span className="numeral font-bold text-strong">{plan.symbol}</span>
                      {plan.status === "open" && plan.quantity !== null && (
                        <span className="numeral text-small text-muted">
                          {qtyText(plan.quantity)} · {L.avgCost.replace("{price}", money(plan.avgCostUsd ?? 0))}
                        </span>
                      )}
                    </div>
                    <span className={styles.planRight}>
                      {lots.length > 0 && (
                        <span className="numeral text-small text-muted">{L.lots.replace("{n}", String(lots.length))}</span>
                      )}
                      <span className={styles.status} data-tone={status.tone}>{status.label}</span>
                    </span>
                  </div>
                  {plan.status === "closed" && <p className={styles.planNote}>{L.closedNote}</p>}
                  {plan.status === "incomplete" && (
                    <p className={styles.planNote}>{L.incompleteNote.replace("{qty}", qtyText(plan.missingQuantity))}</p>
                  )}
                  {item && item.duplicates > 0 && (
                    <p className={styles.planNote}>{L.duplicateNote.replace("{n}", String(item.duplicates))}</p>
                  )}
                  {item?.conflict && (
                    <div className={styles.conflict}>
                      <p>{L.conflictQuestion.replace("{symbol}", plan.symbol)}</p>
                      <div className={styles.segment} role="radiogroup" aria-label={L.conflictQuestion.replace("{symbol}", plan.symbol)}>
                        {(["merge", "skip"] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={decision === option}
                            className={styles.segmentItem}
                            onClick={() => setDecisions((prev) => ({ ...prev, [plan.symbol]: option }))}
                          >
                            {decision === option && (
                              <motion.span layoutId={`conflict-${plan.symbol}`} className={styles.segmentThumb} transition={{ duration: 0.3, ease: EASE }} />
                            )}
                            <span className={styles.segmentText}>{option === "merge" ? L.merge : L.skip}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ---- Yöntem künyesi: panelin içinde, hairline ile ---- */}
      <div className={styles.method}>
        <p className={styles.methodTitle}>{L.methodTitle}</p>
        <p>{L.method}</p>
        {mode === "symbol" && <p>{L.methodSymbol}</p>}
        <p>{L.methodScope}</p>
        <p className={styles.privacyInline}>
          <LockSimple size={14} weight="duotone" aria-hidden />
          {L.privacy}
        </p>
      </div>

      {(saveError || overLimit) && (
        <p className={styles.formError} role="alert">
          {saveError ?? L.limit.replace("{max}", String(maxPositions))}
        </p>
      )}

      <div className={styles.composerActions}>
        <button type="button" className={buttonClass({ variant: "quiet", size: "lg" })} onClick={onCancel}>
          {labels.composer.cancel}
        </button>
        <div className={styles.applyWrap}>
          {pending.length > 0 && (
            <span className={styles.pendingNote}>{L.conflictsPending.replace("{n}", String(pending.length))}</span>
          )}
          <button
            type="button"
            className={buttonClass({ size: "lg", className: styles.submit })}
            disabled={saving || toAdd.length === 0 || pending.length > 0 || overLimit}
            onClick={() => void apply()}
          >
            {saving && <CircleNotch size={16} weight="bold" className={styles.spin} aria-hidden />}
            {saving ? L.applying : toAdd.length > 0 ? L.apply.replace("{n}", String(toAdd.length)) : labels.composer.submitAdd}
          </button>
        </div>
      </div>
    </div>
  );
}
