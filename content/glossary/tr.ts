/* ==========================================================================
   Sözlük — Türkçe metinler

   Kategori dosyaları tek bir kayıtta birleşiyor. Tip `Record<GlossarySlug,
   GlossaryText>`: bir kategori dosyası eksik ya da bir terim unutulmuşsa
   derleme burada kırılır.
   ========================================================================== */

import type { GlossarySlug, GlossaryText } from "./meta";
import { TR_DEGERLEME } from "./tr/degerleme";
import { TR_PIYASA } from "./tr/piyasa";
import { TR_MAKRO } from "./tr/makro";
import { TR_TEKNIK } from "./tr/teknik";
import { TR_BILANCO } from "./tr/bilanco";
import { TR_OPSIYON } from "./tr/opsiyon";
import { TR_VERGI } from "./tr/vergi";
import { TR_ICERIDEN } from "./tr/iceriden";

export const GLOSSARY_TR: Record<GlossarySlug, GlossaryText> = {
  ...TR_DEGERLEME,
  ...TR_PIYASA,
  ...TR_MAKRO,
  ...TR_TEKNIK,
  ...TR_BILANCO,
  ...TR_OPSIYON,
  ...TR_VERGI,
  ...TR_ICERIDEN,
};
