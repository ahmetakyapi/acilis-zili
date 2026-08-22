"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  LinkSimple,
  LinkedinLogo,
  Share,
  WhatsappLogo,
  XLogo,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   Paylaş — yazının kendi düğmesi.

   İKİ AYRI DÜNYA, TEK DÜĞME. Telefonda paylaşmanın doğru yolu işletim
   sisteminin kendi sayfası: okuyucunun WhatsApp'ı, Notlar'ı, AirDrop'u orada
   ve biz onun hangisini kullandığını bilemeyiz. `navigator.share` varsa
   düğme doğrudan onu açar — bizim çizdiğimiz hiçbir liste o sayfadan iyi
   olamaz.

   Masaüstünde o sayfa çoğu tarayıcıda yok ve tek başına "bağlantı
   kopyalandı" zayıf bir cevap: okuyucu yazıyı bir yere GÖNDERMEK istiyor.
   Bu yüzden orada küçük bir panel açılıyor — üç hedef ve bağlantıyı kopyala.

   ADRES SUNUCUDAN GELİYOR, `window.location`dan değil. Paylaşılan bağlantı
   sayfanın CANONICAL adresi olmalı: adres çubuğunda ne varsa onu kopyalamak,
   yazının bağlantısına `?sembol=` gibi filtre kalıntılarını ve çapa
   parçalarını da iliştiriyor. Sunucu zaten dili biliyor ve o dilin adresini
   üretiyor (`absoluteUrl`) — Türkçe okuyan `/mercek/...`, İngilizce okuyan
   `/en/mercek/...` paylaşıyor.
   -------------------------------------------------------------------------- */

export type ShareLabels = {
  /** Düğmenin kendi metni — "Paylaş". */
  action: string;
  /** Panelin başlığı — "Bu Yazıyı Paylaş". */
  title: string;
  copyLink: string;
  copied: string;
  onX: string;
  onLinkedIn: string;
  onWhatsApp: string;
};

/** "Kopyalandı" onayının ekranda kalma süresi. */
const COPIED_MS = 2400;

export function ShareButton({
  url,
  title,
  labels,
  className,
}: {
  /** Yazının tam adresi — sunucudan, dili taşıyan canonical hâliyle. */
  url: string;
  /** Paylaşım metnindeki başlık — yazının kendi manşeti. */
  title: string;
  labels: ShareLabels;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      return;
    } catch {
      /* Pano API'si yalnızca güvenli bağlamda ve izin verildiğinde çalışıyor;
         reddedildiğinde okuyucuya sessizce hiçbir şey olmamış gibi
         görünmesin diye eski yol deneniyor. */
    }
    try {
      const area = document.createElement("textarea");
      area.value = url;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
      setCopied(true);
    } catch {
      /* İkisi de olmadıysa yapacak bir şey yok — adres zaten çubukta. */
    }
  }, [url]);

  const onClick = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        /* Okuyucu vazgeçtiyse hiçbir şey açılmaz — panel açmak, kapattığı
           şeyi başka biçimde geri getirmek olurdu. */
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    setOpen(true);
  }, [open, title, url]);

  const encoded = encodeURIComponent(url);
  const targets = [
    {
      key: "x",
      href: `https://x.com/intent/post?url=${encoded}&text=${encodeURIComponent(title)}`,
      icon: XLogo,
      label: labels.onX,
    },
    {
      key: "linkedin",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
      icon: LinkedinLogo,
      label: labels.onLinkedIn,
    },
    {
      key: "whatsapp",
      href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
      icon: WhatsappLogo,
      label: labels.onWhatsApp,
    },
  ] as const;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          /* Yanındaki "Mercek'e Dön" bağlantısıyla aynı ağırlıkta duruyor:
             ikisi de yazının çevresindeki sessiz denetimler, hiçbiri
             metinden önce görülmemeli. Dokunma hedefi yine de 32px. */
          "-my-2 inline-flex min-h-8 items-center gap-1.5 rounded-md py-2 pl-2 pr-2.5 text-small font-semibold transition-colors",
          copied
            ? "text-up"
            : "text-muted hover:bg-primary-tint hover:text-primary",
        )}
      >
        {copied ? (
          <Check weight="bold" size={13} aria-hidden />
        ) : (
          <Share weight="bold" size={13} aria-hidden />
        )}
        {copied ? labels.copied : labels.action}
      </button>

      {open && (
        <>
          <span
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="dialog"
            aria-label={labels.title}
            className="absolute right-0 top-[calc(100%+8px)] z-20 w-[236px] overflow-hidden rounded-xl border border-line bg-overlay-surface shadow-(--shadow-overlay)"
          >
            <p className="plate border-b border-line-soft px-4 py-2.5 text-micro tracking-[0.09em]">
              {labels.title}
            </p>
            <div className="flex flex-col p-2">
              {targets.map((target) => {
                const Icon = target.icon;
                return (
                  <a
                    key={target.key}
                    href={target.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={() => setOpen(false)}
                    className="flex min-h-10 items-center gap-2.5 rounded-md px-2 text-base font-semibold text-strong transition-colors hover:bg-surface"
                  >
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-wash text-primary-ink"
                    >
                      <Icon weight="bold" size={14} />
                    </span>
                    {target.label}
                  </a>
                );
              })}
              <button
                type="button"
                onClick={() => void copy()}
                className="flex min-h-10 items-center gap-2.5 rounded-md px-2 text-left text-base font-semibold text-strong transition-colors hover:bg-surface"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md",
                    copied
                      ? "bg-up-wash text-up"
                      : "bg-primary-wash text-primary-ink",
                  )}
                >
                  {copied ? (
                    <Check weight="bold" size={14} />
                  ) : (
                    <LinkSimple weight="bold" size={14} />
                  )}
                </span>
                {copied ? labels.copied : labels.copyLink}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Kopyalama görsel bir değişiklik: ekran okuyucu onu ancak
          duyurulursa fark eder. */}
      <span aria-live="polite" className="sr-only">
        {copied ? labels.copied : ""}
      </span>
    </div>
  );
}
