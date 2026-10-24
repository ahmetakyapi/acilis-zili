import { Suspense } from "react";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { AskStock } from "@/components/stock/AskStock";
import { Skeleton } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { insightsConfigured } from "@/lib/stock-insights";
import { questionQuota } from "@/lib/stock-question";
import { QUESTION_DAILY_LIMIT } from "@/lib/stock-question-core";

/**
 * "Bu Hisseye Sor" panelinin kabuğu (24 Ekim). Burada yalnız oturum ve
 * okurun bugün kalan hakkı okunur; soru istemciden gider
 * (components/stock/AskStock.tsx → app/api/ai/hisse-sor), sayfanın sunucu
 * çiziminde Claude çağrısı yok. Claude anahtarı yoksa panel hiç basılmaz.
 * Oturumsuz okura (botlar dahil) giriş çağrısı, örnek sorular ve yanıtın
 * yapısını anlatan önizleme (components/stock/AskStock.tsx).
 */
export async function AskStockPanel({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  if (!insightsConfigured()) return null;
  const session = await auth();
  const userId = session?.user?.id ?? null;
  return (
    <AskStock
      symbol={symbol}
      locale={locale}
      labels={t.askStock}
      signedIn={userId !== null}
      remaining={userId ? questionQuota.left(userId) : 0}
      limit={QUESTION_DAILY_LIMIT}
    />
  );
}

/* Oturum çerezinin adları — proxy.ts → `hasSessionCookie` ile aynı. */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"] as const;

/**
 * Panelin yuvası: Suspense yedeği OTURUM DURUMUNA GÖRE (24 Ekim düzeltmesi).
 * Tek yedek oturumlu kabuğun boyundaydı; oturumsuz kabuk 158 pikseldi ve
 * yavaş ağda sayfa 126 (1280) / 272 (390) piksel yukarı sıçrıyordu. Çerezin
 * VARLIĞI yeterli ölçü (proxy'nin korunan sayfalardaki ön elemesiyle aynı):
 * süresi geçmiş çerezde yanılgı tek bir yedek boyu, güvenlik kararı değil;
 * asıl oturum `auth()` ile panelde okunuyor.
 *
 * Boylar ölçüldü (24 Ekim, NVDA, iki dil, panelin kendisi):
 *   oturumlu   1280: 284 · 390: 453 (EN 514)
 *   oturumsuz  1280: 345 · 390: 624 (EN 650)
 * Oturumsuz kabuk artık oturumludan uzun (örnekler + yanıt önizlemesi);
 * yedek kendi boyunda, yanılgı ancak çerez durumu yanlışsa.
 */
export async function AskStockSlot({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  if (!insightsConfigured()) return null;
  const jar = await cookies();
  const signedIn = SESSION_COOKIES.some((name) => jar.has(name));
  return (
    <Suspense
      fallback={
        <Skeleton
          className={
            signedIn
              ? "h-[284px] w-full rounded-[20px] max-sm:h-[453px]"
              : "h-[345px] w-full rounded-[20px] max-sm:h-[624px]"
          }
        />
      }
    >
      <AskStockPanel symbol={symbol} locale={locale} t={t} />
    </Suspense>
  );
}
