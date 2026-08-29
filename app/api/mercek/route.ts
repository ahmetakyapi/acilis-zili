import { NextResponse } from "next/server";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { stories } from "@/lib/schema";
import { todayEt } from "@/lib/market-hours";
import { isLocale } from "@/lib/i18n/config";
import {
  STORY_INPUT_SHAPE,
  saveStory,
  storyInputSchema,
} from "@/lib/content-write";

/**
 * Mercek yazısı alım ucu.
 *
 * Günlük bültendeki köprünün aynısı: kullanıcının kendi Claude rutini
 * (claude.ai zamanlanmış görev) akşam gün içinde yaşananları tarar, anlatmaya
 * değer bir olay varsa yazıyı yazıp buraya gönderir. Sitede API anahtarı
 * tutulmaz, model maliyeti sunucuya binmez.
 *
 * Aynı `slug` ikinci kez gelirse üzerine yazılır — bir dosya düzeltilebilir.
 * Yeni bir olay için yeni bir slug kullanılır.
 */

function authorized(request: Request): AuthOutcome {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

/**
 * Yazının kendisini geri okur — `?slug=...`.
 *
 * NEDEN VAR: rutin "aynı olayda ciddi bir gelişme olduysa AYNI SLUG İLE
 * GÜNCELLE" diyor ama güncellenecek metni okuyacak bir yol yoktu; POST
 * gövdenin tamamını üzerine yazdığı için model, elindeki eski metni
 * hatırlamadan yazmak zorunda kalıyordu. Sayfanın HTML'inden geri okumak da
 * işe yaramıyor: `:::` blokları render sırasında tüketiliyor, yani hangi
 * bloğun kullanıldığı çıktıdan güvenilir biçimde çıkarılamıyor.
 *
 * İçerik zaten herkese açık (sayfası yayımda), ama uç yine de POST ile aynı
 * anahtarın arkasında: bu kapı yazı ARŞİVİNİN bakım kapısı, okuma kapısı
 * değil — okumak isteyen /mercek/<slug> adresini açar.
 */
export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim();
  const localeParam = url.searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : "tr";

  if (!slug) {
    return NextResponse.json(
      {
        error: "missing-slug",
        detail: "?slug=... zorunlu. Slug listesi: /api/mercek/context",
      },
      { status: 400 },
    );
  }

  const [row] = await db
    .select()
    .from(stories)
    .where(and(eq(stories.slug, slug), eq(stories.locale, locale)))
    .limit(1);

  if (!row) {
    return NextResponse.json(
      { error: "not-found", slug, locale },
      { status: 404 },
    );
  }

  /* Alan adları POST gövdesiyle AYNI yazılıyor (body_md, event_date…): model
     okuduğu paketi düzenleyip doğrudan geri gönderebilsin, alan adı
     çevirmesin. */
  return NextResponse.json({
    ok: true,
    slug: row.slug,
    locale: row.locale,
    title: row.title,
    dek: row.dek,
    body_md: row.bodyMd,
    event_date: row.eventDate,
    symbols: row.symbols ?? [],
    sources: row.sources ?? [],
    read_minutes: row.readMinutes,
    updated_at: row.updatedAt,
  });
}

export async function POST(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  /* DOĞRULAMA VE YAZMA ARTIK BURADA DEĞİL. Panelin de içerik yazması
     gerekiyordu ve ikinci bir doğrulama + ikinci bir upsert açmak, bu
     dosyanın kendi karar kaydının reddettiği şeydi. Şema ve yazma
     `lib/content-write.ts`e taşındı; uç artık yalnızca yetkiyi denetleyen
     ve hata biçimini kuran bir kabuk. Panel de aynı fonksiyonu çağırıyor,
     yani ikisi ayrı düşemez. */
  let parsed;
  try {
    parsed = storyInputSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid-body",
        detail: error instanceof z.ZodError ? error.issues : undefined,
        expected: STORY_INPUT_SHAPE,
      },
      { status: 400 },
    );
  }

  const { locale } = await saveStory(parsed, "claude");
  const eventDate = parsed.event_date ?? todayEt();

  return NextResponse.json({
    ok: true,
    slug: parsed.slug,
    locale,
    event_date: eventDate,
    url: `/mercek/${parsed.slug}`,
  });
}
