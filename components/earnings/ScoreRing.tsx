import type React from "react";
import { cn } from "@/lib/utils";
import { verdictStroke, type VerdictKey } from "@/lib/analysis";

/**
 * 0–100 skor halkası.
 *
 * Sayı SVG `<text>` değil, üstüne bindirilmiş HTML katmanı: SVG metni font
 * yüklenene kadar ölçüsüz kalıyor ve halkanın içinde kayıyordu. HTML katmanı
 * aynı yazı tipini sayfanın geri kalanıyla birlikte alıyor.
 *
 * Renk tek başına anlam taşımasın diye halka hiçbir yerde yalnız durmuyor —
 * yanında ya da altında daima AL/TUT/SAT yazısı var.
 */
export function ScoreRing({
  score,
  verdict,
  size = 64,
  showDenominator = false,
  className,
}: {
  score: number;
  verdict: VerdictKey;
  size?: number;
  /** "/ 100" alt satırı — yalnızca 60px üstü halkalarda okunuyor. */
  showDenominator?: boolean;
  className?: string;
}) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className="block"
        aria-hidden
      >
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="6"
        />
        {/* Halka kendini çiziyor — kural globals.css → .ring-fill. Çevre CSS
            değişkeniyle geçiyor ki keyframe ölçmeden başlangıç ofsetini bilsin. */}
        <circle
          className="ring-fill"
          style={{ "--ring-circumference": circumference } as React.CSSProperties}
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={verdictStroke(verdict)}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(1)} ${circumference.toFixed(1)}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="figure font-bold leading-none text-strong"
          style={{ fontSize: Math.round(size * 0.27) }}
        >
          {score}
        </span>
        {showDenominator && (
          <span className="mt-px text-micro font-semibold text-muted">
            / 100
          </span>
        )}
      </div>
    </div>
  );
}
