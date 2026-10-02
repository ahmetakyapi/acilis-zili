"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { ArrowCounterClockwise, FilePdf, Plus, X } from "@phosphor-icons/react";
import {
  deletePositionAction,
  removePositionsAction,
  restorePositionAction,
} from "@/app/actions/portfolio";
import { buttonClass } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { ExistingPosition } from "@/lib/portfolio-import";
import { cn } from "@/lib/utils";
import { PortfolioSheet } from "./PortfolioSheet";
import { PositionComposer, type ComposerPosition } from "./PositionComposer";
import styles from "./Workbench.module.css";

/* --------------------------------------------------------------------------
   PORTFÖY İŞ MASASI — ekleme, düzenleme, silme/geri alma, içe aktarma.

   ESKİ AKIŞ (28 Eylül öncesi): kahramandaki "Pozisyon Ekle" sayfanın
   DİBİNDEKİ bir açılır panele kaydırıyordu; orada beş alan yan yana
   duruyordu (sembol, adet, dolar fiyatı, tarayıcının yerli tarih penceresi,
   not). Okuyucu sembolü EZBERDEN bilmek, alış fiyatını aracı kurumun
   uygulamasından bakıp yazmak zorundaydı; ondalık alanı `type="number"`
   olduğu için Türkçe virgül tarayıcıya göre kayboluyordu; eklenen satır
   sayfa yenilenince sessizce tabloya düşüyordu. Düzeltme yoktu (sil ve baştan
   yaz), silme onaysız ve geri alınamazdı.

   YENİ AKIŞ: her giriş aynı pencereyi açıyor (kahraman, boş durum, tablo).
   Ad ya da sembolle arama (logolu öneri), adet, fiyat ya da toplam tutar,
   tarih (varsayılan bugün) ve o günün kapanışı ÖNERİ olarak; tek düğme.
   Eklenen satır tabloya kayarak gelip bir an vurgulanıyor. Satırdan
   düzenleme aynı pencereyi dolu açıyor; silme anında ve altta "Geri Al".

   Bağlam sayfanın TAMAMINI sarıyor ama sarılan ağacın çoğu sunucuda
   çiziliyor (CLAUDE.md "Sunucu bileşeni istemci sağlayıcıya children olarak
   geçebilir"); istemcide yalnızca düğmeler, tablo ve pencere.
   -------------------------------------------------------------------------- */

export type PortfolioLabels = Dictionary["lira"]["portfolio"];

/* İçe aktarma, ayrıştırıcılar ve (PDF'te) pdf.js ancak pencere açılınca iniyor. */
const PortfolioImport = dynamic(() => import("./PortfolioImport").then((m) => m.PortfolioImport), {
  ssr: false,
  loading: () => <div className={styles.importLoading} aria-hidden />,
});

type Sheet = { kind: "add" } | { kind: "edit"; position: ComposerPosition } | { kind: "import" };

type Toast = {
  id: number;
  message: string;
  tone?: "error";
  action?: { label: string; run: () => void };
};

type WorkbenchContext = {
  openAdd: () => void;
  openImport: () => void;
  openEdit: (position: ComposerPosition) => void;
  remove: (position: ComposerPosition) => void;
  /** Tablo o an görünen pozisyonları bildiriyor — içe aktarma çakışmayı onlarla arıyor. */
  setExisting: (positions: ExistingPosition[]) => void;
  /** İyimser olarak gizlenen (silinmekte olan) satırlar. */
  hidden: ReadonlySet<string>;
  /** Az önce eklenen ya da düzeltilen satırlar — tablo onları bir an vurguluyor. */
  fresh: ReadonlySet<string>;
  labels: PortfolioLabels;
  locale: Locale;
  /** Kısa bildirim — sıra kaydedilemediğinde liste kullanıyor. */
  notify: (toast: Omit<Toast, "id">) => void;
};

const Context = createContext<WorkbenchContext | null>(null);

export function useWorkbench(): WorkbenchContext {
  const value = useContext(Context);
  if (!value) throw new Error("useWorkbench: PortfolioWorkbench dışında çağrıldı");
  return value;
}

/**
 * Sunucu eylemi FIRLATIRSA da sonuç dönsün (28 Eylül denetimi). Yalnızca
 * `result.status` okunuyordu; ağ koptuğunda ya da dağıtımdan sonra eski
 * sekmede ("Failed to find Server Action") eylem fırlatıyor, silinen satır
 * `hidden`da kalıp ekrandan kayboluyor ama silinmemiş oluyordu ve geçiş
 * içindeki hata sayfayı hata ekranına düşürüyordu.
 */
async function settle<T extends { status: string }>(run: () => Promise<T>): Promise<T | { status: "error" }> {
  try {
    return await run();
  } catch {
    return { status: "error" };
  }
}

/** Bildirimin ekranda kalma süresi — "Geri Al" okunup basılabilsin. */
const TOAST_MS = 6500;
/** Yeni satırın vurgusu. */
const FRESH_MS = 2400;

export function PortfolioWorkbench({
  labels,
  locale,
  today,
  minDate,
  maxPositions,
  children,
}: {
  labels: PortfolioLabels;
  locale: Locale;
  /** İstanbul'un bugünü — tarih alanının üst sınırı, sunucudan. */
  today: string;
  minDate: string;
  maxPositions: number;
  children: React.ReactNode;
}) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [existing, setExisting] = useState<ExistingPosition[]>([]);
  const toastSeq = useRef(0);
  const [, startTransition] = useTransition();

  const show = useCallback((next: Sheet) => {
    setSheet(next);
    setOpen(true);
  }, []);

  const notify = useCallback((next: Omit<Toast, "id">) => {
    toastSeq.current += 1;
    setToast({ ...next, id: toastSeq.current });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const markFresh = useCallback((ids: string[]) => {
    setFresh(new Set(ids));
    window.setTimeout(() => setFresh(new Set()), FRESH_MS);
  }, []);

  const failMessage = labels.toastFailed;

  const remove = useCallback(
    (position: ComposerPosition) => {
      setHidden((prev) => new Set(prev).add(position.id));
      startTransition(async () => {
        const result = await settle(() => deletePositionAction(position.id));
        if (result.status !== "saved") {
          setHidden((prev) => {
            const next = new Set(prev);
            next.delete(position.id);
            return next;
          });
          notify({ message: failMessage, tone: "error" });
          return;
        }
        notify({
          message: labels.toastRemoved.replace("{symbol}", position.symbol),
          action: {
            label: labels.undo,
            run: () => {
              startTransition(async () => {
                const restored = await settle(() =>
                  restorePositionAction({
                    id: position.id,
                    symbol: position.symbol,
                    quantity: position.quantity,
                    costUsd: position.costUsd,
                    boughtAt: position.boughtAt,
                    note: position.note,
                  }),
                );
                setHidden((prev) => {
                  const next = new Set(prev);
                  next.delete(position.id);
                  return next;
                });
                if (restored.status === "saved") {
                  markFresh([position.id]);
                  notify({ message: labels.toastRestored.replace("{symbol}", position.symbol) });
                } else {
                  notify({ message: failMessage, tone: "error" });
                }
              });
            },
          },
        });
      });
    },
    [failMessage, labels.toastRemoved, labels.toastRestored, labels.undo, markFresh, notify],
  );

  const value = useMemo<WorkbenchContext>(
    () => ({
      openAdd: () => show({ kind: "add" }),
      openImport: () => show({ kind: "import" }),
      openEdit: (position) => show({ kind: "edit", position }),
      remove,
      setExisting,
      hidden,
      fresh,
      labels,
      locale,
      notify,
    }),
    [show, remove, hidden, fresh, labels, locale, notify],
  );

  const C = labels.composer;
  const title = sheet?.kind === "import" ? labels.importer.title : sheet?.kind === "edit" ? C.editTitle : C.addTitle;

  return (
    <Context.Provider value={value}>
      {children}

      <PortfolioSheet
        open={open}
        onClose={() => setOpen(false)}
        onClosed={() => setSheet(null)}
        title={title}
        closeLabel={C.close}
        size={sheet?.kind === "import" ? "lg" : "md"}
      >
        {sheet && sheet.kind !== "import" && (
          <PositionComposer
            key={sheet.kind === "edit" ? sheet.position.id : "add"}
            labels={labels}
            locale={locale}
            today={today}
            minDate={minDate}
            maxPositions={maxPositions}
            editing={sheet.kind === "edit" ? sheet.position : null}
            onCancel={() => setOpen(false)}
            onDelete={
              sheet.kind === "edit"
                ? () => {
                    setOpen(false);
                    remove(sheet.position);
                  }
                : undefined
            }
            onSaved={(id, symbol) => {
              setOpen(false);
              markFresh([id]);
              notify({
                message: (sheet.kind === "edit" ? labels.toastUpdated : labels.toastAdded).replace("{symbol}", symbol),
              });
            }}
          />
        )}
        {sheet?.kind === "import" && (
          <PortfolioImport
            labels={labels}
            locale={locale}
            today={today}
            minDate={minDate}
            maxPositions={maxPositions}
            existing={existing}
            onCancel={() => setOpen(false)}
            onImported={(ids) => {
              setOpen(false);
              markFresh(ids);
              notify({
                message: labels.toastImported.replace("{n}", String(ids.length)),
                action: {
                  label: labels.undo,
                  run: () => {
                    startTransition(async () => {
                      const result = await settle(() => removePositionsAction(ids));
                      notify(
                        result.status === "saved"
                          ? { message: labels.toastImportUndone }
                          : { message: failMessage, tone: "error" },
                      );
                    });
                  },
                },
              });
            }}
          />
        )}
      </PortfolioSheet>

      {/* Bildirim: ekranın altında, telefonda güvenli alanın üstünde. */}
      <div className={styles.toastRegion} role="status" aria-live="polite">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              className={cn(styles.toast, toast.tone === "error" && styles.toastError)}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={styles.toastText}>{toast.message}</span>
              {toast.action && (
                <button
                  type="button"
                  className={styles.toastAction}
                  onClick={() => {
                    const run = toast.action?.run;
                    setToast(null);
                    run?.();
                  }}
                >
                  <ArrowCounterClockwise size={15} weight="bold" aria-hidden />
                  {toast.action.label}
                </button>
              )}
              <button type="button" className={styles.toastClose} aria-label={labels.dismiss} onClick={() => setToast(null)}>
                <X size={14} weight="bold" aria-hidden />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Context.Provider>
  );
}

/* --------------------------------------------------------------------------
   Pencereyi açan düğmeler — kahraman, boş durum, panel başlığı
   -------------------------------------------------------------------------- */

export function AddPositionButton({ variant = "primary", className }: { variant?: "primary" | "ghost"; className?: string }) {
  const { openAdd, labels } = useWorkbench();
  return (
    <button type="button" onClick={openAdd} className={buttonClass({ variant, size: "md", className })}>
      <Plus size={16} weight="bold" aria-hidden />
      {labels.addTitle}
    </button>
  );
}

export function ImportButton({ className }: { className?: string }) {
  const { openImport, labels } = useWorkbench();
  return (
    <button type="button" onClick={openImport} className={buttonClass({ variant: "ghost", size: "md", className })}>
      <FilePdf size={16} weight="duotone" aria-hidden />
      {labels.importAction}
    </button>
  );
}

/** Boş portföyün iki yolu: elle ekle ya da ekstreden getir. */
export function EmptyChoices() {
  const { openAdd, openImport, labels } = useWorkbench();
  const choices = [
    { key: "add", title: labels.emptyAddTitle, body: labels.emptyAddBody, icon: Plus, run: openAdd, primary: true },
    { key: "import", title: labels.emptyImportTitle, body: labels.emptyImportBody, icon: FilePdf, run: openImport, primary: false },
  ] as const;
  return (
    <div className={styles.choices}>
      {choices.map((choice, i) => (
        <motion.button
          key={choice.key}
          type="button"
          onClick={choice.run}
          className={cn(styles.choice, choice.primary && styles.choicePrimary)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className={styles.choiceIcon} aria-hidden>
            <choice.icon size={20} weight={choice.primary ? "bold" : "duotone"} />
          </span>
          <span className={styles.choiceTitle}>{choice.title}</span>
          <span className={styles.choiceBody}>{choice.body}</span>
        </motion.button>
      ))}
    </div>
  );
}
