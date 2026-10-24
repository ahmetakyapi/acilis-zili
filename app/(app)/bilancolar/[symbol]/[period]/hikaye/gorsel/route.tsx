import { ImageResponse } from "next/og";
import { getSymbolNames } from "@/lib/data";
import { isStoryKind, STORY_MIN_CARDS } from "@/lib/earnings-story";
import { getStory } from "@/lib/earnings-story-data";
import { STORY_OG_SIZES, StoryOgCard, type StoryOgSize } from "@/lib/earnings-story-og";
import { loadWeekLogos } from "@/lib/earnings-week-og";
import { getI18n } from "@/lib/i18n";
import { ogFonts } from "@/lib/og";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Hikâye kartının paylaşım görseli —
 * `?kart=beklenti|rehberlik|tepki|ozet|skor&boyut=dikey|yatay`.
 *
 * ROUTE HANDLER, dosya tabanlı `opengraph-image` DEĞİL: kartı ve boyutu
 * sorgudan okuyor (gerekçenin tamamı `app/(app)/bilancolar/hafta/gorsel/
 * route.tsx` başında — bu rota onun kalıbı). Dil istekten: adres sayfa
 * tarafından dil önekiyle kuruluyor (`/en/bilancolar/.../hikaye/gorsel`).
 *
 * Kart yoksa (o çeyrekte veri olmayan kart istenmiş) ya da hikâye üç
 * karttan kısaysa 404: sayfa o görseli zaten bağlamıyor.
 */

/** Bir saat — hikâyenin verisi çeyrekte bir değişiyor; tepki kartı günlük barla. */
const CACHE_SECONDS = 3600;

/** Analiz OG kartıyla aynı sembol kalıbı (`[period]/opengraph-image.tsx`). */
const STORY_SYMBOL = /^[A-Z.-]{1,12}$/;

export async function GET(
  request: Request,
  context: RouteContext<"/bilancolar/[symbol]/[period]/hikaye/gorsel">,
) {
  /* ORAN SINIRI — haftalık görselin gerekçesiyle (herkese açık uç, her
     istek bir okuma + Satori çizimi). Bir sayfa beş kartın ikişer görselini
     bağlıyor ama yalnız indirilince ya da paylaşılınca isteniyor. */
  const gate = rateLimit(clientKey(request, "hikaye-gorsel"), 40, 60_000);
  if (!gate.allowed) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(gate.retryAfter) } });
  }

  const { symbol: raw, period } = await context.params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  if (!STORY_SYMBOL.test(symbol)) return new Response(null, { status: 404 });

  const url = new URL(request.url);
  const kind = url.searchParams.get("kart");
  const size: StoryOgSize = url.searchParams.get("boyut") === "yatay" ? "landscape" : "portrait";
  if (!isStoryKind(kind)) return new Response(null, { status: 404 });

  const { locale, t } = await getI18n();
  /* OKUNAMADI ≠ YOK (analiz OG kartının notu): veritabanı okunamazsa 404
     değil 503 + `no-store` — paylaşım tarayıcısı geçici hatayı saklamasın. */
  let story: Awaited<ReturnType<typeof getStory>>;
  try {
    story = await getStory(symbol, period, locale);
  } catch {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!story || story.cards.length < STORY_MIN_CARDS) return new Response(null, { status: 404 });
  const index = story.cards.findIndex((card) => card.kind === kind);
  if (index < 0) return new Response(null, { status: 404 });

  const [names, logos, fonts] = await Promise.all([
    getSymbolNames([symbol]),
    loadWeekLogos([symbol]),
    ogFonts(),
  ]);

  return new ImageResponse(
    (
      <StoryOgCard
        card={story.cards[index]}
        index={index}
        total={story.cards.length}
        company={story.row.company}
        symbol={symbol}
        periodLabel={story.row.periodLabel}
        logo={logos.get(symbol)}
        currency={names[symbol]?.currency || true}
        size={size}
        locale={locale}
        t={t}
      />
    ),
    {
      ...STORY_OG_SIZES[size],
      fonts,
      headers: {
        "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`,
        /* Öneksiz adreste dil çerezden okunabiliyor (haftalık görselin notu). */
        Vary: "Cookie",
      },
    },
  );
}
