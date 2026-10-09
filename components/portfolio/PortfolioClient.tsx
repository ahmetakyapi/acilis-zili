"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowCounterClockwise, ArrowSquareOut } from "@phosphor-icons/react";
import { undoSaleAction } from "@/app/actions/portfolio";
import { useLocaleHref } from "@/components/layout/useLocaleHref";
import { buttonClass } from "@/components/ui/primitives";
import { TAX_HANDOFF_KEY, type TaxHandoffPosition } from "@/lib/portfolio";
import { useWorkbench } from "./PortfolioWorkbench";

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

/**
 * Satışı geri al — partiler pozisyonlara döner (`undoSaleAction`). Sonuç
 * iş masasının bildiriminde; eylem fırlatırsa da (ağ, eski sekme) bildirim
 * hata diyor, düğme takılı kalmıyor.
 */
export function UndoSaleButton({
  saleId,
  label,
  aria,
  done,
}: {
  saleId: string;
  symbol: string;
  label: string;
  aria: string;
  done: string;
}) {
  const { notify, labels } = useWorkbench();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label={aria}
      title={aria}
      aria-disabled={pending}
      onClick={() => {
        if (pending) return;
        startTransition(async () => {
          let ok = false;
          try {
            ok = (await undoSaleAction(saleId)).status === "saved";
          } catch {
            ok = false;
          }
          notify(ok ? { message: done } : { message: labels.toastFailed, tone: "error" });
        });
      }}
      className={buttonClass({ variant: "quiet", size: "sm", className: "gap-1.5" })}
    >
      <ArrowCounterClockwise size={14} weight="bold" aria-hidden />
      {label}
    </button>
  );
}
