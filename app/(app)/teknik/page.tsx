import { GuideHint } from "@/components/article/GuideHint";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import directory from "@/components/motion/DirectoryExperience.module.css";
import styles from "@/components/technical/Technical.module.css";
import { TechnicalCard } from "@/components/technical/TechnicalCard";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, verdictPillClass, type VerdictKey } from "@/lib/analysis";
import { getStatus, getSymbolNames } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { displayZone, formatInZone } from "@/lib/session-clock";
import {
  SLOT_RANK,
  TECHNICAL_SYMBOLS,
  editionTime,
  slotInstant,
  slotLabel,
  type TechnicalSlot,
} from "@/lib/technical";
import { getTechnicalBoard } from "@/lib/technical-data";
import { cn, formatEtDateLong } from "@/lib/utils";

export const generateMetadata = pageMetadata({
  path: "/teknik",
  tr: {
    title: "Teknik Analiz",
    description:
      "On iki hissenin günlük teknik görünümü: ortalamalar, destek ve direnç, alım bölgesi ve stop.",
  },
  en: {
    title: "Technical Analysis",
    description:
      "Daily technical outlook for twelve stocks: moving averages, support and resistance, entry zone and stop.",
  },
});

/**
 * Teknik analiz — on iki hissenin günlük görünümü.
 *
 * Kart başına tek hisse, sıra `TECHNICAL_SYMBOLS`in sırası: okuyucu her
 * gün aynı hisseyi aynı yerde bulsun. Görüşe göre sıralamak (önce AL'lar)
 * kartları her yayında yer değiştirirdi.
 *
 * Veri iki kaynaktan ve ikisi ayrı yazılıyor: görüş ve seviyeler kayıttan
 * (rutinin yazdığı), fiyat canlı kotasyondan. Kotasyon düşerse kart
 * fotoğraftaki fiyatı gösterir; kayıt yoksa sayfa boş durumu gösterir.
 */
export default async function TechnicalPage() {
  const { locale, t } = await getI18n();
  const status = await getStatus();
  const symbols = [...TECHNICAL_SYMBOLS];

  const [board, quotes, meta] = await Promise.all([
    getTechnicalBoard(),
    getQuotes(symbols, status),
    getSymbolNames(symbols),
  ]);
  const quoteMap = quotes.ok ? quotes.data : {};
  /* "Şu An" yalnızca ana seans açık ve kotasyon tazeyken. Seans dışında
     son işlem ya dünkü kapanış ya uzatılmış seansın fiyatı; ikisine de
     "şu an" demek sayıyı olduğundan taze gösterir. */
  const priceLabel =
    status.session === "regular" && quotes.ok && !quotes.stale
      ? t.technical.now
      : t.market.lastPrice;

  const latest = board.reduce<{ sessionDate: string; slot: string } | null>((best, { row }) => {
    if (!best) return row;
    const rank = (r: { sessionDate: string; slot: string }) =>
      `${r.sessionDate}:${SLOT_RANK[r.slot as TechnicalSlot] ?? 0}`;
    return rank(row) > rank(best) ? row : best;
  }, null);

  const counts: Record<VerdictKey, number> = { buy: 0, hold: 0, sell: 0 };
  for (const { row } of board) counts[verdictOf(row.stance)] += 1;

  /* Program cümlesi o günün tarihiyle: New York karşılığı yaz saatiyle
     kayıyor, künye yalnızca sonda bir kez yazılıyor. */
  const scheduleText = t.technical.schedule
    .replace("{pre}", formatInZone(slotInstant(status.etDate, "premarket"), displayZone(locale)))
    .replace("{mid}", editionTime(status.etDate, "midsession", locale));

  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
      <DirectoryHeader
        eyebrow={t.technical.eyebrow}
        title={t.technical.title}
        description={t.technical.description}
      />

      {board.length === 0 || !latest ? (
        <Panel>
          <EmptyState title={t.technical.empty} hint={t.technical.emptyHint} />
        </Panel>
      ) : (
        <>
          <div className={styles.strip}>
            <div className={styles.stripItem}>
              <span className={styles.stripLabel}>{t.technical.latestEdition}</span>
              <span className={styles.stripValue}>
                {slotLabel(latest.slot, t)} · {formatEtDateLong(latest.sessionDate, locale)} ·{" "}
                <span className="numeral">{editionTime(latest.sessionDate, latest.slot, locale)}</span>
              </span>
            </div>
            <div className={styles.stripItem}>
              <span className={styles.stripLabel}>{t.technical.scheduleLabel}</span>
              <span className={styles.stripValue}>{scheduleText}</span>
            </div>
            <div className={styles.stripCounts}>
              {(["buy", "hold", "sell"] as const).map((verdict) => (
                <span key={verdict} className={cn(styles.count, verdictPillClass(verdict))}>
                  {verdictLabel(verdict, t)} <b>{counts[verdict]}</b>
                </span>
              ))}
            </div>
          </div>

          <div className={styles.grid} data-motion-stagger>
            {board.map(({ row, previousStance }) => (
              <TechnicalCard
                key={row.symbol}
                row={row}
                previousStance={previousStance}
                quote={quoteMap[row.symbol] ?? null}
                company={meta[row.symbol]?.name ?? null}
                logoUrl={meta[row.symbol]?.logoUrl ?? null}
                priceLabel={priceLabel}
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </>
      )}

      <div className={styles.footNote}>
        <p>{t.technical.method}</p>
        <p>{t.technical.disclaimer}</p>
      </div>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        /* İKİ YAZI: şerit iki sütunlu ve üçüncü kart tek başına alt satıra
           düşüyordu (ölçüldü). Seviyeyle en doğrudan ilgili ikisi: stopun ne
           kadar uzağa konacağı ve stop emrinin kendisi. */
        slugs={["risk-yonetimi", "emir-tipleri"]}
      />
    </MotionExperience>
  );
}
