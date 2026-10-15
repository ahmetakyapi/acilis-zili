import { ChartBar, GlobeHemisphereWest, Lightbulb, Scales } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { PostTemplateKey } from "@/lib/post-templates";

/**
 * Şablon ikonları — /topluluk rehberi (sunucu) ve editör (istemci) aynı
 * eşlemeyi okur. `dist/ssr` sürümü bağlam okumadığı için iki tarafta da çalışır.
 */
export const TEMPLATE_ICONS: Record<PostTemplateKey, Icon> = {
  tez: Lightbulb,
  bilanco: ChartBar,
  karsilastirma: Scales,
  makro: GlobeHemisphereWest,
};
