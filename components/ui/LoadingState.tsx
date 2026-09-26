import type { ReactNode } from "react";
import { InkCanvas } from "@/components/ink/InkCanvas";

/** One brand mark for route, filter, and chart loading. No progress percent:
 * provider requests do not expose how much work remains.
 *
 * EL ÇİZİMİ ZİL (26 Eylül). İşaret mavi degrade karonun içinde çalan bir
 * zildi (BellLoader); sitenin geri kalanı — açılış, boş durumlar, sayfa
 * geçişleri — mürekkeple konuşurken bekleme anı bir uygulama ikonu gibi
 * duruyordu. Artık aynı karakter: zil mürekkeple kendini çiziyor, bekleme
 * sürdükçe sallanıp çalıyor (lib/ink/scenes.ts → ringing). Bu sahnelerden
 * DÖNEN tek sahne: bekleme göstergesi iş bitene kadar "çalışıyor" demeli
 * ve iş bitince kendiliğinden kalkıyor. Hareketi azaltan okuyucuya çizilmiş
 * zil durağan basılıyor. */
export function LoadingMark({ label, compact = false }: { label?: string; compact?: boolean }) {
  return <div className={`route-loader-card${compact ? " loading-mark-compact" : ""}`} role={label ? "status" : undefined} aria-live={label ? "polite" : undefined} aria-hidden={!label || undefined}>
    <span aria-hidden className="route-loader-mark"><InkCanvas scene="ringing" seed={17} className="size-full" /></span>
    {label && <span className="route-loader-label">{label}</span>}
  </div>;
}

export function LoadingSurface({ label }: { label?: string }) {
  return <div className="loading-surface">
    <div className="loading-surface-lines" aria-hidden />
    <div className="loading-surface-status"><LoadingMark label={label} compact /></div>
  </div>;
}

/** Keeps the existing, measured skeleton structure, adding the same mark. */
export function LoadingFallback({ label, children }: { label: string; children: ReactNode }) {
  return <div className="loading-fallback" aria-busy="true">
    <div className="loading-fallback-content" aria-hidden>{children}</div>
    <div className="loading-fallback-status"><LoadingMark label={label} compact /></div>
  </div>;
}
