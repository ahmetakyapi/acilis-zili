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
 *
 * SAĞ–SOL DENGESİ (26 Kasım 2026, sahibinin sözü: "sağ sol dengesine
 * dikkat ederek bu tasarımı iyileştirelim"). Önce not gelmeyince sağ kolon
 * tek cümleye düşüyor, altı ~195–250 piksel boş kalıyordu (canlı MU, 1440).
 * Şimdi iki yönlü dolgu: notsuz sağ kolonu aynı beş seansın Claude'suz
 * okuması doldurur (lib/week-digest.ts → WeekMoveCard `WeekDigestView`),
 * not etkenleriyle gelip sağ uzayınca sol sahne yedek açılış kartlarını
 * sığdığı kadar açar (AskStock.tsx → FILL_EXTRA). Sohbet başlayınca kolon
 * tavanı ve kaydırma (24 Kasım kararı, askmove.module.css) aynen.
 * Ölçüm (geçici önizleme, MU, `page.route` ile not/sohbet; 1440, iki
 * tema): kolonlardaki en büyük boş bant sol/sağ — oturumlu boş sohbet
 * notsuz 35/29, not geldi 46/29 (önce sol ~110, karşılamanın üstü ve
 * kartların altı), not bekliyor 37/53, oturumsuz 36/29, iki tur sohbet
 * notsuz 49/115 (fark sağ künyenin üstünde). Yatay taşma 0.
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
