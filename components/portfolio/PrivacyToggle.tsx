"use client";

import { useSyncExternalStore } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/primitives";
import { PRIVACY_ATTR, privacyCookieLine } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import styles from "./PrivacyToggle.module.css";

/**
 * TUTARLARI GİZLE — anahtar (10 Kasım; sözleşme `lib/privacy.ts`).
 *
 * TEK DOĞRULUK KAYNAĞI `<html data-privacy>` — tema denetiminin deseni
 * (`components/layout/preference-controls.tsx`): sunucu özniteliği
 * çerezden basar, tıklama özniteliği DOM'a anında yazar, bileşen
 * özniteliği dinleyerek çizer. Sayfada iki anahtar olsa da (panel + başlık)
 * ikisi aynı anda döner; React durumu yok, yeniden çizim yok — maske CSS'te.
 *
 * Erişilebilir ad SABİT ("Tutarları Gizle") ve durumu `aria-pressed`
 * söyler; görünen ipucu (`title`) basılıyken "Tutarları Göster" der. Ad
 * durumla değişseydi ekran okuyucu "Tutarları Göster, basılı" gibi çelişik
 * bir cümle okurdu.
 *
 * `compact`: panel başlığındaki ikon düğme (görünür 36, hedef 44 —
 * `.tap-44`); geniş hâl sayfa başlığındaki etiketli düğme (`md`, telefonda
 * 44 yüksekliğinde).
 */
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [PRIVACY_ATTR] });
  return () => observer.disconnect();
}
const read = () => document.documentElement.hasAttribute(PRIVACY_ATTR);

export function PrivacyToggle({
  initial,
  labels,
  compact = false,
  className,
}: {
  /** Sunucunun çerezden okuduğu durum — hidrasyon bununla eşleşir. */
  initial: boolean;
  labels: { hide: string; show: string };
  compact?: boolean;
  className?: string;
}) {
  const on = useSyncExternalStore(subscribe, read, () => initial);
  const toggle = () => {
    const next = !read();
    document.documentElement.toggleAttribute(PRIVACY_ATTR, next);
    document.cookie = privacyCookieLine(next, window.location.protocol === "https:");
  };
  const Icon = on ? EyeSlash : Eye;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={compact ? labels.hide : undefined}
      title={on ? labels.show : labels.hide}
      onClick={toggle}
      data-privacy-toggle
      className={cn(
        buttonClass({ variant: compact ? "quiet" : "ghost", size: compact ? "icon" : "md" }),
        styles.hit,
        on && "border-line-strong bg-surface-sunken text-strong",
        compact && "text-muted",
        className,
      )}
    >
      <Icon size={compact ? 18 : 16} weight={on ? "fill" : "duotone"} aria-hidden />
      {/* Telefonda etiket görünmez (ad yine bu metin): 390'da "Diğer" menüsü
          etiketli anahtarla ikinci satıra düşüyordu (ölçüldü). */}
      {!compact && <span className="max-sm:sr-only">{labels.hide}</span>}
    </button>
  );
}
