import {
  Bank,
  Basket,
  Broadcast,
  Buildings,
  Cpu,
  Cube,
  Factory,
  FirstAidKit,
  GasPump,
  Lightning,
  ShoppingBag,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

/**
 * Sektör fonlarının simgeleri — Günün Grafiği'nin satırları (25 Ekim).
 *
 * Sitede sektör için bir simge eşlemesi yoktu: poster sahnesi sektörü
 * sırayla ve adla ayırıyor. Grafikte on bir satır alt alta durduğunda
 * simge satırı adından önce tanıtıyor; renk değil biçim ayırt ettiriyor
 * (renk yalnız yön, sözlüğün kategori simgeleriyle aynı ilke —
 * `components/glossary/category-icons.ts`). `dist/ssr` girişi: simgeler
 * bağlam okumuyor, sunucu bileşeninde de çalışıyor.
 *
 * Anahtar `SECTOR_FUNDS`taki fon sembolü; adı fona çeviren
 * `sectorFundOf` (`lib/daily-chart-figure.ts`).
 */
export const SECTOR_ICONS: Readonly<Record<string, Icon>> = {
  XLK: Cpu,
  XLF: Bank,
  XLV: FirstAidKit,
  XLY: ShoppingBag,
  XLP: Basket,
  XLE: GasPump,
  XLI: Factory,
  XLB: Cube,
  XLU: Lightning,
  XLRE: Buildings,
  XLC: Broadcast,
};
