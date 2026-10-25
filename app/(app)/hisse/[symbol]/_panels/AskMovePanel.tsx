import { Suspense } from "react";
import { WeekMoveCard } from "@/components/stock/WeekMoveCard";
import { weekMoveFromBars, type WeekMove } from "@/components/stock/week-move";
import { Panel, Skeleton } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import { completedDailyBars, insightsConfigured } from "@/lib/stock-insights";
import { cn } from "@/lib/utils";
import { AskStockPanel } from "./AskStockPanel";
import styles from "./askmove.module.css";

/**
 * SOR + HAFTA, TEK PANEL (25 Ekim, sahibinin isteği: "Bu Hisseye Sor
 * böyle kocaman olmasına gerek var mı; yanına Bu Hisse Neden Hareket Etti
 * konabilir").
 *
 * Önce iki tam genişlik panel alt alta duruyordu: haftanın notu (1280'de
 * 595, telefonda 824 piksel; not yazılamazsa tek cümlelik boş bir kutu)
 * ve altında soru kutusu (284 / 453). Şimdi tek panelin iki kolonu: solda
 * kompakt soru kutusu, sağda haftanın kartı; 1024 altında alt alta, kolon
 * arası kıl çizgi. Ölçüm commit gövdesinde.
 *
 * HAFTANIN SAYILARI SUNUCUDA (veri dürüstlüğü 3): `completedDailyBars`,
 * yani Claude notunun da okuduğu barlar ve aynı pencere
 * (components/stock/week-move.ts). Bar önbellekli (`getChartBars`), Claude
 * çağrısı YOK; not eskisi gibi istemciden ve görüş alanına yaklaşınca,
 * botlara kapalı (WeekMoveCard). Bar bayatsa (`completedDailyBars` null)
 * hafta kolonu basılmaz, soru kutusu paneli tek başına doldurur — bayat bir
 * haftayı büyük puntoyla göstermek yerine (veri dürüstlüğü 2).
 *
 * Claude anahtarı yoksa soru kolonu yok ve hafta kartı notsuz (yalnız
 * veri); ikisi de yoksa panel hiç basılmaz.
 */
async function getWeekMove(symbol: string): Promise<WeekMove | null> {
  try {
    const [bars, spy] = await Promise.all([completedDailyBars(symbol), completedDailyBars("SPY")]);
    return weekMoveFromBars(symbol, bars, spy);
  } catch {
    return null;
  }
}

async function AskMovePanel({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  const configured = insightsConfigured();
  const week = await getWeekMove(symbol);
  if (!configured && !week) return null;
  return (
    <Panel data-askmove="" className={cn(styles.panel, (!configured || !week) && styles.single)}>
      {configured && (
        <div className={styles.col}>
          <AskStockPanel symbol={symbol} locale={locale} t={t} />
        </div>
      )}
      {week && (
        <div className={styles.col}>
          <WeekMoveCard week={week} noteEnabled={configured} locale={locale} labels={t.stockInsight} copy={t.stockWeek} />
        </div>
      )}
    </Panel>
  );
}

export function AskMoveSlot({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  return (
    <Suspense fallback={<Skeleton className={styles.skeleton} />}>
      <AskMovePanel symbol={symbol} locale={locale} t={t} />
    </Suspense>
  );
}
