import { auth } from "@/auth";
import { AskStock } from "@/components/stock/AskStock";
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

/* Panelin yuvası ve Suspense yedeği AskMovePanel.tsx'te (25 Ekim): soru
   kutusu artık "Bu Hafta Neden Hareket Etti" ile tek panelin kolonu. Eski
   yuva yedeği oturum çerezine göre iki boy ayırıyordu (284/345, telefonda
   453/624); kompakt kutuda iki hâlin farkı birkaç piksel, tek yedek yetiyor. */
