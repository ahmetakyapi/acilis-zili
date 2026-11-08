import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { and, desc, eq, lt, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { dailyBriefs, dailyCharts, stories, storyRevisions } from "@/lib/schema";
import { todayEt } from "@/lib/market-hours";
import { weekAnchor } from "@/lib/data";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { isIsoDay } from "@/lib/date-input";
import { indexNowUrls, notifyIndexNow } from "@/lib/indexnow";
import { briefHref } from "@/lib/brief";
import { dailyChartHref } from "@/lib/daily-chart";
import {
  bodyProblem,
  checkChartBlock,
  dailyChartRevisionKey,
} from "@/lib/daily-chart";

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

/* URL'SİZ KAYNAK ÜÇ BİÇİMDE GELEBİLİR (30 Ekim): alan hiç yok, `null` ya
   da boş dize. Mercek rutinine "açılmayan adresi ekleme, etiketi URL'siz
   yaz" kuralı girdi; model bunu `"url": ""` ya da `null` diye de yazabilir
   ve şema yalnız alanın YOKLUĞUNU kabul ediyordu — kuralı uygulayan koşu
   400 alıp yazıyı hiç kaydetmezdi. Üçü de "adres yok"a iner. */
const SourceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: z.preprocess(
    (value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value),
    z.string().trim().url().max(500).optional(),
  ),
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

type StoryInput = z.infer<typeof storyInputSchema>;

/**
 * Kayıtlı satır ile yazılacak değerler verilen alanlarda farklı mı —
 * sürüm damgasının (`updatedAt`) ilerleme ölçüsü. Dizi ve nesne alanları
 * (`symbols`, `sources`) içerikle karşılaştırılır; `undefined` ile `null`
 * aynı sayılır (sütun boş).
 */
export function alanlarDegisti<T extends Record<string, unknown>>(
  mevcut: Partial<T>,
  yeni: Partial<T>,
  alanlar: readonly (keyof T)[],
): boolean {
  return alanlar.some((alan) => JSON.stringify(mevcut[alan] ?? null) !== JSON.stringify(yeni[alan] ?? null));
}

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
function readingMinutes(markdown: string): number {
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
  source: WriteSource | "auto",
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
 * Panelin `seen` damgasını yazma koşuluna çevirir.
 *
 * NEDEN VAR (8 Kasım, durum taraması): sürüm denetimi okumadan SONRA
 * JS'te yapılıyordu; aynı kaydı iki sekmeden aynı anda kaydedenlerin ikisi
 * de denetimden geçip birbirini eziyordu. Denetim artık yazmanın kendisinde:
 * `UPDATE … WHERE damga = beklenen RETURNING`, satır dönmezse çakışma.
 * Sözleşme DEĞİŞMEDİ: belirteç yine `updatedAt`in ISO dizesi (editörler ve
 * CLAUDE.md'deki toplu düzeltme kalıbı buna dayanıyor).
 *
 * "" = editör kayıt YOKKEN açıldı (yalnız boş satıra yazılır). Dizenin
 * kendisi değilse (`Date`in kanonik ISO'su değil) karşılaştırma zaten
 * tutmaz: `null` döner, çağıran çakışma sayar — bozuk değer SQL'e
 * `::timestamptz` diye gidip veritabanı hatasına dönüşmesin.
 */
export function damgaBeklentisi(
  beklenen: string,
): { yeni: true } | { yeni: false; iso: string } | null {
  if (beklenen === "") return { yeni: true };
  const at = new Date(beklenen);
  if (Number.isNaN(at.getTime()) || at.toISOString() !== beklenen) return null;
  return { yeni: false, iso: beklenen };
}

/**
 * Damga sütunu ISO dizesine EŞİT mi — SQL tarafı.
 *
 * MİLİSANİYEYE KIRPILARAK. Sütun `timestamptz` (mikrosaniye); ilk yazımın
 * damgası `defaultNow()`dan mikrosaniyeyle geliyor. Okuma yolunda Drizzle
 * (neon-http) damgayı dize alıp `new Date()`e veriyor ve V8 kesir hanesini
 * üçüncü basamakta KESİYOR (yuvarlamıyor: `.123999` → `.123`, denendi).
 * `date_trunc('milliseconds', …)` da keser; iki taraf aynı değeri görür.
 * Düz `updated_at = $1` mikrosaniyeli satırda hiç tutmazdı.
 */
export function damgaEsit(column: AnyColumn, iso: string): SQL {
  return sql`date_trunc('milliseconds', ${column}) = ${iso}::timestamptz`;
}

/** Künyesi (`generatedBy`) olan içerik türleri — `nextAuthor`un ilk argümanı. */
export type ContentType = "mercek" | "bulten" | "grafik";

/**
 * Yazmadan sonra satırın künyesi (`generatedBy`) ne olur — üç içerik türünün
 * devir kuralı TEK YERDE (8 Kasım, durum taraması; önceden üç fonksiyona
 * dağılmış üç ayrı kuraldı). `current`: kayıtlı künye, `null` = satır yok.
 *
 * - **mercek**: yalnız ilk yazımda konur, hiç devrilmez — panel düzeltmesi
 *   yazıyı "insan yazdı" yapmaz; yazıyı yine rutin yazdı.
 * - **bülten**: her rutin (`claude`) yazımı devralır; panel (`admin`) hiç —
 *   "kural tabanlı" bir bülteni panel "rutin yazdı" diye etiketleyemez.
 * - **grafik**: yalnız sitenin yedeği (`auto`) devrilir ve onu yalnız RUTİN
 *   devralır. Panel bir yedeği düzeltince künye `auto` KALIR (ürün kararı,
 *   8 Kasım): yedek yedek olarak kalır, rutinin bağlamı o dili hâlâ
 *   "yazılmamış" görür (`/api/grafik/context` → `auto_locales`) ve rutin o
 *   gün yine yazıp devralır. Önceden panel düzeltmesi künyeyi `admin`
 *   yapıyordu; bağlam o dili yazılmış sayıyor, rutin PAS diyordu ve günün
 *   gerçek yorumu hiç yazılmıyordu.
 *
 * Çağıran, künye değiştiyse (`devraldi`) grafikte `publishedAt`i de o ana
 * çeker; künye değişmediyse dokunmaz (düzeltme yayın anını oynatmaz).
 */
export function nextAuthor(
  contentType: ContentType,
  current: string | null,
  source: DailyChartSource,
): string {
  if (current === null) {
    /* İLK YAZIM: grafikte yazan kim ise o (yedek dahil); mercek ve bültende
       yedek yok, panel dışındaki her yazım rutindir. */
    if (contentType === "grafik") return source;
    return source === "admin" ? "admin" : "claude";
  }
  if (contentType === "bulten") return source === "claude" ? "claude" : current;
  if (contentType === "grafik") {
    return current === DAILY_CHART_AUTO && source === "claude" ? "claude" : current;
  }
  return current;
}

/**
 * `onConflictDoUpdate`/`update`in `set`ine girecek künye: yalnız DEĞİŞTİYSE.
 * Satır okunmamışsa (yeni kayıt) `set`e girmez — araya giren bir yazımın
 * künyesini bu yazım ezmesin; ilk yazımın künyesi `values`ta.
 */
function kunyeSeti(current: string | null, next: string): { generatedBy?: string } {
  return current !== null && current !== next ? { generatedBy: next } : {};
}

/**
 * Mercek yazısını yazar ya da üstüne yazar.
 *
 * `generatedBy` YALNIZCA İLK YAZIMDA konuyor: panelden yapılan bir düzeltme
 * künyeyi değiştirmemeli — yazıyı yine rutin yazdı, insan yalnızca elden
 * geçirdi. Kural `nextAuthor`da (üç içerik türü tek tabloda).
 *
 * `beklenen`: editörün açtığı hâlin `updatedAt`i (ISO) — gerekçe
 * `SurumCakismasi`nda. İki aşamalı: önce JS'te (okunan satırla; çakışma
 * fotoğraf ve yazma denemesinden önce yakalanır), sonra YAZMANIN KOŞULU
 * olarak SQL'de (`damgaBeklentisi`, `damgaEsit` — eşzamanlı iki kaydet).
 * Mikrosaniye/milisaniye farkı `damgaEsit`te: ilk yazımın damgası
 * `defaultNow()`dan mikrosaniyeyle geliyor, Drizzle milisaniyeye kırpıyor;
 * düz `updated_at = $1` hiç tutmazdı.
 */
export async function saveStory(
  input: StoryInput,
  source: WriteSource,
  beklenen?: string,
) {
  const locale = input.locale ?? "tr";

  /* ÜZERİNE YAZILAN HÂLİN FOTOĞRAFI. Upsert gövdeyi geçmişsiz eziyordu ve
     panelden düzenleme açıldığı anda bu bir kayıp riski oldu. Fotoğraf
     BURADA alınıyor, yani iki giriş de (rutin ve panel) kapsanıyor —
     yalnızca panel tarafına koymak, rutinin üzerine yazdığı metni
     kurtarılamaz bırakırdı.

     FOTOĞRAF YAZMA TUTUNCA KAYDEDİLİR (8 Kasım): içeriği yazmadan önceki
     okumadan (`mevcut`), ama tabloya koşullu yazma başarılı olduktan
     SONRA düşüyor. Sürüm çakışmasıyla reddedilen bir panel kaydı önceden
     de fotoğraf bırakırdı; "Güncellendi" künyesi fotoğrafların
     `replacedAt`inden okunduğu için (`getStoryEditedAt`) olmamış bir
     düzeltme yazıda görünürdü.

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

  /* SÜRÜM DAMGASI HER ALAN DEĞİŞİMİNDE (8 Kasım, durum taraması). Damga
     panelin sürüm denetimi (`beklenen`): yalnız metne bakarsa kaynak,
     sembol ya da olay günü düzeltmesi damgayı ilerletmez ve açık kalmış
     eski bir editör onu sessizce geri alır. Görünür "Güncellendi"
     künyesi damgaya değil sürüm fotoğrafına bakıyor (`getStoryEditedAt`,
     yalnız metin değişince), yani künye yine dürüst. */
  const alanDegisti = !!mevcut && alanlarDegisti(mevcut, values, ["title", "dek", "bodyMd", "eventDate", "symbols", "sources"]);

  const mevcutYazar = mevcut?.generatedBy ?? null;
  const yazar = nextAuthor("mercek", mevcutYazar, source);
  /* `publishedAt` BİLEREK dışarıda: ilk yayın anı — düzeltme onu geri
     almaz. Künye yalnız değiştiyse (`kunyeSeti`; mercekte hiç). */
  /* `updatedAt` YALNIZ İÇERİK DEĞİŞİNCE (8 Kasım; hangi alanlar,
     yukarıda `alanDegisti`). Rutin aynı metni sık yeniden gönderiyor ve
     damga her seferinde ilerliyordu: site haritasının `lastModified`i ve
     yazıdaki "Güncellendi" künyesi değişmemiş metni yeni gösterirdi —
     tarih oynatmak Google'ın kaçınılacaklar listesinde. */
  const set = {
    ...values,
    ...kunyeSeti(mevcutYazar, yazar),
    ...(alanDegisti ? { updatedAt: new Date() } : {}),
  };

  const beklenti = beklenen === undefined ? undefined : damgaBeklentisi(beklenen);
  if (beklenti === null) throw new SurumCakismasi();

  if (beklenti === undefined) {
    /* Rutin ve panel dışı yollar: sözleşme "aynı slug üzerine yazar". */
    await db
      .insert(stories)
      .values({ ...values, generatedBy: yazar })
      .onConflictDoUpdate({ target: [stories.slug, stories.locale], set });
  } else if (beklenti.yeni) {
    /* Editör kayıt yokken açıldı: yalnız boş satıra. Araya biri yazdıysa
       çakışma — onun yazısı ezilmez. */
    const eklenen = await db
      .insert(stories)
      .values({ ...values, generatedBy: yazar })
      .onConflictDoNothing({ target: [stories.slug, stories.locale] })
      .returning({ id: stories.id });
    if (eklenen.length === 0) throw new SurumCakismasi();
  } else {
    /* KOŞULLU YAZMA: damga hâlâ editörün açtığı damga ise. JS denetimi ile
       bu satır arasında başka bir kaydet yazdıysa damga ilerlemiştir (her
       alan değişiminde ilerliyor, yukarıda) ve satır dönmez. */
    const yazilan = await db
      .update(stories)
      .set(set)
      .where(
        and(
          eq(stories.slug, values.slug),
          eq(stories.locale, locale),
          damgaEsit(stories.updatedAt, beklenti.iso),
        ),
      )
      .returning({ id: stories.id });
    if (yazilan.length === 0) throw new SurumCakismasi();
  }

  if (mevcut && degisti) {
    await fotografAl(values.slug, locale, mevcut, source);
  }

  /* Yeni ya da metni değişen yazı Bing'e bildirilir (`lib/indexnow.ts`);
     rutinin aynı metni yeniden göndermesi bildirim üretmez. */
  if (!mevcut || degisti) notifyIndexNow(indexNowUrls([`/mercek/${values.slug}`], [locale as Locale]));

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

type BriefInput = z.infer<typeof briefInputSchema>;
type BriefPeriodInput = "daily" | "weekly";

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
 * `SurumCakismasi`nda. Mercekteki gibi yazmanın KOŞULU da (8 Kasım):
 * özet SQL'de hesaplanmıyor (Postgres metni `\0` ayıracını kabul etmez),
 * onun yerine okunan manşet ve gövde `WHERE`e giriyor — özeti tutan satırın
 * kendisi. Araya giren yazım satırı değiştirdiyse güncelleme boş döner.
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

  const mevcutYazar = mevcut?.generatedBy ?? null;
  const yazar = nextAuthor("bulten", mevcutYazar, source);
  const set = {
    headline: input.headline,
    bodyMd: input.body_md,
    ...kunyeSeti(mevcutYazar, yazar),
    ...(source === "claude" ? { generatedAt: new Date() } : {}),
  };
  const satir = {
    briefDate,
    locale,
    period,
    headline: input.headline,
    bodyMd: input.body_md,
    generatedBy: yazar,
  };
  const hedef = [dailyBriefs.briefDate, dailyBriefs.locale, dailyBriefs.period];

  if (beklenen === undefined) {
    await db.insert(dailyBriefs).values(satir).onConflictDoUpdate({ target: hedef, set });
  } else if (!mevcut) {
    /* Editör kayıt yokken açıldı (`beklenen` ""; JS denetimi geçti). */
    const eklenen = await db
      .insert(dailyBriefs)
      .values(satir)
      .onConflictDoNothing({ target: hedef })
      .returning({ id: dailyBriefs.id });
    if (eklenen.length === 0) throw new SurumCakismasi();
  } else {
    const yazilan = await db
      .update(dailyBriefs)
      .set(set)
      .where(
        and(
          eq(dailyBriefs.id, mevcut.id),
          eq(dailyBriefs.headline, mevcut.headline),
          eq(dailyBriefs.bodyMd, mevcut.bodyMd),
        ),
      )
      .returning({ id: dailyBriefs.id });
    if (yazilan.length === 0) throw new SurumCakismasi();
  }

  /* İÇERİK DEĞİŞMEDİYSE FOTOĞRAF YOK: rutin aynı metni yeniden gönderdiğinde
     geçmiş birbirinin aynı on satırla dolar ve gerçek bir önceki sürüm
     listeden düşerdi. Fotoğraf yazma tutunca (mercekteki gerekçe). */
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

  if (!mevcut || mevcut.headline !== input.headline || mevcut.bodyMd !== input.body_md) {
    notifyIndexNow(indexNowUrls([briefHref(briefDate, period)], [locale as Locale]));
  }

  return { date: briefDate, locale, period };
}

/* --------------------------------------------------------------------------
   Günün Grafiği (24 Ekim)
   -------------------------------------------------------------------------- */

/**
 * Günün grafiğinin doğrulaması da BURADA — mercek ve bültenle aynı gerekçe:
 * doğrulama bir, yazma bir. Uç (`/api/grafik`) yalnız yetki, gün ve sayı
 * denetimini (`lib/ai-grounding.ts`) ekleyen bir kabuk.
 *
 * Grafik ve açıklama AYRI ALAN: paylaşım görseli yalnız grafiği çiziyor,
 * ana sayfa kartı onu küçültüyor; gövdenin içinden bloğu ayıklamak her
 * okuyucuda ikinci bir ayrıştırma olurdu. Blok kuralı ve kelime aralığı
 * saf modülde (`lib/daily-chart.ts`), test edilebilsin diye.
 */
export const dailyChartInputSchema = z
  .object({
    title: z.string().trim().min(1).max(140),
    /** Tek `:::` bloğu: `::: bar`, `::: pay` ya da `::: oncesi`. */
    chart_md: z.string().trim().min(10).max(2000),
    /** ~100 kelime, düz paragraf. */
    body_md: z.string().trim().min(1).max(1600),
    /** Grafiğin anlattığı işlem günü (ET). Boşsa son tamamlanmış seans. */
    date: isoDateSchema.optional(),
    locale: localeInputSchema.optional(),
    sources: z.array(SourceSchema).max(10).optional(),
  })
  .superRefine((input, ctx) => {
    const chart = checkChartBlock(input.chart_md, input.locale ?? "tr");
    if (!chart.ok) ctx.addIssue({ code: "custom", path: ["chart_md"], message: chart.reason });
    const body = bodyProblem(input.body_md);
    if (body) ctx.addIssue({ code: "custom", path: ["body_md"], message: body });
  });

type DailyChartInput = z.infer<typeof dailyChartInputSchema>;

/** Girdinin beklenen şekli — uç hata yanıtında bunu basıyor. */
export const DAILY_CHART_INPUT_SHAPE = {
  title: "string (≤140) — grafiğin söylediği tek cümle",
  chart_md: "tek ::: bloğu — ::: bar | ::: pay | ::: oncesi (2-12 satır, her değer sayı)",
  body_md: "düz paragraf, 50-160 kelime (blok, başlık, tablo yok)",
  date: "YYYY-MM-DD (opsiyonel; yoksa son tamamlanmış seans, ET)",
  locale: "tr | en (opsiyonel, varsayılan tr)",
  sources: "[{ label, url }] (opsiyonel, ≤10)",
} as const;

/**
 * Günün grafiğinin yazarı: rutin, panel ya da sitenin YEDEĞİ (8 Kasım,
 * `lib/daily-chart-fallback.ts`). "auto" yalnız boş güne yazar ve rutin
 * geldiğinde devrilir; rutinin bağlamı onu "yazılmış" saymaz
 * (`/api/grafik/context` → `existing_locales`).
 */
export const DAILY_CHART_AUTO = "auto";
export type DailyChartSource = WriteSource | typeof DAILY_CHART_AUTO;

/**
 * Günün grafiğini yazar ya da üstüne yazar. `date` burada ZORUNLU: hangi
 * günün son tamamlanmış seans olduğuna uç karar veriyor (tatil takvimi ve
 * saat orada), yazma yolu takvim bilmiyor.
 *
 * Mercekle aynı üç kural: içerik değiştiyse fotoğraf (`story_revisions`,
 * anahtar `grafik:{gün}`; yazma tutunca), `generatedBy` ve `publishedAt`
 * yalnız ilk yazımda (yedeğin devri hariç — `nextAuthor`), `beklenen`
 * verilirse sürüm denetimi yazmanın koşulu (`damgaEsit`).
 */
export async function saveDailyChart(
  input: DailyChartInput & { date: string },
  source: DailyChartSource,
  beklenen?: string,
): Promise<{ date: string; locale: string; skipped?: "exists" }> {
  const locale = input.locale ?? "tr";
  const [mevcut] = await db
    .select()
    .from(dailyCharts)
    .where(and(eq(dailyCharts.chartDate, input.date), eq(dailyCharts.locale, locale)))
    .limit(1);

  /* YEDEK HİÇBİR KAYDIN ÜSTÜNE YAZMAZ (8 Kasım): yalnız boş güne. Kontrol
     yazma yolunda, çağıranda değil — cron'un okuması ile yazması arasında
     rutin yazmış olabilir. */
  if (source === DAILY_CHART_AUTO && mevcut) return { date: input.date, locale, skipped: "exists" };

  if (
    beklenen !== undefined &&
    (mevcut?.updatedAt?.toISOString() ?? "") !== beklenen
  ) {
    throw new SurumCakismasi();
  }

  const values = {
    chartDate: input.date,
    locale,
    title: input.title,
    chartMd: input.chart_md,
    bodyMd: input.body_md,
    sources: input.sources ?? null,
  };

  const chartChanged =
    !!mevcut &&
    (mevcut.title !== values.title ||
      mevcut.chartMd !== values.chartMd ||
      mevcut.bodyMd !== values.bodyMd);
  /* Sürüm damgası kaynak değişiminde de ilerler (mercekteki gerekçe). */
  const alanDegisti = !!mevcut && alanlarDegisti(mevcut, values, ["title", "chartMd", "bodyMd", "sources"]);

  /* Yedeğin üstüne RUTİN yazınca künye de değişir: `generatedBy`
     "yalnız ilk yazımda" kuralının tek istisnası, çünkü "auto" bir yazar
     değil yer tutucu — rutin yazınca kayıt artık rutinin. `publishedAt`
     da o an: okurun gördüğü metin o an yayımlandı. Panel düzeltmesi
     yedeği devralmaz (8 Kasım ürün kararı; tablo ve gerekçe `nextAuthor`):
     künye `auto`, `publishedAt` yerinde kalır. */
  const mevcutYazar = mevcut?.generatedBy ?? null;
  const yazar = nextAuthor("grafik", mevcutYazar, source);
  const devraldi = mevcutYazar !== null && yazar !== mevcutYazar;
  const takeover = devraldi ? { ...kunyeSeti(mevcutYazar, yazar), publishedAt: new Date() } : {};

  /* YEDEK YARIŞI KAPATIR (8 Kasım, durum taraması). Yukarıdaki "kayıt var
     mı" okuması ile bu yazma arasında rutin yazabilir; yedek
     `onConflictDoUpdate` ile gelse rutinin metnini ezer ve künye "claude"
     kalırdı. Yedek yalnız BOŞ satıra yazar: çakışmada hiçbir şey yapmaz. */
  if (source === DAILY_CHART_AUTO) {
    const eklenen = await db
      .insert(dailyCharts)
      .values({ ...values, generatedBy: yazar })
      .onConflictDoNothing({ target: [dailyCharts.chartDate, dailyCharts.locale] })
      .returning({ date: dailyCharts.chartDate });
    if (eklenen.length === 0) return { date: input.date, locale, skipped: "exists" };
    notifyIndexNow(indexNowUrls([dailyChartHref(input.date)], [locale as Locale]));
    return { date: input.date, locale };
  }

  /* `updatedAt` yalnız içerik değişince ya da devirde (mercekteki gerekçe). */
  const set = { ...values, ...takeover, ...(alanDegisti || devraldi ? { updatedAt: new Date() } : {}) };
  const hedef = [dailyCharts.chartDate, dailyCharts.locale];
  const beklenti = beklenen === undefined ? undefined : damgaBeklentisi(beklenen);
  if (beklenti === null) throw new SurumCakismasi();

  if (beklenti === undefined) {
    await db
      .insert(dailyCharts)
      .values({ ...values, generatedBy: yazar })
      .onConflictDoUpdate({ target: hedef, set });
  } else if (beklenti.yeni) {
    const eklenen = await db
      .insert(dailyCharts)
      .values({ ...values, generatedBy: yazar })
      .onConflictDoNothing({ target: hedef })
      .returning({ id: dailyCharts.id });
    if (eklenen.length === 0) throw new SurumCakismasi();
  } else {
    /* Koşullu yazma — gerekçe `damgaBeklentisi`, `saveStory`. */
    const yazilan = await db
      .update(dailyCharts)
      .set(set)
      .where(
        and(
          eq(dailyCharts.chartDate, input.date),
          eq(dailyCharts.locale, locale),
          damgaEsit(dailyCharts.updatedAt, beklenti.iso),
        ),
      )
      .returning({ id: dailyCharts.id });
    if (yazilan.length === 0) throw new SurumCakismasi();
  }

  if (mevcut && chartChanged) {
    await fotografAl(dailyChartRevisionKey(input.date), locale, mevcut, source);
  }

  if (!mevcut || chartChanged) {
    notifyIndexNow(indexNowUrls([dailyChartHref(input.date)], [locale as Locale]));
  }

  return { date: input.date, locale };
}
