import type { ReactNode } from "react";
import { BellMark } from "@/components/brand/BellMark";

/** One brand mark for route, filter, and chart loading. No progress percent:
 * provider requests do not expose how much work remains. */
export function LoadingMark({ label, compact = false }: { label?: string; compact?: boolean }) {
  return <div className={`route-loader-card${compact ? " loading-mark-compact" : ""}`} role={label ? "status" : undefined} aria-live={label ? "polite" : undefined} aria-hidden={!label || undefined}>
    <span aria-hidden className="route-loader-mark"><BellMark size={compact ? 26 : 34} className="route-loader-bell" /></span>
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
