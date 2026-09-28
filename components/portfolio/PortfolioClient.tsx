"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut } from "@phosphor-icons/react";
import {
  addPositionAction,
  type PortfolioActionState,
} from "@/app/actions/portfolio";
import { useLocaleHref } from "@/components/layout/useLocaleHref";
import { buttonClass } from "@/components/ui/primitives";
import { TAX_HANDOFF_KEY, type TaxHandoffPosition } from "@/lib/portfolio";

/* --------------------------------------------------------------------------
   Pozisyon ekleme formu

   Form JavaScript kapalıyken de çalışıyor (sunucu eylemi, düz form); açıkken
   `useActionState` hata cümlesini alanların altına yazıyor ve kayıt
   başarılıysa formu sıfırlıyor. Hata `role="alert"` ile duyuruluyor —
   deponun form kalıbı (`AuthForm`, `DeleteAccount`).
   -------------------------------------------------------------------------- */

export type AddPositionLabels = {
  symbol: string;
  quantity: string;
  costUsd: string;
  boughtAt: string;
  note: string;
  notePlaceholder: string;
  add: string;
  adding: string;
  errors: Record<NonNullable<PortfolioActionState["error"]>, string>;
};

const FIELD =
  "h-11 w-full rounded-(--radius-md) border border-line bg-surface-elevated px-3.5 text-sm text-strong outline-none transition-colors placeholder:text-muted focus:border-line-focus";

export function AddPositionForm({
  labels,
  today,
  minDate,
}: {
  labels: AddPositionLabels;
  /** İstanbul'un bugünü — tarih alanının üst sınırı, sunucudan. */
  today: string;
  minDate: string;
}) {
  const [state, action, pending] = useActionState<PortfolioActionState, FormData>(
    addPositionAction,
    { status: "idle" },
  );
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "saved") formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-[1fr_1fr_1fr_1fr] sm:px-5 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-body">{labels.symbol}</span>
        <input
          name="symbol"
          required
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className={`${FIELD} uppercase`}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-body">{labels.quantity}</span>
        <input name="quantity" type="number" required min="0" step="any" inputMode="decimal" className={FIELD} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-body">{labels.costUsd}</span>
        <input name="costUsd" type="number" required min="0" step="any" inputMode="decimal" className={FIELD} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-body">{labels.boughtAt}</span>
        <input name="boughtAt" type="date" required min={minDate} max={today} className={FIELD} />
      </label>
      <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-3 lg:col-span-1">
        <span className="text-xs font-semibold text-body">{labels.note}</span>
        <input name="note" maxLength={120} placeholder={labels.notePlaceholder} className={FIELD} />
      </label>
      <div className="col-span-2 flex items-end sm:col-span-1">
        <button
          type="submit"
          disabled={pending}
          className={buttonClass({ size: "md", className: "w-full min-h-11 sm:h-11" })}
        >
          {pending ? labels.adding : labels.add}
        </button>
      </div>
      {state.status === "error" && state.error && (
        <p role="alert" className="col-span-full text-small text-down">
          {labels.errors[state.error]}
        </p>
      )}
    </form>
  );
}

/* --------------------------------------------------------------------------
   Vergi hesaplayıcısına aktarım

   HİÇBİR ŞEY SUNUCUYA GİTMİYOR. Pozisyonlar `sessionStorage`a yazılıyor ve
   `/vergi` açılınca bir kez okunup SİLİNİYOR: sekme kapanınca iz kalmıyor,
   başka bir sekme aynı veriyi ikinci kez almıyor. Hesaplayıcının "hiçbir şey
   saklanmaz" sözü aktarımda da geçerli.
   -------------------------------------------------------------------------- */

export function ExportToTaxButton({
  positions,
  label,
}: {
  positions: TaxHandoffPosition[];
  label: string;
}) {
  const router = useRouter();
  const { href } = useLocaleHref();
  return (
    <button
      type="button"
      disabled={positions.length === 0}
      onClick={() => {
        try {
          window.sessionStorage.setItem(TAX_HANDOFF_KEY, JSON.stringify(positions));
        } catch {
          /* Depo kapalıysa (gizli pencere, engelli site verisi) aktarım
             olmadan açılıyor; hesaplayıcı boş başlar, hiçbir şey kırılmaz. */
        }
        router.push(href("/vergi"));
      }}
      className={buttonClass({ variant: "ghost", size: "md" })}
    >
      <ArrowSquareOut size={16} weight="duotone" aria-hidden />
      {label}
    </button>
  );
}

/* --------------------------------------------------------------------------
   Ekleme panelini açan bağlantı

   Düz çapa (`#pozisyon-ekle`) kapalı `<details>`i açıyordu ama sayfa
   yerinden kıpırdamıyordu: panelin içeriği açılış geçişinin ilk karesinde
   sıfır yükseklikte ve tarayıcı kaydırmayı o kareye göre hesaplıyor
   (ölçüldü: panel açık, alan 1577. pikselde, kaydırma 0). Tıklama paneli
   kendisi açıyor, alana kaydırıyor ve odağı ilk girdiye veriyor.
   JavaScript yoksa çapa eskisi gibi çalışıyor.
   -------------------------------------------------------------------------- */

/** Panelin açılış geçişi — Portfolio.module.css → `.addPanel` ile aynı süre. */
const PANEL_OPEN_MS = 450;
/** Geçişin bittiği kareyle yarışmamak için pay: tam sürede içerik hâlâ gizli olabiliyor. */
const FOCUS_SLACK_MS = 120;

export function AddPanelLink({
  targetId,
  className,
  children,
}: {
  targetId: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`#${targetId}`}
      className={className}
      onClick={(event) => {
        const target = document.getElementById(targetId);
        const panel = target?.closest("details");
        if (!target || !panel) return;
        event.preventDefault();
        panel.open = true;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        /* Kaydırılan PANELİN KENDİSİ, içerik değil: içerik geçiş boyunca
           `content-visibility` ile gizli ve gizli öğeye ne kaydırma ne
           odak gidiyor. Odak geçiş bitince veriliyor. */
        panel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        window.setTimeout(
          () => target.querySelector("input")?.focus({ preventScroll: true }),
          reduce ? 0 : PANEL_OPEN_MS + FOCUS_SLACK_MS,
        );
      }}
    >
      {children}
    </a>
  );
}
