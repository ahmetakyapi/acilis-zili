import {
  ArrowsLeftRight,
  Bank,
  CalendarCheck,
  ChartLineUp,
  IdentificationBadge,
  Receipt,
  Scales,
  SquaresFour,
  Target,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { GlossaryCategoryKey } from "@/content/glossary";

/**
 * Sözlük kategorilerinin simgeleri — dizindeki kutucuklar, bölüm başlıkları
 * ve terim sayfasının künyesi aynı haritayı okuyor.
 *
 * `dist/ssr` girişi: simgeler bağlam (context) okumuyor, yani hem sunucu
 * sayfasında hem istemci dizininde aynı modül çalışıyor; iki ayrı harita
 * tutup birinin öbüründen kaymasına gerek kalmıyor.
 *
 * Simge kategoriyi AYIRT ETTİRİR, renk değil: sekiz kategoriye sekiz renk
 * vermek, sitenin "renk yalnızca yön ve etkileşim" kuralını bozardı.
 */
export const GLOSSARY_CATEGORY_ICONS: Record<GlossaryCategoryKey, Icon> = {
  degerleme: Scales,
  piyasa: ArrowsLeftRight,
  makro: Bank,
  teknik: ChartLineUp,
  bilanco: CalendarCheck,
  opsiyon: Target,
  vergi: Receipt,
  iceriden: IdentificationBadge,
};

/** "Tümü" kutucuğunun simgesi. */
export const GLOSSARY_ALL_ICON: Icon = SquaresFour;
