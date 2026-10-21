"use server";

import { auth } from "@/auth";
import { ArticleBody } from "@/components/article/ArticleBody";
import editorial from "@/components/article/ArticleEditorial.module.css";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Kullanıcı yazısının ÖNİZLEMESİ — previewStoryBody'nin oturumlu eşi.
 * Gerekçe app/actions/content-preview.tsx: önizleme yayındaki çizimin
 * KENDİSİ olmalı, ikinci bir markdown yorumu er geç ayrı düşer.
 *
 * Buradaki kapı requireAdmin DEĞİL auth: editör her üyeye açık. Oran
 * kovası var — önizleme her duraklamada çağrılıyor (700 ms debounce) ve
 * sunucuda 1200 satırlık çözümleyiciyi koşturuyor.
 *
 * `chartPlaceholder`: ::: grafik bloğunun istemci bileşeni sunucu eyleminin
 * istemci manifestinde yok — gerçek grafik "Client Manifest" hatasıyla
 * düşer (content-preview'daki tuzak kaydı).
 *
 * `locale` YAZININ dili (20 Ekim). Sabit "tr" çiziliyordu, yayındaki sayfa
 * ise `post.locale` ile: İngilizce yazıda etiketsiz `::: ozet` önizlemede
 * "Özet", yayında "Summary" oluyor, tablo başlıklarının büyük harfi de
 * Türkçe kuralla (i → İ) çiziliyordu. Eylem dışarıdan çağrılabildiği için
 * değer süzülür.
 */
export async function previewUserPostBody(markdown: string, locale: unknown) {
  const session = await auth();
  /* Sessiz null DEĞİL fırlatma: useOnizleme hatayı yakalayıp "Çizilemedi"
     yazıyor; null dönseydi panel boşalır ve durum "Güncel" derdi
     (15 Ekim incelemesi). */
  if (!session?.user?.id) throw new Error("oturum-yok");
  if (!rateLimit(`post-preview:${session.user.id}`, 30, 60_000).allowed)
    throw new Error("cok-sik");
  if (typeof markdown !== "string" || markdown.length > 40_000) throw new Error("sinir");
  return (
    <ArticleBody
      markdown={markdown}
      locale={locale === "en" ? "en" : "tr"}
      chartPlaceholder
      variant="editorial"
      className={editorial.prose}
    />
  );
}
