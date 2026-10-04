import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { changeToneClass, planPositionLabel } from "@/components/technical/TechnicalCard";
import { PlanStrip } from "@/components/technical/PlanStrip";
import technical from "@/components/technical/Technical.module.css";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, verdictPillClass } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { planPosition, slotLabel, stanceChangeLabel, technicalHref } from "@/lib/technical";
import { getTechnicalBoard } from "@/lib/technical-data";
import { cn, formatEtDateCompact, formatPercent, formatPrice } from "@/lib/utils";
import styles from "./Portfolio.module.css";

export type TechnicalHolding = {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  /** Lotların ağırlıklı ortalaması, hisse başına dolar. */
  avgCost: number;
  /** Pozisyon tablosunun fiyatı — aynı sayı iki yerde, aynı kaynak. */
  price: number | null;
};

/**
 * PORTFÖYÜN TEKNİK PLANI — "elimdekini nereden ekler, nereden satarım".
 *
 * Teknik analiz on beş sembol için günde üç kez alım bölgesi, satış
 * hedefleri ve stop yazıyor; okuyucunun portföyünde o sembollerden biri
 * varsa plan iki ekran ötedeydi. Panel yalnızca KESİŞİMİ basıyor: kapsam
 * dışı pozisyonu olan okuyucu boş bir "analiz yok" kutusu görmüyor, panel
 * hiç çizilmiyor.
 *
 * SEVİYELER YENİDEN YAZILMIYOR. Hücreler teknik analiz kartının kendi
 * şeridi (`PlanStrip` — Nereden Alınır / Nerede Satılır / Nerede
 * Vazgeçilir); görüşe göre değişen hücre kuralları da onunla geliyor (SAT'ta
 * alım hücresi yok). Panelin EKLEDİĞİ tek şey kişisel satır: ortalama
 * maliyet, ilk hedefe ve stopa uzaklık, stopun maliyete göre yeri. Bu
 * okuma teknik analiz sayfasında olamaz, çünkü orada maliyet yok.
 *
 * FİYAT TABLODAN. Uzaklıklar pozisyon tablosundaki fiyatla hesaplanıyor,
 * analizin fotoğrafındaki fiyatla değil: aynı ekranda iki farklı "şu anki
 * fiyat" duramaz (CLAUDE.md, veri dürüstlüğü 3). Fiyat yoksa uzaklık da
 * yazılmıyor.
 *
 * PANO AYNI ÇAĞRI. `getTechnicalBoard` istek içinde önbellekli ve beş
 * günden eski yayını zaten eliyor; bayat bir plan portföyde de görünmüyor.
 */
export async function PortfolioTechnical({
  holdings,
  locale,
  t,
}: {
  holdings: TechnicalHolding[];
  locale: Locale;
  t: Dictionary;
}) {
  const held = new Map(holdings.map((holding) => [holding.symbol, holding]));
  const board = await getTechnicalBoard();
  const entries = board.filter((entry) => held.has(entry.row.symbol));
  if (entries.length === 0) return null;

  const P = t.portfolioTechnical;
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const pct = (value: number) => formatPercent(value, locale, 1);

  return (
    <Panel>
      <PanelHeader
        title={P.title}
        meta={entries.length === 1 ? P.metaOne : P.meta.replace("{n}", String(entries.length))}
      />
      <p className="px-4 pb-1 text-small leading-relaxed text-muted sm:px-5">{P.intro}</p>
      <ul className={styles.techGrid}>
        {entries.map(({ row, previousStance }) => {
          const holding = held.get(row.symbol)!;
          const verdict = verdictOf(row.stance);
          const change = stanceChangeLabel(verdict, previousStance, t);
          const price = holding.price;
          const position = planPosition(price, row.entryLow, row.entryHigh, row.stop);

          /* İlk satış seviyesi: fiyatın ÜSTÜNDEKİ ilk hedef; SAT'ta hedef
             yoksa direnç — PlanStrip'in "Tepkide Satış" hücresiyle aynı
             liste, aynı sıra. */
          const sellLevels = verdict === "sell" && row.targets.length === 0 ? row.resistances : row.targets;
          const sorted = [...sellLevels].sort((a, b) => a - b);
          const nextUp = price !== null ? sorted.find((level) => level > price) : undefined;
          const toTarget = price !== null && nextUp !== undefined ? ((nextUp - price) / price) * 100 : null;
          const toStop = price !== null && row.stop !== null && price >= row.stop ? ((row.stop - price) / price) * 100 : null;

          return (
            <li key={row.symbol} className={styles.techCard} data-verdict={verdict}>
              <div className={styles.techHead}>
                <LogoTile symbol={row.symbol} logoUrl={holding.logoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-strong">{row.symbol}</p>
                  {holding.name && <p className="truncate text-small text-muted">{holding.name}</p>}
                </div>
                <div className={styles.techStance}>
                  <span className={cn(technical.stancePill, verdictPillClass(verdict))}>
                    {verdictLabel(verdict, t)}
                  </span>
                  {change && <span className={cn(technical.change, changeToneClass(verdict))}>{change}</span>}
                </div>
              </div>

              {position && (
                <span className={technical.plan} data-kind={position.kind}>
                  {planPositionLabel(position, locale, t)}
                </span>
              )}

              <PlanStrip
                verdict={verdict}
                entryLow={row.entryLow}
                entryHigh={row.entryHigh}
                stop={row.stop}
                targets={row.targets}
                supports={row.supports}
                resistances={row.resistances}
                locale={locale}
                t={t}
              />

              {/* Kişisel satır — fiyat, maliyet ve uzaklıklar. Ölçüler aynı
                  hatta biter (alt ızgara), birimler sayıdan kopmaz.
                  Şu anki fiyat 4 Ekim'de eklendi (sahibinin isteği): uzaklıklar
                  ona göre hesaplanıyordu ama sayının kendisi kartta yoktu,
                  okuyucu "%5,5 neyin %5,5'i" diye tabloya dönüyordu. Kaynak
                  pozisyon tablosunun fiyatı — aynı ekranda tek fiyat. */}
              <dl className={styles.techMine}>
                <div>
                  <dt>{P.price}</dt>
                  <dd className="numeral">{price !== null ? money(price) : "—"}</dd>
                </div>
                <div>
                  <dt>{P.avgCost}</dt>
                  <dd className="numeral">{money(holding.avgCost)}</dd>
                </div>
                <div>
                  <dt>{verdict === "sell" ? P.toSellLevel : P.toTarget}</dt>
                  <dd className="numeral" data-tone={toTarget !== null ? "up" : undefined}>
                    {toTarget !== null ? pct(toTarget) : nextUp === undefined && sorted.length > 0 && price !== null ? P.targetsPassed : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{P.toStop}</dt>
                  <dd className="numeral" data-tone={toStop !== null || position?.kind === "belowStop" ? "down" : undefined}>
                    {toStop !== null ? pct(toStop) : position?.kind === "belowStop" ? P.belowStop : "—"}
                  </dd>
                </div>
              </dl>
              {row.stop !== null && (
                <p className="text-small text-muted">
                  {P.stopVsCost.replace("{dir}", row.stop >= holding.avgCost ? P.stopAboveCost : P.stopBelowCost)}
                </p>
              )}

              <div className={styles.techFoot}>
                <span>
                  {slotLabel(row.slot, t)} · {formatEtDateCompact(row.sessionDate, locale)}
                </span>
                <Link href={technicalHref(row.symbol)} className={styles.techLink}>
                  {t.technical.readAnalysis}
                  <ArrowUpRight size={13} weight="bold" aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line px-4 py-3 text-small leading-relaxed text-muted sm:px-5">{P.note}</p>
    </Panel>
  );
}
