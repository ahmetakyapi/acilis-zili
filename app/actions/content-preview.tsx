"use server";

import { requireAdmin } from "@/lib/admin";
import { ArticleBody } from "@/components/article/ArticleBody";
import { BriefBody } from "@/components/today/BriefBody";
import { isLocale } from "@/lib/i18n/config";

/**
 * Taslağın ÖNİZLEMESİ — sunucuda çizilip JSX olarak dönüyor.
 *
 * NEDEN İSTEMCİDE ÇİZİLMİYOR: `ArticleBody` sitenin markdown çözümleyicisi
 * ve kendi başlık yorumunda yazılı olduğu gibi "sayfada tek bir markdown
 * kütüphanesi bile ~30KB istemci paketi demek". Canlı bir istemci
 * önizlemesi, 1200 satırlık çözümleyiciyi ve içindeki `ArticleChart`ı
 * yönetim paneline indirirdi — panel bir araç, ama bedeli okuyucunun
 * paketine yazılmasa da geliştirme ve bakım maliyeti gerçek.
 *
 * Sunucu eylemi JSX döndürebiliyor: bileşen sunucuda çiziliyor, istemciye
 * yalnızca çizilmiş RSC yükü iniyor. Önizleme böylece YAYINDAKİ ÇİZİMİN
 * KENDİSİ oluyor — ayrı bir önizleme çizici yazmak, ikinci bir markdown
 * yorumu demekti ve iki çizici er geç ayrı düşerdi. Bir `:::` bloğu burada
 * nasıl görünüyorsa sitede de öyle görünür.
 *
 * Yetki kontrolü BURADA DA: sunucu eylemleri kendi uç noktalarıdır.
 */
export async function previewStoryBody(markdown: string, locale: string) {
  await requireAdmin();
  const dil = isLocale(locale) ? locale : "tr";
  return <ArticleBody markdown={markdown} locale={dil} chartPlaceholder />;
}

/**
 * Bülten taslağının önizlemesi.
 *
 * Mercekten AYRI BİR ÇİZİCİ, çünkü bülten ayrı bir biçimlendiriciyle
 * yazılıyor: `BriefBody` tam markdown değil, brifingin kullandığı alt küme
 * (kalın, "- " maddesi, `## Başlık`) ve maddeleri 01/02/03 diye numaralıyor.
 * Aynı metni `ArticleBody`ye vermek, sitede görünmeyen bir çizim gösterirdi.
 *
 * `collapsible={false}`: katlama okuyucu için, editör için değil — yazının
 * tamamı görünmeli. `size="page"` de bülten sayfasının kendi ölçüsü.
 */
export async function previewBriefBody(markdown: string) {
  await requireAdmin();
  return <BriefBody markdown={markdown} collapsible={false} size="page" />;
}
