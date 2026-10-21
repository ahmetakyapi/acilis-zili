import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { and, desc, eq, lt } from "drizzle-orm";
import { dailyBriefs, stories, storyRevisions } from "@/lib/schema";
import { todayEt } from "@/lib/market-hours";
import { weekAnchor } from "@/lib/data";
import { LOCALES } from "@/lib/i18n/config";
import { isIsoDay } from "@/lib/date-input";

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

/**
 * Dil DOĞRULANIR, "tr"ye ÇEVRİLMEZ (20 Ekim denetimi). Alan serbest dizeydi
 * ve yazma yolu tanımadığı her değeri "tr" sayıyordu: rutinin "EN" ya da
 * "en-US" diye gönderdiği çeviri TÜRKÇE satırın üzerine yazılıyor, yanıt
 * yine `ok: true, locale: "tr"` diyordu. Büyük/küçük harf ve boşluk
 * hoşgörülüyor (model kaçamağı); başka her değer 400 `invalid-body` —
 * rutin o yanıttan kendini düzeltiyor. Varsayılan "tr" yalnızca alan
 * YOKKEN. Bilanço ucu (`app/api/analiz`) aynı şemayı kullanıyor.
 */
export const localeInputSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.enum(LOCALES));

/**
 * Takvim günü — biçim DE gün DE denetlenir (20 Ekim denetimi). Yalnız
 * `\d{4}-\d{2}-\d{2}` aranıyordu: "2026-09-31" geçip Postgres'in `date`
 * sütununda düşüyor, rutin gerekçesiz bir 500 alıyordu; haftalık bültende
 * "2026-02-30" ise sessizce 2 Mart haftasına çapalanıyordu.
 *
 * GÖVDE VE SORGU TEK KURAL: `isIsoDay` (lib/date-input.ts — saf modül,
 * tarih seçici de onu kullanıyor). Bülten uçlarının sorgu parametresi
 * (`/api/brief`, `/list`, `/context`) yalnız `BRIEF_DATE` ile
 * denetleniyordu: "2026-02-30" `weekAnchor`da 2 Mart haftasına
 * yuvarlanıyor, "2026-13-01" `toISOString`te RangeError'la 500 veriyordu.
 * Onlar için `lib/brief.ts`te açılan ayrı bir `isIsoDate` üçüncü bir gün
 * denetimi olmuştu ve `z.iso.date()` gibi "0000-01-01"i de geçiriyordu —
 * Postgres `date`inde sıfır yılı yok, yine 500. Kaldırıldı; `isIsoDay`
 * yılı 1900–2999'a bağlıyor. `when`: biçim zaten düştüyse yıl iletisi
 * ikinci, yanıltıcı bir hata olarak eklenmesin.
 */
export const isoDateSchema = z.iso.date().refine(isIsoDay, {
  message: "yıl 1900–2999 aralığında olmalı",
  when: (payload) => payload.issues.length === 0,
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
  /** Olayın yaşandığı gün (ET). Boşsa kayıttaki gün, kayıt yoksa bugün. */
  event_date: isoDateSchema.optional(),
  locale: localeInputSchema.optional(),
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
  event_date:
    "YYYY-MM-DD (opsiyonel; yoksa var olan kaydın günü, yeni yazıda bugün ET)",
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
 * Panelin sürüm denetimi tutmadı: editör açıkken kayda başkası yazmış.
 *
 * NEDEN VAR (20 Ekim denetimi): panel kaydı, editörün açıldığı hâle
 * bakmadan upsert ediyordu. Mercek rutini aynı slug'ı güncelleyebiliyor
 * (11:30 ve 23:30) ve aynı kayıt iki sekmede açık olabiliyor; 23:20'de
 * açılmış editörden yapılan bir yazım düzeltmesi rutinin 23:30 güncellemesini
 * sessizce geri alıyordu. Moderasyondaki `seen` denetiminin aynısı. Denetim
 * yalnız panel girişinde (`beklenen` verilince) — rutinin sözleşmesi
 * "aynı slug üzerine yazar" olarak kalıyor.
 */
export class SurumCakismasi extends Error {
  constructor() {
    super("content-version-conflict");
    this.name = "SurumCakismasi";
  }
}

/**
 * Mercek yazısını yazar ya da üstüne yazar.
 *
 * `generatedBy` YALNIZCA İLK YAZIMDA konuyor: panelden yapılan bir düzeltme
 * künyeyi değiştirmemeli — yazıyı yine rutin yazdı, insan yalnızca elden
 * geçirdi. Upsert'ün `set` bloğunda o alan yok.
 *
 * `beklenen`: editörün açtığı hâlin `updatedAt`i (ISO) — gerekçe
 * `SurumCakismasi`nda. KARŞILAŞTIRMA JS'TE: ilk yazımın damgası
 * `defaultNow()`dan mikrosaniyeyle geliyor, Drizzle milisaniyeye kırpıyor;
 * SQL'de `updated_at = $1` hiç tutmazdı.
 */
export async function saveStory(
  input: StoryInput,
  source: WriteSource,
  beklenen?: string,
) {
  const locale = input.locale ?? "tr";

  /* ÜZERİNE YAZMADAN ÖNCE FOTOĞRAF. Upsert gövdeyi geçmişsiz eziyordu ve
     panelden düzenleme açıldığı anda bu bir kayıp riski oldu. Fotoğraf
     BURADA alınıyor, yani iki giriş de (rutin ve panel) kapsanıyor —
     yalnızca panel tarafına koymak, rutinin üzerine yazdığı metni
     kurtarılamaz bırakırdı.

     İÇERİK DEĞİŞMEDİYSE FOTOĞRAF YOK: rutin aynı metni yeniden gönderdiğinde
     (sık oluyor) geçmiş birbirinin aynı on satırla dolar ve gerçek bir
     önceki sürüm listeden düşerdi.

     SLUG'IN İKİ DİLİ BİRDEN okunuyor (20 Ekim): olay tarihi gelmezse gün
     kayıttan alınıyor — aşağıda. */
  const satirlar = await db
    .select()
    .from(stories)
    .where(eq(stories.slug, input.slug));
  const mevcut = satirlar.find((row) => row.locale === locale);

  if (
    beklenen !== undefined &&
    (mevcut?.updatedAt?.toISOString() ?? "") !== beklenen
  ) {
    throw new SurumCakismasi();
  }

  const values = {
    slug: input.slug,
    locale,
    title: input.title,
    dek: input.dek,
    bodyMd: input.body_md,
    /* TARİH GELMEZSE KAYDIN GÜNÜ KALIR (20 Ekim denetimi). "Boşsa bugün"
       yeni yazı için doğru; ama değer upsert'ün `set`ine de gidiyordu ve
       tarihsiz gelen bir güncelleme ya da İngilizce çeviri, 2 Eylül'ün
       yazısını arşivde bugüne taşıyordu. Sıra: bu dilin satırı, öteki dilin
       satırı (çeviri aynı olayı anlatır), en son bugün. */
    eventDate:
      input.event_date ??
      mevcut?.eventDate ??
      satirlar[0]?.eventDate ??
      todayEt(),
    symbols: input.symbols?.map((symbol) => symbol.toUpperCase()) ?? null,
    sources: input.sources ?? null,
    readMinutes: readingMinutes(input.body_md),
  };

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

  return { slug: values.slug, locale, eventDate: values.eventDate };
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
  locale: localeInputSchema.optional(),
  /** "YYYY-MM-DD" (ET). Boşsa bugünün ET tarihi. */
  date: isoDateSchema.optional(),
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
 * Bülten satırının sürüm imi — panelin sürüm denetimi bununla.
 *
 * DAMGA DEĞİL İÇERİK ÖZETİ (20 Ekim): `generatedAt` panel düzeltmesinde
 * ilerlemiyor (aşağıda, `saveBrief`) ve ayrı bir `updated_at` migration
 * isterdi. Manşet ile gövdenin özeti, değişen her şeyi yakalıyor; editöre
 * 8000 karakterlik gövdenin ikinci kopyası yerine 64 karakter gidiyor.
 */
export function briefSurumu(headline: string, bodyMd: string): string {
  return createHash("sha256").update(`${headline}\0${bodyMd}`).digest("hex");
}

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
 *
 * DAMGA DA ÖYLE (23 Eylül denetimi). `generatedAt` her yazmada ilerliyordu,
 * panelden de: saat 11:42'de düzeltilen bülten "Rutin Yazdı · 11:42"
 * diye okunuyor, künyenin yarısı yalan oluyordu — ve Sistem ekranının
 * "rutin bugün yazdı mı" sorusu (`max(generatedAt)`) bir panel düzeltmesini
 * rutinin koşusu sanabiliyordu. Damga artık yalnızca rutin yazınca
 * ilerliyor; panel düzeltmesinin anı `story_revisions`ta, üzerine yazılan
 * sürümün `replacedAt`inde duruyor ve editör başlığı onu ayrıca yazıyor
 * ("Panelde Düzeltildi"). Ayrı bir `updated_at` sütunu yeni bir migration
 * isterdi; aynı bilgi zaten o tabloda.
 *
 * `beklenen`: editörün açtığı hâlin `briefSurumu` özeti — gerekçe
 * `SurumCakismasi`nda.
 */
export async function saveBrief(
  input: BriefInput,
  source: WriteSource,
  beklenen?: string,
) {
  const locale = input.locale ?? "tr";
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

  if (
    beklenen !== undefined &&
    (mevcut ? briefSurumu(mevcut.headline, mevcut.bodyMd) : "") !== beklenen
  ) {
    throw new SurumCakismasi();
  }

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
        ...(source === "claude"
          ? { generatedBy: "claude" as const, generatedAt: new Date() }
          : {}),
      },
    });

  return { date: briefDate, locale, period };
}
