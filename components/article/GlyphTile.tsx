import { cn } from "@/lib/utils";

/**
 * Kavramın kendi notasyonunu taşıyan karo — σ, ETF, 4×, EPS.
 *
 * Marka karosuyla aynı gradient ve gölgeyi kullanır: rehber sayfası
 * ürünün geri kalanından kopuk bir "blog" gibi durmasın diye. İkon
 * kütüphanesi kasten kullanılmadı; bir kavramı en iyi kendi işareti anlatır
 * ve genel amaçlı bir ikon seti burada hep yaklaşık kalıyor.
 */
export function GlyphTile({
  glyph,
  size = 52,
  className,
}: {
  glyph: string;
  size?: number;
  className?: string;
}) {
  // Uzun işaretler (ETF, EPS, Fed) küçülür ki karo taşmasın.
  const fontSize =
    glyph.length >= 3 ? size * 0.28 : glyph.length === 2 ? size * 0.36 : size * 0.46;

  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center font-bold tracking-[-0.02em]",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        background: "var(--mark-gradient)",
        boxShadow: "var(--mark-shadow)",
        color: "var(--on-primary)",
        fontSize,
      }}
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          boxShadow:
            "inset 0 1px 0 rgb(255 255 255 / 0.32), inset 0 0 0 1px rgb(255 255 255 / 0.1)",
        }}
      />
      <span className="relative">{glyph}</span>
    </span>
  );
}
