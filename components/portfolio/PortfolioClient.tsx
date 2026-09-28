"use client";

import { useRouter } from "next/navigation";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { useLocaleHref } from "@/components/layout/useLocaleHref";
import { buttonClass } from "@/components/ui/primitives";
import { TAX_HANDOFF_KEY, type TaxHandoffPosition } from "@/lib/portfolio";

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
