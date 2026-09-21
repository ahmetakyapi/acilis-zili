import { GuideHint } from "@/components/article/GuideHint";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import directory from "@/components/motion/DirectoryExperience.module.css";
import styles from "@/components/technical/Technical.module.css";
import { TechnicalBoard } from "@/components/technical/TechnicalBoard";
import { TechnicalCard } from "@/components/technical/TechnicalCard";
import { TechnicalPulse, stanceFilterId } from "@/components/technical/TechnicalPulse";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, type VerdictKey } from "@/lib/analysis";
import { getHolidays, getStatus, getSymbolNames } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { todayEt } from "@/lib/market-hours";
import { displayZone, formatInZone } from "@/lib/session-clock";
import {
  TECHNICAL_SYMBOLS,
  editionClock,
  editionTime,
  newestEdition,
  nextEdition,
  pendingSymbols,
  slotInstant,
  slotLabel,
} from "@/lib/technical";
import { getTechnicalBoard } from "@/lib/technical-data";
import { formatEtDateCompact, formatEtDateLong } from "@/lib/utils";

export const generateMetadata = pageMetadata({
  path: "/teknik",
  tr: {
    title: "Teknik Analiz",
    description:
      "Takip edilen hisselerin günlük teknik görünümü: ortalamalar, destek ve direnç, alım bölgesi ve stop.",
  },
  en: {
    title: "Technical Analysis",
    description:
      "Daily technical outlook for the stocks we follow: moving averages, support and resistance, entry zone and stop.",
  },
});

/**
 * Teknik analiz — takip listesindeki hisselerin günlük görünümü.
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

  const holidays = await getHolidays();
  const latest = newestEdition(board);
  /* TAKİP EDİLİP HENÜZ YAYINI OLMAYANLAR. Gerekçesi `pendingSymbols`
     üzerinde: listeye yeni giren sembol ilk yayına kadar ekrandan tümüyle
     kayboluyordu. */
  const pending = pendingSymbols(board.map(({ row }) => row.symbol));

  const counts: Record<VerdictKey, number> = { buy: 0, hold: 0, sell: 0 };
  for (const { row } of board) counts[verdictOf(row.stance)] += 1;

  /* Program cümlesi o günün tarihiyle: New York karşılığı yaz saatiyle
     kayıyor, künye yalnızca sonda bir kez yazılıyor.

     ÜÇÜNCÜ NÖBET BURAYA DA GİRDİ. Rutin günde üç koşuyor ama bu cümle iki
     saat yazıyordu: okuyucuya ilan edilen program, sitenin gerçekte
     yaptığından eksikti. */
  const scheduleText = t.technical.schedule
    .replace("{pre}", formatInZone(slotInstant(status.etDate, "premarket"), displayZone(locale)))
    .replace("{mid}", formatInZone(slotInstant(status.etDate, "midsession"), displayZone(locale)))
    .replace("{late}", editionTime(status.etDate, "lateday", locale));

  /* Sıradaki yayın — gerekçesi `nextEdition` üzerinde. Tatil ve hafta sonu
     kendiliğinden eleniyor, o yüzden burada ek bir koşul yok. */
  const next = nextEdition(new Date(), holidays);

  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
      <DirectoryHeader
        className={styles.directoryHeader}
        eyebrow={t.technical.eyebrow}
        title={t.technical.title}
        description={t.technical.description}
        visual={
          latest ? (
            <TechnicalPulse board={board} pending={pending} meta={meta} t={t} />
          ) : undefined
        }
      >
        {latest && (
          <div className={styles.edition}>
            <div className={styles.editionItem}>
              <span className={styles.editionLabel}>{t.technical.latestEdition}</span>
              <span className={styles.editionValue}>
                {slotLabel(latest.slot, t)} · {formatEtDateLong(latest.sessionDate, locale)} ·{" "}
                <span className="numeral">{editionTime(latest.sessionDate, latest.slot, locale)}</span>
              </span>
            </div>
            {next && (
              <div className={styles.editionItem}>
                <span className={styles.editionLabel}>{t.technical.nextEdition}</span>
                <span className={styles.editionValue}>
                  {slotLabel(next.slot, t)} ·{" "}
                  <span className="numeral">{editionClock(next.at, locale)}</span>
                  {todayEt(next.at) !== status.etDate && (
                    <> · {formatEtDateCompact(todayEt(next.at), locale)}</>
                  )}
                </span>
              </div>
            )}
            <div className={styles.editionItem}>
              <span className={styles.editionLabel}>{t.technical.scheduleLabel}</span>
              <span className={styles.editionValue}>{scheduleText}</span>
            </div>
          </div>
        )}
      </DirectoryHeader>

      {board.length === 0 || !latest ? (
        <Panel>
          <EmptyState title={t.technical.empty} hint={t.technical.emptyHint} />
        </Panel>
      ) : (
        <TechnicalBoard className={styles.board}>
          <div className={styles.boardToolbar}>
            <div className={styles.boardTitle}>
              <span aria-hidden="true">01</span>
              <h2 id="technical-board">{t.technical.boardTitle}</h2>
            </div>
            <fieldset className={styles.filter}>
              <legend>{t.technical.filterLabel}</legend>
              {(["all", "buy", "hold", "sell"] as const)
                .filter((key) => key === "all" || counts[key] > 0)
                .map((key) => (
                  <span key={key} className="contents">
                    {/* Radyonun iki etiketi var (bu çip ve başlıktaki dağılım
                        satırı); açık ad olmadan ekran okuyucu ikisini birleştirip
                        "SAT 2 SAT 2" diyordu. */}
                    <input
                      type="radio"
                      name="technical-stance"
                      id={stanceFilterId(key)}
                      value={key}
                      defaultChecked={key === "all"}
                      aria-label={`${key === "all" ? t.technical.filterAll : verdictLabel(key, t)} ${key === "all" ? board.length : counts[key]}`}
                    />
                    <label htmlFor={stanceFilterId(key)}>
                      {key === "all" ? t.technical.filterAll : verdictLabel(key, t)}
                      <b className="numeral">{key === "all" ? board.length : counts[key]}</b>
                    </label>
                  </span>
                ))}
            </fieldset>
          </div>

          <div className={styles.grid} data-motion-stagger>
            {board.map(({ row, previousStance }) => (
              <div key={row.symbol} className={styles.cell} data-verdict={verdictOf(row.stance)}>
                <TechnicalCard
                  row={row}
                  previousStance={previousStance}
                  quote={quoteMap[row.symbol] ?? null}
                  company={meta[row.symbol]?.name ?? null}
                  logoUrl={meta[row.symbol]?.logoUrl ?? null}
                  priceLabel={priceLabel}
                  locale={locale}
                  t={t}
                />
              </div>
            ))}
          </div>

          {pending.length > 0 && (
            /* BEKLEYENLER IZGARANIN ALTINDA, İÇİNDE DEĞİL. Kartlar altı
               satırlık bir alt ızgarayı paylaşıyor (bkz. `.grid`/`.cell`);
               yayını olmayan bir sembolün kartı o satırların dördünü boş
               bırakır ve bandın boyuna gerilip yarım kalmış bir kart gibi
               durur. Künye tek satır: adları yazıyor, logoları da
               başlıktaki dağılımda duruyor. */
            <p className={styles.pendingNote}>
              {t.technical.pendingNote.replace("{symbols}", pending.join(", "))}
            </p>
          )}
        </TechnicalBoard>
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
