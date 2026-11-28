/**
 * Yarım ay ölçerin yayı — sol uçtan (pay 0) sağ uca (pay 1), üst yarım daire.
 *
 * Tek kaynak (28 Kasım 2026): aynı açı hesabı Piyasa Genişliği
 * (`components/markets/IndexSelection.tsx`) ve ana sayfanın sektör ölçeri
 * (`components/today/home/MarketTexture.tsx`) içinde ayrı ayrı yazılmıştı.
 * Piyasa Nabzı (`SentimentPulse`) 0–100 puan ekseninde kendi geometrisini
 * taşıyor; aynı yay, ama ölçeği puan.
 */
export type HalfArc = { cx: number; cy: number; r: number };

/** Paya (0–1) düşen nokta; pay sınırların dışındaysa kırpılır. */
export function halfArcPoint(arc: HalfArc, share: number): { x: number; y: number } {
  const clamped = Math.min(1, Math.max(0, share));
  const angle = Math.PI * (1 - clamped);
  return { x: arc.cx + arc.r * Math.cos(angle), y: arc.cy - arc.r * Math.sin(angle) };
}

/** `from` → `to` paylarını saat yönünde çizen SVG yolu (iki ondalık). */
export function halfArcPath(arc: HalfArc, from: number, to: number): string {
  const a = halfArcPoint(arc, from);
  const b = halfArcPoint(arc, to);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${arc.r} ${arc.r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}
