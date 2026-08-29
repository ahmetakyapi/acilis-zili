"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import {
  briefInputSchema,
  briefRevisionKey,
  saveBrief,
  saveStory,
  storyInputSchema,
} from "@/lib/content-write";
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
 * Mercek yazısının göründüğü her yol.
 *
 * BESLEME DE LİSTEDE: `/feed.xml` yarım saat önbellekli ve düzeltilen bir
 * başlık orada eski hâliyle kalırdı. Panelin iki ekranı da tazeleniyor —
 * yazı listesi Yazılar'da, sayımlar ve eksik listesi İçerik'te.
 */
function mercegiTazele(slug: string) {
  revalidatePath("/mercek");
  revalidatePath(`/mercek/${slug}`);
  revalidatePath("/feed.xml");
  revalidatePath("/admin/yazilar");
  revalidatePath("/admin/icerik");
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

  mercegiTazele(parsed.data.slug);

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
 * Bir kaydın önceki hâlleri — en yeniden eskiye.
 *
 * ANAHTAR MERCEKTE SLUG, BÜLTENDE `bulten:tarih:donem`. İki içerik türü aynı
 * tabloyu paylaşıyor; gerekçe `lib/content-write.ts` içindeki `fotografAl`da.
 *
 * Gövde LİSTEDE TAŞINMIYOR: on sürümün gövdesi birkaç yüz kilobayt eder ve
 * listede yalnızca hangi sürüm olduğunu seçmeye yetecek kadarı gerekiyor.
 * Gövde geri yüklenirken, tek kayıt için okunuyor. Başlık iki şemada iki ayrı
 * alan (`title` / `headline`) — hangisi doluysa o okunuyor.
 */
async function surumleriOku(
  key: string,
  locale: string,
): Promise<StoryRevision[]> {
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
        and(eq(storyRevisions.slug, key), eq(storyRevisions.locale, locale)),
      )
      .orderBy(desc(storyRevisions.replacedAt))
      .limit(10);

    return rows.map((row) => {
      const snap = row.snapshot as {
        title?: string;
        headline?: string;
        bodyMd?: string;
      };
      return {
        id: row.id,
        replacedAt: row.replacedAt.toISOString(),
        replacedBy: row.replacedBy,
        title: snap.title ?? snap.headline ?? "—",
        length: (snap.bodyMd ?? "").length,
      };
    });
  } catch {
    return [];
  }
}

export async function listStoryRevisions(
  slug: string,
  locale: string,
): Promise<StoryRevision[]> {
  await requireAdmin();
  return surumleriOku(slug, locale);
}

/** Formdaki sürüm kimliğinin fotoğrafı — iki geri yükleme de bunu okuyor. */
async function fotografOku(
  formData: FormData,
): Promise<
  { ok: true; snapshot: Record<string, unknown> } | { ok: false; hata: string }
> {
  const id = String(formData.get("revisionId") ?? "");
  if (!id) return { ok: false, hata: "Sürüm seçilmedi." };
  try {
    const [row] = await db
      .select({ snapshot: storyRevisions.snapshot })
      .from(storyRevisions)
      .where(eq(storyRevisions.id, id))
      .limit(1);
    const snapshot = (row?.snapshot as Record<string, unknown>) ?? null;
    if (!snapshot) return { ok: false, hata: "Sürüm bulunamadı." };
    return { ok: true, snapshot };
  } catch {
    return { ok: false, hata: "Sürüm okunamadı." };
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

  const fotograf = await fotografOku(formData);
  if (!fotograf.ok) return { error: fotograf.hata };
  const snapshot = fotograf.snapshot;

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

  mercegiTazele(parsed.data.slug);
  return { ok: true, savedAt: new Date().toISOString() };
}

/* --------------------------------------------------------------------------
   Bülten
   -------------------------------------------------------------------------- */

/**
 * Var olan bir bülteni günceller.
 *
 * TARİH, DİL VE DÖNEM FORMDA GİZLİ ve düzenlenmiyor — üçü birlikte kaydın
 * kimliği. Serbest bırakmak, bir düzeltmenin yanlışlıkla BAŞKA bir günün
 * bültenini ezmesinin en kolay yolu olurdu; yeni bülten yazmak da rutinin
 * işi.
 */
export async function saveBriefFromAdmin(
  _prev: EditorState,
  formData: FormData,
): Promise<EditorState> {
  await requireAdmin();

  const metin = (name: string) => String(formData.get(name) ?? "").trim();
  const parsed = briefInputSchema.safeParse({
    headline: metin("headline"),
    body_md: String(formData.get("body_md") ?? ""),
    locale: metin("locale") || "tr",
    date: metin("date") || undefined,
    period: metin("period") === "weekly" ? "weekly" : "daily",
  });
  if (!parsed.success) {
    return {
      error: "Kaydedilmedi — alanlardan biri kurala uymuyor.",
      fieldErrors: alanHatalari(parsed.error),
    };
  }

  try {
    await saveBrief(parsed.data, "admin");
  } catch {
    return { error: "Kaydedilemedi — veritabanı yazmayı reddetti." };
  }

  bulteniTazele();
  return { ok: true, savedAt: new Date().toISOString() };
}

/**
 * Bültenin göründüğü her yol.
 *
 * ANA SAYFA DA LİSTEDE: günün özeti kartı bültenin gövdesini basıyor ve
 * yalnızca `/bulten`i tazelemek, düzeltilen metnin ana sayfada eski hâliyle
 * kalması demekti — sitenin en çok görülen yüzeyinde.
 */
function bulteniTazele() {
  revalidatePath("/");
  revalidatePath("/bulten");
  revalidatePath("/feed.xml");
  revalidatePath("/admin/yazilar");
  revalidatePath("/admin/icerik");
}

export async function listBriefRevisions(
  date: string,
  period: string,
  locale: string,
): Promise<StoryRevision[]> {
  await requireAdmin();
  return surumleriOku(
    briefRevisionKey(date, period === "weekly" ? "weekly" : "daily"),
    locale,
  );
}

/** Bültenin bir sürümünü geri yükler — gerekçe `restoreStoryRevision`da. */
export async function restoreBriefRevision(
  _prev: EditorState,
  formData: FormData,
): Promise<EditorState> {
  await requireAdmin();

  const fotograf = await fotografOku(formData);
  if (!fotograf.ok) return { error: fotograf.hata };
  const snapshot = fotograf.snapshot;

  const parsed = briefInputSchema.safeParse({
    headline: snapshot.headline,
    body_md: snapshot.bodyMd,
    locale: snapshot.locale,
    date: snapshot.briefDate,
    period: snapshot.period,
  });
  if (!parsed.success) {
    return { error: "Bu sürüm bugünkü kurallara uymuyor, geri yüklenemedi." };
  }

  try {
    await saveBrief(parsed.data, "admin");
  } catch {
    return { error: "Geri yüklenemedi — veritabanı yazmayı reddetti." };
  }

  bulteniTazele();
  return { ok: true, savedAt: new Date().toISOString() };
}
