"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/primitives";

/** "Kopyalandı" onayının ekranda kaldığı süre. */
const COPIED_MS = 2_000;

/**
 * Gömme kodu + Kodu Kopyala düğmesi (Hakkında → Sitene Ekle).
 *
 * Kod SUNUCUDA üretiliyor ve burada yalnızca gösterilip kopyalanıyor; adres
 * `SITE_URL`den geliyor, tarayıcının `location`ından değil (paylaş
 * düğmesindeki gerekçe: okuyucunun sorgusu ve çapası koda sızmasın).
 *
 * Kopyalama iki yollu, `ShareButton` ile aynı: önce Pano API'si, izin
 * verilmezse gizli metin alanı. İkisi de olmazsa kod zaten ekranda, seçilip
 * elle kopyalanabilir (`select-all`).
 */
export function EmbedSnippet({
  code,
  label,
  copyLabel,
  copiedLabel,
}: {
  code: string;
  /** Kod bloğunun erişilebilir adı: "Açılış Geri Sayımı için gömme kodu". */
  label: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      return;
    } catch {
      /* Pano API'si güvenli bağlam ve izin istiyor; eski yol deneniyor. */
    }
    try {
      const area = document.createElement("textarea");
      area.value = code;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      setCopied(true);
    } catch {
      /* Yapacak bir şey yok; kod ekranda ve seçilebilir. */
    }
  }, [code]);

  return (
    <div className="flex flex-col gap-2">
      {/* Kaydırılabilir kod kutusu klavyeyle de odaklanabiliyor (WCAG
          2.1.1, tablo kaplarındaki kuralın aynısı). */}
      <pre
        tabIndex={0}
        aria-label={label}
        className="numeral max-w-full select-all overflow-x-auto rounded-md border border-line bg-surface-sunken px-3 py-2.5 text-tiny leading-relaxed text-strong"
      >
        <code>{code}</code>
      </pre>
      <div className="flex items-center gap-3">
        <button type="button" onClick={copy} className={buttonClass({ variant: "ghost", size: "sm" })}>
          {copied ? <Check aria-hidden size={14} weight="bold" /> : <Copy aria-hidden size={14} />}
          {copied ? copiedLabel : copyLabel}
        </button>
        {/* Sonuç ekran okuyucuya da duyuruluyor; görünür metin zaten düğmede. */}
        <span className="sr-only" role="status">
          {copied ? copiedLabel : ""}
        </span>
      </div>
    </div>
  );
}
