import { z } from "zod";
import { db } from "@/lib/db";
import { and, desc, eq, lt } from "drizzle-orm";
import { dailyBriefs, stories, storyRevisions } from "@/lib/schema";
import { todayEt } from "@/lib/market-hours";
import { weekAnchor } from "@/lib/data";
import { isLocale } from "@/lib/i18n/config";

/**
 * İçeriğin TEK yazma yolu — hem rutin hem panel buradan geçer.
 *
 * NEDEN VAR: `/api/mercek` POST'u tek giriş kapısıydı ve panelin içerik
 * yazması, ikinci bir doğrulama + ikinci bir yazma yolu demekti. O ikilik
 * bir karar kaydıyla açıkça reddedilmişti: "iki ayrı doğrulama, iki ayrı
 * biçim kontrolü, birbirinden ayrı düşen iki kod yolu".
 *
 * Bu modül o gerekçeyi savuşturmuyor, ORTADAN KALDIRIYOR: doğrulama bir,
 * yazma bir, giriş iki. Uç ve panel aynı şemayı çağırıyor, aynı upsert'e
 * iniyor. Şema değişirse ikisi birden değişir, ayrı düşemezler.
 *
 * ALAN ADLARI POST GÖVDESİYLE AYNI (`body_md`, `event_date`): model okuduğu
 * paketi düzenleyip doğrudan geri gönderebiliyor ve panel de aynı sözlüğü
 * konuşuyor. Üç taraf tek sözlük.
 */

const SourceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(500).optional(),
});

export const storyInputSchema = z.object({
  /** URL'de görünen kimlik: küçük harf, tire. "leopold-tasfiyesi" gibi. */
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "yalnızca küçük harf, rakam ve tire"),
  title: z.string().trim().min(1).max(160),
  /** Başlığın altındaki tek cümlelik giriş. */
  dek: z.string().trim().min(1).max(400),
  body_md: z.string().trim().min(200).max(40000),
  /** Olayın yaşandığı gün (ET). Boşsa bugün. */
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  locale: z.string().optional(),
  symbols: z.array(z.string().trim().min(1).max(12)).max(12).optional(),
  sources: z.array(SourceSchema).max(20).optional(),
});

export type StoryInput = z.infer<typeof storyInputSchema>;

/** Girdinin beklenen şekli — uç hata yanıtında bunu basıyor. */
export const STORY_INPUT_SHAPE = {
  slug: "kebab-case (3-80)",
  title: "string (≤160)",
  dek: "string (≤400) — tek cümlelik giriş",
  body_md: "markdown (200-40000)",
  event_date: "YYYY-MM-DD (opsiyonel, varsayılan bugün ET)",
  locale: "tr | en (opsiyonel, varsayılan tr)",
  symbols: "['NVDA', 'MU'] (opsiyonel)",
  sources: "[{ label, url }] (opsiyonel)",
} as const;

/**
 * Okuma süresi — DAKİKADA 160 KELİME.
 *
 * İki farklı sayı vardı: bu uç 200, `ArticleBody` 160 kullanıyordu ve
 * ekranda görünen künye ikincisinden geliyordu. 160'ın gerekçesi yazılı —
 * "Türkçe kelimeler daha uzun, metin tablo ve sayı içeriyor" — ötekinin
 * gerekçesi yoktu. Gerekçesi olan kazanıyor.
 *
 * Bilinçli kabul: bundan sonra kaydedilen her yazının `read_minutes` alanı
 * bir tık büyüyecek.
 */
export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(markdown.trim().split(/\s+/).length / 160));
}

/** Yazının künyesi — rutin mi yazdı, panelden mi düzeltildi. */
export type WriteSource = "claude" | "admin";

/** Slug+dil başına tutulan sürüm sayısı — gerekçe `storyRevisions`ta. */
const KEEP_REVISIONS = 10;

/**
 * Üzerine yazmadan önce fotoğraf — mercek yazısı da bülten de buradan geçer.
 *
 * BÜLTEN DE `story_revisions` TABLOSUNDA. Tablo mercek için açılmıştı ama
 * tuttuğu şey jenerik: bir anahtar, bir dil ve satırın jsonb fotoğrafı.
 * Bülten için ikinci bir tablo açmak, aynı budama ve aynı geri yükleme
 * mantığının ikinci bir kopyası demekti; anahtar `bulten:2026-08-29:daily`
 * biçiminde yazılıyor ve mercek slug'ıyla ÇAKIŞAMAZ — slug şeması iki nokta
 * üst üste kabul etmiyor (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
 *
 * GEÇMİŞ BİR KOLAYLIK, yazmanın koşulu değil: fotoğraf alınamazsa içerik
 * yine kaydedilmeli. Bu yüzden hatalar burada yutuluyor.
 */
async function fotografAl(
  key: string,
  locale: string,
  snapshot: unknown,
  source: WriteSource,
) {
  try {
    await db
      .insert(storyRevisions)
      .values({ slug: key, locale, snapshot, replacedBy: source });

    /* Budama yazma sırasında: ayrı bir temizlik işi kurmak, on satırlık
       bir sınır için fazla makine. Alt sınırın tarihini bulup ondan
       eskileri siliyor — `offset` ile silmek Postgres'te doğrudan
       yazılamıyor. */
    const [sinir] = await db
      .select({ at: storyRevisions.replacedAt })
      .from(storyRevisions)
      .where(
        and(eq(storyRevisions.slug, key), eq(storyRevisions.locale, locale)),
      )
      .orderBy(desc(storyRevisions.replacedAt))
      .limit(1)
      .offset(KEEP_REVISIONS - 1);
    if (sinir) {
      await db
        .delete(storyRevisions)
        .where(
          and(
            eq(storyRevisions.slug, key),
            eq(storyRevisions.locale, locale),
            lt(storyRevisions.replacedAt, sinir.at),
          ),
        );
    }
  } catch {
    /* yukarıda yazılı: fotoğraf alınamazsa içerik yine kaydedilir. */
  }
}

/** Bültenin sürüm geçmişi anahtarı — gerekçe `fotografAl`da. */
export function briefRevisionKey(date: string, period: BriefPeriodInput) {
  return `bulten:${date}:${period}`;
}

/**
 * Mercek yazısını yazar ya da üstüne yazar.
 *
 * `generatedBy` YALNIZCA İLK YAZIMDA konuyor: panelden yapılan bir düzeltme
 * künyeyi değiştirmemeli — yazıyı yine rutin yazdı, insan yalnızca elden
 * geçirdi. Upsert'ün `set` bloğunda o alan yok.
 */
export async function saveStory(input: StoryInput, source: WriteSource) {
  const locale = isLocale(input.locale) ? input.locale : "tr";
  const values = {
    slug: input.slug,
    locale,
    title: input.title,
    dek: input.dek,
    bodyMd: input.body_md,
    eventDate: input.event_date ?? todayEt(),
    symbols: input.symbols?.map((symbol) => symbol.toUpperCase()) ?? null,
    sources: input.sources ?? null,
    readMinutes: readingMinutes(input.body_md),
  };

  /* ÜZERİNE YAZMADAN ÖNCE FOTOĞRAF. Upsert gövdeyi geçmişsiz eziyordu ve
     panelden düzenleme açıldığı anda bu bir kayıp riski oldu. Fotoğraf
     BURADA alınıyor, yani iki giriş de (rutin ve panel) kapsanıyor —
     yalnızca panel tarafına koymak, rutinin üzerine yazdığı metni
     kurtarılamaz bırakırdı.

     İÇERİK DEĞİŞMEDİYSE FOTOĞRAF YOK: rutin aynı metni yeniden gönderdiğinde
     (sık oluyor) geçmiş birbirinin aynı on satırla dolar ve gerçek bir
     önceki sürüm listeden düşerdi. */
  const [mevcut] = await db
    .select()
    .from(stories)
    .where(and(eq(stories.slug, values.slug), eq(stories.locale, locale)))
    .limit(1);

  const degisti =
    mevcut &&
    (mevcut.bodyMd !== values.bodyMd ||
      mevcut.title !== values.title ||
      mevcut.dek !== values.dek);

  if (mevcut && degisti) {
    await fotografAl(values.slug, locale, mevcut, source);
  }

  await db
    .insert(stories)
    .values({ ...values, generatedBy: source === "admin" ? "admin" : "claude" })
    .onConflictDoUpdate({
      target: [stories.slug, stories.locale],
      /* `generatedBy` ve `publishedAt` BİLEREK dışarıda: ilki künye (yukarıda),
         ikincisi ilk yayın anı — düzeltme onu geri almaz. */
      set: { ...values, updatedAt: new Date() },
    });

  return { slug: values.slug, locale };
}

/* --------------------------------------------------------------------------
   Bülten
   -------------------------------------------------------------------------- */

/**
 * Bültenin doğrulaması da BURADA — mercekle aynı gerekçe.
 *
 * `/api/brief` kendi şemasını taşıyordu ve panel bülteni düzenlemeye
 * açıldığında bu tam olarak reddedilmiş olan ikiliği doğuracaktı: iki
 * doğrulama, iki upsert, er geç birbirinden ayrı düşen iki kod yolu. Uç
 * artık bu şemayı çağırıyor; alan adları da POST gövdesiyle aynı kaldı
 * (`body_md`, `date`, `period`) — rutinin sözlüğü değişmedi.
 */
export const briefInputSchema = z.object({
  headline: z.string().trim().min(1).max(200),
  body_md: z.string().trim().min(1).max(8000),
  locale: z.string().optional(),
  /** "YYYY-MM-DD" (ET). Boşsa bugünün ET tarihi. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /**
   * "daily" | "weekly". Haftalıkta `date` dönemin PAZARTESİsi olmalı —
   * /api/brief/context yanıtındaki `brief_date` alanı zaten onu veriyor.
   */
  period: z.enum(["daily", "weekly"]).optional(),
});

export type BriefInput = z.infer<typeof briefInputSchema>;
export type BriefPeriodInput = "daily" | "weekly";

/** Girdinin beklenen şekli — uç hata yanıtında bunu basıyor. */
export const BRIEF_INPUT_SHAPE = {
  headline: "string (≤200)",
  body_md: "string (≤8000, markdown)",
  locale: "tr | en (opsiyonel, varsayılan tr)",
  date: "YYYY-MM-DD (opsiyonel, varsayılan bugünün ET tarihi)",
  period: "daily | weekly (opsiyonel, varsayılan daily)",
} as const;

/**
 * Bülteni yazar ya da üstüne yazar.
 *
 * HAFTALIK KAYIT PAZARTESİYE ÇAPALANIR. Şemanın kendi yorumu bunu söylüyordu
 * ama uç onu UYGULAMIYORDU: gelen tarih ne ise o yazılıyordu. Kardeş uç
 * (/api/brief/context) çapayı zaten kuruyor; yani sözleşmeyi bir taraf
 * tutuyor, öteki tutmuyordu. Rutin salı günü çalışıp `date` göndermezse
 * kayıt salı tarihine düşüyor, okuma tarafı ise pazartesi arıyor ve aynı
 * haftanın bülteni iki ayrı satıra bölünüyordu. Çapa artık yazma yolunun
 * kendisinde, yani hangi girişten gelirse gelsin tek bir tarihe oturuyor.
 *
 * KÜNYE YALNIZCA RUTİN YAZDIĞINDA GÜNCELLENİYOR. Panelden yapılan bir
 * düzeltme "kural tabanlı" bir bülteni "rutin yazdı" diye etiketleyemez:
 * `generatedBy` sütunu ekranda okunuyor ve rutin durduğunda ilk bakılan yer
 * orası. Panel yalnızca metni değiştirir, kimin yazdığını değil.
 */
export async function saveBrief(input: BriefInput, source: WriteSource) {
  const locale = isLocale(input.locale) ? input.locale : "tr";
  const period: BriefPeriodInput = input.period ?? "daily";
  const briefDate =
    period === "weekly"
      ? weekAnchor(input.date ?? todayEt())
      : (input.date ?? todayEt());

  const [mevcut] = await db
    .select()
    .from(dailyBriefs)
    .where(
      and(
        eq(dailyBriefs.briefDate, briefDate),
        eq(dailyBriefs.locale, locale),
        eq(dailyBriefs.period, period),
      ),
    )
    .limit(1);

  /* İÇERİK DEĞİŞMEDİYSE FOTOĞRAF YOK: rutin aynı metni yeniden gönderdiğinde
     geçmiş birbirinin aynı on satırla dolar ve gerçek bir önceki sürüm
     listeden düşerdi. */
  if (
    mevcut &&
    (mevcut.headline !== input.headline || mevcut.bodyMd !== input.body_md)
  ) {
    await fotografAl(
      briefRevisionKey(briefDate, period),
      locale,
      mevcut,
      source,
    );
  }

  await db
    .insert(dailyBriefs)
    .values({
      briefDate,
      locale,
      period,
      headline: input.headline,
      bodyMd: input.body_md,
      generatedBy: source === "admin" ? "admin" : "claude",
    })
    .onConflictDoUpdate({
      target: [dailyBriefs.briefDate, dailyBriefs.locale, dailyBriefs.period],
      set: {
        headline: input.headline,
        bodyMd: input.body_md,
        generatedAt: new Date(),
        ...(source === "claude" ? { generatedBy: "claude" as const } : {}),
      },
    });

  return { date: briefDate, locale, period };
}
