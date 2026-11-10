import type { CSSProperties, ReactNode } from "react";
import { SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { HeatScale } from "@/components/markets/HeatScale";
import { LogoTile, Panel } from "@/components/ui/primitives";
import { INDEX_COMPOSITION_DATE } from "@/db/seed/indices";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { MoveSet } from "@/lib/theme-stats";
import type { ThemeRow } from "@/lib/themes-data";
import { cn, formatEtDateMedium, formatPercent, NO_VALUE } from "@/lib/utils";
import styles from "./MarketExperience.module.css";

export function IndexHeat({ total, memberCount, heat, moves, locale, t, children }: {
  total: number; memberCount: number; heat: ThemeRow[]; moves: MoveSet | null;
  locale: Locale; t: Dictionary; children?: ReactNode;
}) {
  /* Künye haritanın hangi günü boyadığını söylüyor: renk yalnız bu
     seansın kümesinde (gerekçe components/markets/HeatScale.tsx). */
  const hint = moves === null ? t.markets.heatMixed : moves.basis === "lastClose" ? t.markets.heatLastClose : t.markets.heatmapHint;
  return (
    <Panel id="market-reading" className={styles.breadth}>
      <div className={styles.breadthOverview}>
        {/* ISI HARİTASI, LOGOLU VE 30 ŞİRKET (26 Eylül). Renkli kareler
            "anlamsız" bulundu: hangi karenin hangi şirket olduğu okunmuyordu.
            Artık piyasa değerine göre ilk 30 şirket (`HEAT_MAX`), her karede
            logo ve günlük yüzde; renk karonun zemini, koyuluk hareketin
            büyüklüğü. Üzerine gelince sitenin ortak şirket kartı açılıyor
            (28 Eylül). Kareler klavyeyle de gezilebiliyor: 30 durak kabul
            edilebilir.
            18 Ekim: bir gün ağaç düzeninde kaldı, eşit karolara geri döndü
            (sahibinin isteği; gerekçe aşağıdaki ızgarada). */}
        {heat.length > 0 && (
          <div className={styles.heat}>
            <div className={styles.heatHead}>
              <h2 data-ink="solid"><SquaresFour size={21} weight="duotone" aria-hidden />{t.markets.heatmap}</h2>
              <p className={styles.heatHint}>{hint}</p>
              <HeatScale locale={locale} label={t.markets.heatScaleHint} steps={t.markets.heatScaleSteps} />
            </div>
            {/* EŞİT KAROLAR, PİYASA DEĞERİ SIRASI (18 Ekim, sahibinin isteği:
                "eski hâline dönsün; her şirketin logosu olsun, aynı boyutta
                olsun, piyasa değerine göre sıralansın"). Ağaç düzeni bir gün
                yayında kaldı. Ondan kalan tek kural: renk yalnız bu seansın
                yüzdesine — öteki karolar nötr (`moves.included`). */}
            {/* KAROLAR KADEMELİ BELİRİR (10 Kasım). Izgara `data-motion-stagger`
                taşıyordu ama harita ilk ekranda akıyor ve `MotionExperience`
                ilk ekrandaki öğeyi hiç oynatmıyor (kuralı): otuz karo tek
                karede beliriyordu. Kademe artık CSS'te (`heat-in`,
                MarketExperience.module.css): karo `--i` sırasıyla 14 ms
                arayla, opaklık ve hafif ölçekle oturuyor; toplam 0,7 sn'nin
                altında, JS beklemiyor. Büyüklük sırası (piyasa değeri)
                soldan sağa okunduğu için kademe de o sırada. */}
            <div className={styles.heatGrid}>
              {heat.map((row, i) => {
                const change = row.changePct;
                const fresh = moves !== null && moves.included[i] && change !== null;
                const magnitude = fresh ? Math.abs(change) : 0;
                const level = magnitude === 0 ? 0 : magnitude < 0.5 ? 1 : magnitude < 1.5 ? 2 : magnitude < 3 ? 3 : 4;
                const tone = !fresh ? "flat" : change > 0 ? "up" : change < 0 ? "down" : "flat";
                return (
                  <Link
                    key={row.symbol}
                    href={`/hisse/${row.symbol}`}
                    prefetch={false}
                    className={styles.heatCell}
                    data-cc={row.symbol}
                    aria-label={`${row.symbol}${row.name ? ` · ${row.name}` : ""}${change !== null ? ` · ${formatPercent(change, locale)}` : ""}`}
                    data-heat-tone={tone}
                    data-heat-level={level}
                    style={{ "--i": i } as CSSProperties}
                  >
                    <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="md" className={styles.heatLogo} />
                    <span className={styles.heatSymbol}>{row.symbol}</span>
                    <span className={cn("numeral", styles.heatPct)}>{change !== null ? formatPercent(change, locale) : NO_VALUE}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {total === 0 && <p className={styles.heatEmpty}>{t.common.noData}</p>}
      <div className={styles.breadthStamp}>
        {children}
        <span className={styles.heatCoverage}>{t.markets.breadthCoverage.replace("{known}", String(total)).replace("{total}", String(memberCount))} · {t.markets.asOf}: {formatEtDateMedium(INDEX_COMPOSITION_DATE, locale)}</span>
      </div>
    </Panel>
  );
}

/* Haritanın renk eşikleri sabittir: %0,5 / %1,5 / %3. Endeks
   değiştirmek aynı hareketi başka bir renge dönüştürmez. */
