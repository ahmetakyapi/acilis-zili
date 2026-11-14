"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Check, Copy } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/** "Kopyalandı" onayının ekranda kaldığı süre (EmbedSnippet ile aynı). */
const COPIED_MS = 2_000;

/**
 * "Takvime Abone Ol" — canlı `.ics` akışının (`/api/takvim/akis`) girişi
 * (14 Kasım 2026). İki ekranda aynı satır: `/takvim` (makro akışı) ve
 * `/bilancolar/takip` (okurun takip listesiyle kurulan bilanço akışı).
 *
 * İKİ EYLEM, ÇÜNKÜ İKİ TAKVİM İKİ AYRI YOLDAN ABONE OLUYOR. `webcal://`
 * bağlantısı işletim sisteminin takvim uygulamasını açar (Apple Takvim,
 * Outlook); Google Takvim o şemayı tanımaz, adres "URL ile" alanına
 * yapıştırılır — "Adresi Kopyala" bunun için ve `https://` adresini
 * kopyalar. İpucu cümlesi bunu söylüyor.
 *
 * Adresler SUNUCUDA kurulur (`feedUrls`, `SITE_URL`den); burada yalnızca
 * gösterilip kopyalanır, tarayıcının `location`ı okunmaz. `webcal:`
 * bağlantısı `RouteProgress` şeridini başlatmaz: şerit yalnız aynı kökenli
 * adreslerde çalışıyor (components/layout/RouteProgress.tsx).
 *
 * Yeni görsel dil yok: iki buton da `buttonClass` (ghost + quiet, `sm`).
 * Kopyalama `EmbedSnippet` ile aynı iki yol: Pano API'si, olmazsa gizli
 * metin alanı.
 */
export function CalendarSubscribe({
  webcal,
  https,
  labels,
  hint,
  className,
}: {
  /** `webcal://…` — takvim uygulamasını açan bağlantı. */
  webcal: string;
  /** `https://…` — kopyalanan adres. */
  https: string;
  labels: { subscribe: string; copy: string; copied: string };
  /** Bağlantının ne yaptığını söyleyen tek cümle. */
  hint: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(https);
      setCopied(true);
      return;
    } catch {
      /* Pano API'si güvenli bağlam ve izin istiyor; eski yol deneniyor. */
    }
    try {
      const area = document.createElement("textarea");
      area.value = https;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      setCopied(true);
    } catch {
      /* Yapacak bir şey yok; abone ol bağlantısı yine çalışır. */
    }
  }, [https]);

  return (
    <div className={cn("flex flex-col gap-2", className)} data-calendar-subscribe>
      <div className="flex flex-wrap items-center gap-2">
        <a href={webcal} rel="nofollow" className={buttonClass({ variant: "ghost", size: "sm" })}>
          <CalendarPlus aria-hidden size={14} weight="duotone" />
          {labels.subscribe}
        </a>
        <button type="button" onClick={copy} className={buttonClass({ variant: "quiet", size: "sm" })}>
          {copied ? <Check aria-hidden size={14} weight="bold" /> : <Copy aria-hidden size={14} />}
          {copied ? labels.copied : labels.copy}
        </button>
        {/* Sonuç ekran okuyucuya da duyuruluyor; görünür metin zaten butonda. */}
        <span className="sr-only" role="status">
          {copied ? labels.copied : ""}
        </span>
      </div>
      <p className="m-0 max-w-[80ch] text-small leading-normal text-muted">{hint}</p>
    </div>
  );
}
