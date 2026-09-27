/* ==========================================================================
   Sözlük — İngilizce metinler

   Kategori dosyaları tek bir kayıtta birleşiyor. Tip `Record<GlossarySlug,
   GlossaryText>`: bir kategori dosyası eksik ya da bir terim unutulmuşsa
   derleme burada kırılır.
   ========================================================================== */

import type { GlossarySlug, GlossaryText } from "./meta";
import { EN_DEGERLEME } from "./en/degerleme";
import { EN_PIYASA } from "./en/piyasa";
import { EN_MAKRO } from "./en/makro";
import { EN_TEKNIK } from "./en/teknik";
import { EN_BILANCO } from "./en/bilanco";
import { EN_OPSIYON } from "./en/opsiyon";
import { EN_VERGI } from "./en/vergi";
import { EN_ICERIDEN } from "./en/iceriden";

export const GLOSSARY_EN: Record<GlossarySlug, GlossaryText> = {
  ...EN_DEGERLEME,
  ...EN_PIYASA,
  ...EN_MAKRO,
  ...EN_TEKNIK,
  ...EN_BILANCO,
  ...EN_OPSIYON,
  ...EN_VERGI,
  ...EN_ICERIDEN,
};
