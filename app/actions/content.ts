"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { saveStory, storyInputSchema } from "@/lib/content-write";
import { db } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";
import { storyRevisions } from "@/lib/schema";

/**
 * Panelin içerik yazma eylemleri.
 *
 * HER EYLEMİN İLK SATIRI `requireAdmin()`. Sayfanın kapısına güvenilmez:
 * sunucu eylemleri kendi uç noktalarıdır ve doğrudan çağrılabilirler —
 * `app/actions/watchlist.ts`teki kuralın aynısı, orada da yazılı.
 *
 * DOĞRULAMA VE YAZMA BURADA DEĞİL, `lib/content-write.ts`te. Panel ile
 * rutinin ayrı doğrulama yazması, tam da bu işi bir dönem engelleyen karar
 * kaydının gerekçesiydi; ikisi artık aynı şemayı ve aynı upsert'i
 * kullanıyor.
 */

export type EditorState = {
  ok?: boolean;
  error?: string;
  /** Alan bazlı hata: hangi kutunun kırmızı olacağını söyler. */
  fieldErrors?: Record<string, string>;
  savedAt?: string;
};

/** Formdan gelen ham metinleri şemanın beklediği şekle getirir. */
function toInput(formData: FormData) {
  const metin = (name: string) => String(formData.get(name) ?? "").trim();
  const semboller = metin("symbols")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  /* Kaynaklar satır satır: "Etiket | https://adres". Panelde JSON yazdırmak
     bir editör değil, bir tuzak olurdu — tek bir eksik virgül bütün formu
     reddediyor ve hata mesajı satır numarası veriyor, alan adı değil. */
  const kaynaklar = metin("sources")
    .split("\n")
    .map((satir) => satir.trim())
    .filter(Boolean)
    .map((satir) => {
      const [label, url] = satir.split("|").map((p) => p.trim());
      return url ? { label, url } : { label };
    });

  return {
    slug: metin("slug"),
    title: metin("title"),
    dek: metin("dek"),
    body_md: String(formData.get("body_md") ?? ""),
    event_date: metin("event_date") || undefined,
    locale: metin("locale") || "tr",
    symbols: semboller.length > 0 ? semboller : undefined,
    sources: kaynaklar.length > 0 ? kaynaklar : undefined,
  };
}

function alanHatalari(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const alan = String(issue.path[0] ?? "form");
    if (!out[alan]) out[alan] = issue.message;
  }
  return out;
}

/**
 * Var olan bir mercek yazısını günceller.
 *
 * PANELDEN YENİ YAZI ÜRETİLMİYOR: `slug` formda gizli ve düzenlenmiyor.
 * Yeni yazı rutinin işi; panelin işi düzeltmek. Slug'ı serbest bırakmak,
 * yanlışlıkla ikinci bir kayıt açmanın en kolay yolu olurdu.
 */
export async function saveStoryFromAdmin(
  _prev: EditorState,
  formData: FormData,
): Promise<EditorState> {
  await requireAdmin();

  const parsed = storyInputSchema.safeParse(toInput(formData));
  if (!parsed.success) {
    return {
      error: "Kaydedilmedi — alanlardan biri kurala uymuyor.",
      fieldErrors: alanHatalari(parsed.error),
    };
  }

  try {
    await saveStory(parsed.data, "admin");
  } catch {
    return { error: "Kaydedilemedi — veritabanı yazmayı reddetti." };
  }

  /* Yazının göründüğü HER yol tazeleniyor. Besleme de listede: yarım saat
     önbellekli ve düzeltilen başlık orada eski hâliyle kalırdı. */
  revalidatePath("/mercek");
  revalidatePath(`/mercek/${parsed.data.slug}`);
  revalidatePath("/admin/icerik");
  revalidatePath("/feed.xml");

  return {
    ok: true,
    /* Saat İSTEMCİDE biçimleniyor olsaydı sunucu ile arasında bir kare fark
       olurdu; ISO dize gidiyor, ekran onu okuyucunun saatinde yazıyor. */
    savedAt: new Date().toISOString(),
  };
}


/* --------------------------------------------------------------------------
   Sürümler
   -------------------------------------------------------------------------- */

export type StoryRevision = {
  id: string;
  replacedAt: string;
  replacedBy: string;
  title: string;
  /** Karakter sayısı — hangi sürümün daha dolu olduğu bir bakışta görünsün. */
  length: number;
};

/**
 * Bir yazının önceki hâlleri — en yeniden eskiye.
 *
 * Gövde LİSTEDE TAŞINMIYOR: on sürümün gövdesi birkaç yüz kilobayt eder ve
 * listede yalnızca hangi sürüm olduğunu seçmeye yetecek kadarı gerekiyor.
 * Gövde geri yüklenirken, tek kayıt için okunuyor.
 */
export async function listStoryRevisions(
  slug: string,
  locale: string,
): Promise<StoryRevision[]> {
  await requireAdmin();
  try {
    const rows = await db
      .select({
        id: storyRevisions.id,
        replacedAt: storyRevisions.replacedAt,
        replacedBy: storyRevisions.replacedBy,
        snapshot: storyRevisions.snapshot,
      })
      .from(storyRevisions)
      .where(
        and(eq(storyRevisions.slug, slug), eq(storyRevisions.locale, locale)),
      )
      .orderBy(desc(storyRevisions.replacedAt))
      .limit(10);

    return rows.map((row) => {
      const snap = row.snapshot as { title?: string; bodyMd?: string };
      return {
        id: row.id,
        replacedAt: row.replacedAt.toISOString(),
        replacedBy: row.replacedBy,
        title: snap.title ?? "—",
        length: (snap.bodyMd ?? "").length,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Bir sürümü geri yükler.
 *
 * GERİ YÜKLEME DE NORMAL BİR YAZMA: fotoğraf doğrulama şemasından geçip
 * `saveStory`ye veriliyor. Doğrudan `stories`e yazmak, doğrulamayı atlayan
 * üçüncü bir yol açardı — tam da bu modülün ortadan kaldırdığı şey. Yan
 * etkisi de doğru: geri yükleme, ÜZERİNE YAZDIĞI hâlin fotoğrafını alıyor,
 * yani yanlış bir geri yüklemeden de dönülebiliyor.
 */
export async function restoreStoryRevision(
  _prev: EditorState,
  formData: FormData,
): Promise<EditorState> {
  await requireAdmin();

  const id = String(formData.get("revisionId") ?? "");
  if (!id) return { error: "Sürüm seçilmedi." };

  let snapshot: Record<string, unknown> | null = null;
  try {
    const [row] = await db
      .select({ snapshot: storyRevisions.snapshot })
      .from(storyRevisions)
      .where(eq(storyRevisions.id, id))
      .limit(1);
    snapshot = (row?.snapshot as Record<string, unknown>) ?? null;
  } catch {
    return { error: "Sürüm okunamadı." };
  }
  if (!snapshot) return { error: "Sürüm bulunamadı." };

  const parsed = storyInputSchema.safeParse({
    slug: snapshot.slug,
    title: snapshot.title,
    dek: snapshot.dek,
    body_md: snapshot.bodyMd,
    event_date: snapshot.eventDate,
    locale: snapshot.locale,
    symbols: snapshot.symbols ?? undefined,
    sources: snapshot.sources ?? undefined,
  });
  if (!parsed.success) {
    return { error: "Bu sürüm bugünkü kurallara uymuyor, geri yüklenemedi." };
  }

  try {
    await saveStory(parsed.data, "admin");
  } catch {
    return { error: "Geri yüklenemedi — veritabanı yazmayı reddetti." };
  }

  revalidatePath("/mercek");
  revalidatePath(`/mercek/${parsed.data.slug}`);
  revalidatePath("/admin/icerik");
  revalidatePath("/feed.xml");

  return { ok: true, savedAt: new Date().toISOString() };
}
