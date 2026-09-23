import { cn } from "@/lib/utils";

/**
 * Kavramın kendi notasyonunu taşıyan karo — σ, ETF, 4×, EPS.
 *
 * Marka karosuyla aynı zemin, kenar ve gölgeyi kullanır: rehber sayfası
 * ürünün geri kalanından kopuk bir "blog" gibi durmasın diye. Mürekkep
 * `--mark-ink`, `--on-primary` değil — o koyu temada koyu lacivert ve
 * lacivert karoda işaret kayboluyordu. İkon
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
        "flex shrink-0 items-center justify-center font-bold tracking-[-0.02em]",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: size / 3,
        background: "var(--mark-gradient)",
        boxShadow: "var(--mark-shadow), inset 0 0 0 1px var(--mark-edge)",
        color: "var(--mark-ink)",
        fontSize,
      }}
    >
      {glyph}
    </span>
  );
}
