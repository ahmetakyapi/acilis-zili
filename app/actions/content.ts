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
  /**
   * Eylemin BİTTİĞİ an — başarı da hata da taşıyor. Editörde iki eylem
   * (kaydet, geri yükle) aynı durum yuvasına yazıyor; hangisinin sonucunun
   * gösterileceğine en son biteni karar veriyor.
   */
  at?: string;
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
     reddediyor ve hata mesajı satır numarası veriyor, alan adı değil.

     SATIR NUMARASI KORUNUYOR. Boş satırlar süzülüyor ve şemanın hata yolu
     (`sources.2.url`) süzülmüş dizinin sırasını veriyor; kutudaki satırı
     değil. Hata "3. satır" diyorsa yazarın saydığı üçüncü satır olmalı. */
  const kaynakSatirlari: number[] = [];
  const kaynaklar = String(formData.get("sources") ?? "")
    .split("\n")
    .flatMap((ham, i) => {
      const satir = ham.trim();
      if (!satir) return [];
      kaynakSatirlari.push(i + 1);
      const [label, url] = satir.split("|").map((p) => p.trim());
      return [url ? { label, url } : { label }];
    });

  return {
    input: {
      slug: metin("slug"),
      title: metin("title"),
      dek: metin("dek"),
      body_md: String(formData.get("body_md") ?? ""),
      event_date: metin("event_date") || undefined,
      locale: metin("locale") || "tr",
      symbols: semboller.length > 0 ? semboller : undefined,
      sources: kaynaklar.length > 0 ? kaynaklar : undefined,
    },
    kaynakSatirlari,
  };
}

/** Alanların ekrandaki adı — hata cümlesinin öznesi. */
const ALAN_ADI: Record<string, string> = {
  slug: "Adres",
  title: "Başlık",
  dek: "Giriş cümlesi",
  body_md: "Gövde",
  event_date: "Olay tarihi",
  symbols: "Semboller",
  sources: "Kaynaklar",
  headline: "Manşet",
};

const sayi = (n: number) => n.toLocaleString("tr-TR");

/**
 * Şema hatasını TÜRKÇE BİR CÜMLEYE çevirir.
 *
 * Zod'un kendi iletisi olduğu gibi basılıyordu (23 Eylül denetimi): boş
 * başlık "Too small: expected string to have >=1 characters", bozuk kaynak
 * adresi yalnızca "Invalid URL" — üstelik hangi satırda olduğunu söylemeden,
 * çünkü yolun yalnızca ilk parçası (`sources`) okunuyordu. Kural kodu ve
 * yolun tamamı artık okunuyor: "Kaynaklar, 3. satır: adres geçersiz."
 */
function hataCumlesi(issue: z.core.$ZodIssue, kaynakSatirlari: number[]): string {
  const [alan, sira, parca] = issue.path;
  const ad = ALAN_ADI[String(alan)] ?? "Bu alan";

  if (alan === "sources" && typeof sira === "number") {
    const satir = kaynakSatirlari[sira] ?? sira + 1;
    const ne =
      parca === "url"
        ? issue.code === "too_big"
          ? `adres en fazla ${sayi(issue.maximum as number)} karakter olabilir`
          : "adres geçersiz"
        : issue.code === "too_big"
          ? `etiket en fazla ${sayi(issue.maximum as number)} karakter olabilir`
          : "etiket boş";
    return `Kaynaklar, ${satir}. satır: ${ne}.`;
  }
  if (alan === "symbols" && typeof sira === "number") {
    return issue.code === "too_big"
      ? `Semboller, ${sira + 1}. sembol en fazla ${sayi(issue.maximum as number)} karakter olabilir.`
      : `Semboller, ${sira + 1}. sembol boş.`;
  }

  switch (issue.code) {
    case "too_small":
      return issue.origin === "array" || Number(issue.minimum) <= 1
        ? `${ad} boş bırakılamaz.`
        : `${ad} en az ${sayi(Number(issue.minimum))} karakter olmalı.`;
    case "too_big":
      return issue.origin === "array"
        ? `${ad} en fazla ${sayi(Number(issue.maximum))} satır olabilir.`
        : `${ad} en fazla ${sayi(Number(issue.maximum))} karakter olabilir.`;
    case "invalid_format":
      return alan === "event_date"
        ? "Olay tarihi geçerli bir gün değil."
        : alan === "slug"
          ? "Adres yalnızca küçük harf, rakam ve tire taşıyabilir."
          : `${ad} kurala uymuyor.`;
    default:
      return `${ad} kurala uymuyor.`;
  }
}

function alanHatalari(
  error: z.ZodError,
  kaynakSatirlari: number[] = [],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const alan = String(issue.path[0] ?? "form");
    if (!out[alan]) out[alan] = hataCumlesi(issue, kaynakSatirlari);
  }
  return out;
}

/** Durum yuvasının hata cümlesi — kaç alanın kurala uymadığını söyler. */
function kuralHatasi(alanlar: Record<string, string>): EditorState {
  const n = Object.keys(alanlar).length;
  return {
    error: `Kaydedilmedi: ${n === 1 ? "bir alan" : `${n} alan`} kurala uymuyor.`,
    fieldErrors: alanlar,
    at: new Date().toISOString(),
  };
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
  /* EDİTÖRÜN KENDİ YOLU DA TAZELENİYOR. Sürüm geri yüklendiğinde bu yol
     listede değildi: sunucu kaydı eski hâline çeviriyor ama editör sayfası
     önbellekten eski taslakla geliyordu ve `router.refresh()` de aynı bayat
     ağacı alıyordu. Yenilemeden kaydetmek geri yüklemeyi siliyordu. */
  revalidatePath(`/admin/yazilar/mercek/${slug}`);
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

  const { input, kaynakSatirlari } = toInput(formData);
  const parsed = storyInputSchema.safeParse(input);

  /* OLAY TARİHİ PANELDE ZORUNLU. Şema onu isteğe bağlı tutuyor — rutin
     tarih göndermezse gün bugün sayılıyor (`saveStory`) ve o kural rutin
     için doğru. Panelde ise alanı temizleyen yazar yazıyı SESSİZCE bugüne
     taşıyordu: hata yok, uyarı yok, arşivde yeri değişmiş bir yazı. Kural
     yalnızca bu girişte; şemaya koymak rutinin sözleşmesini değiştirirdi. */
  const alanlar = parsed.success ? {} : alanHatalari(parsed.error, kaynakSatirlari);
  if (!input.event_date && !alanlar.event_date) {
    alanlar.event_date = "Olay tarihi boş bırakılamaz.";
  }
  if (!parsed.success || Object.keys(alanlar).length > 0) {
    return kuralHatasi(alanlar);
  }

  try {
    await saveStory(parsed.data, "admin");
  } catch {
    return {
      error: "Kaydedilemedi: veritabanı yazmayı reddetti.",
      at: new Date().toISOString(),
    };
  }

  mercegiTazele(parsed.data.slug);

  const now = new Date().toISOString();
  return {
    ok: true,
    /* Saat İSTEMCİDE biçimleniyor ama İSTANBUL diliminde, okuyucunun
       tarayıcısının değil: aynı ekrandaki bütün damgalar TR saatiyle
       (lib/admin-format.ts → `adminStamp`). ISO dize gidiyor ki sunucu ile
       istemci arasında bir kare fark olmasın. */
    savedAt: now,
    at: now,
  };
}

/* --------------------------------------------------------------------------
   Sürümler
   -------------------------------------------------------------------------- */

export type StoryRevision = {
  id: string;
  /** Sürümün ÜZERİNE YAZILDIĞI an — satırın olayı. */
  replacedAt: string;
  /** Üzerine kimin yazdığı: "admin" (panel) ya da "claude" (rutin). */
  replacedBy: string;
  /**
   * Sürümün KENDİ anı — o metnin yazıldığı zaman. Satırın asıl damgası bu:
   * `replacedAt` ile gösterilen sürüm, üzerine yazıldığı saatle tarihlenmiş
   * ve yanlış kişiye yazılmış görünüyordu (23 Eylül denetimi).
   */
  versionAt: string | null;
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
 *
 * SÜRÜMÜN KENDİ ANI FOTOĞRAFTAN. Fotoğraf satırın o anki hâli, damgası da
 * içinde: mercekte `updatedAt` (her yazmada tazeleniyor), bültende
 * `generatedAt`. Bülten damgası panel düzeltmesinde ARTIK İLERLEMİYOR
 * (lib/content-write.ts → `saveBrief`), yani panelde düzeltilmiş bir
 * bülten sürümünün fotoğrafında hâlâ rutinin saati duruyor. O sürümü
 * doğuran yazma bir alttaki satırın olayı: üzerine panel yazdıysa sürümün
 * anı o yazmanın anıdır.
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

    return rows.map((row, i) => {
      const snap = row.snapshot as {
        title?: string;
        headline?: string;
        bodyMd?: string;
        updatedAt?: string;
        generatedAt?: string;
      };
      const kendi = snap.updatedAt ?? snap.generatedAt ?? null;
      const doguran = rows[i + 1];
      const panelde =
        doguran?.replacedBy === "admin" &&
        (!kendi || doguran.replacedAt.getTime() > new Date(kendi).getTime());
      return {
        id: row.id,
        replacedAt: row.replacedAt.toISOString(),
        replacedBy: row.replacedBy,
        versionAt: panelde ? doguran.replacedAt.toISOString() : kendi,
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
  if (!fotograf.ok) return { error: fotograf.hata, at: new Date().toISOString() };
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
    return {
      error: "Bu sürüm bugünkü kurallara uymuyor, geri yüklenemedi.",
      at: new Date().toISOString(),
    };
  }

  try {
    await saveStory(parsed.data, "admin");
  } catch {
    return {
      error: "Geri yüklenemedi: veritabanı yazmayı reddetti.",
      at: new Date().toISOString(),
    };
  }

  mercegiTazele(parsed.data.slug);
  const now = new Date().toISOString();
  return { ok: true, savedAt: now, at: now };
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
  if (!parsed.success) return kuralHatasi(alanHatalari(parsed.error));

  try {
    await saveBrief(parsed.data, "admin");
  } catch {
    return {
      error: "Kaydedilemedi: veritabanı yazmayı reddetti.",
      at: new Date().toISOString(),
    };
  }

  bulteniTazele(parsed.data.date);
  const now = new Date().toISOString();
  return { ok: true, savedAt: now, at: now };
}

/**
 * Bültenin göründüğü her yol.
 *
 * ANA SAYFA DA LİSTEDE: günün özeti kartı bültenin gövdesini basıyor ve
 * yalnızca `/bulten`i tazelemek, düzeltilen metnin ana sayfada eski hâliyle
 * kalması demekti — sitenin en çok görülen yüzeyinde.
 */
function bulteniTazele(date?: string) {
  revalidatePath("/");
  revalidatePath("/bulten");
  revalidatePath("/feed.xml");
  revalidatePath("/admin/yazilar/bulten");
  revalidatePath("/admin/icerik");
  /* Aynı gerekçe mercek tarafında yazılı: editörün kendi yolu tazelenmezse
     geri yükleme ekrana yansımıyor. Tarih formda boş bırakılabiliyor
     (şema onu isteğe bağlı tutuyor, gün `saveBrief` içinde karara
     bağlanıyor); o durumda tazelenecek datalı bir yol da yok. */
  if (date) revalidatePath(`/admin/yazilar/bulten/${date}`);
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
  if (!fotograf.ok) return { error: fotograf.hata, at: new Date().toISOString() };
  const snapshot = fotograf.snapshot;

  const parsed = briefInputSchema.safeParse({
    headline: snapshot.headline,
    body_md: snapshot.bodyMd,
    locale: snapshot.locale,
    date: snapshot.briefDate,
    period: snapshot.period,
  });
  if (!parsed.success) {
    return {
      error: "Bu sürüm bugünkü kurallara uymuyor, geri yüklenemedi.",
      at: new Date().toISOString(),
    };
  }

  try {
    await saveBrief(parsed.data, "admin");
  } catch {
    return {
      error: "Geri yüklenemedi: veritabanı yazmayı reddetti.",
      at: new Date().toISOString(),
    };
  }

  bulteniTazele(parsed.data.date);
  const now = new Date().toISOString();
  return { ok: true, savedAt: now, at: now };
}
