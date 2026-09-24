import { GuideHint } from "@/components/article/GuideHint";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import directory from "@/components/motion/DirectoryExperience.module.css";
import styles from "@/components/technical/Technical.module.css";
import { TechnicalBoard } from "@/components/technical/TechnicalBoard";
import { TechnicalCard } from "@/components/technical/TechnicalCard";
import { TechnicalPulse, stanceFilterId } from "@/components/technical/TechnicalPulse";
import { DataStamp, EmptyState, Panel } from "@/components/ui/primitives";
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
  livePriceLabel,
  newestEdition,
  nextEdition,
  pendingSymbols,
  planPosition,
  slotInstant,
  slotLabel,
} from "@/lib/technical";
import { getPublishedSymbols, getTechnicalBoard } from "@/lib/technical-data";
import { formatEtDateCompact, formatEtDateLong, plural } from "@/lib/utils";

/* Künye ayracı: noktadan ÖNCE bölünmez boşluk. Satır noktadan sonra
   kırılır, hiçbir satır noktayla başlamaz (gerekçe künyenin yanında). */
const KUNYE_SEP = "\u00A0· ";

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

  const [board, quotes, meta, publishedSymbols] = await Promise.all([
    getTechnicalBoard(),
    getQuotes(symbols, status),
    getSymbolNames(symbols),
    getPublishedSymbols(),
  ]);
  const quoteMap = quotes.ok ? quotes.data : {};
  /* "Şu An" mı "Son Fiyat" mı — kural `livePriceLabel` üzerinde ve kartla
     dağılım balonu AYNI fonksiyonu soruyor. Kotasyonu olmayan kart
     fotoğraftaki fiyata ve "Analiz Anında" etiketine düşüyor (kartın içinde). */
  const labelFor = (symbol: string) =>
    livePriceLabel(quoteMap[symbol], quotes, status, t) ?? t.market.lastPrice;
  const holidays = await getHolidays();
  const latest = newestEdition(board);
  /* TAKİP EDİLİP PANODA OLMAYANLAR — AMA İKİ AYRI SEBEPLE. Gerekçesi
     `pendingSymbols` üzerinde: listeye yeni giren sembol ilk yayına kadar
     ekrandan tümüyle kayboluyordu.

     İKİ HÂL BİRBİRİNE KARIŞIYORDU. `pendingSymbols`e PANO veriliyordu ve
     pano beş günden taze yayını taşıyor; yayını aksayan bir sembol panodan
     düşünce "takip listesine yeni eklendi, ilk yayından sonra kartı
     görünecek" künyesiyle basılıyordu. Onlarca kez yayımlanmış bir hisse
     için bu cümle yanlış. Soru artık doğru yere soruluyor: "daha önce
     yayımlandı mı" veritabanına, "panoda mı" panoya. */
  const published = new Set(publishedSymbols);
  for (const { row } of board) published.add(row.symbol);
  const pending = pendingSymbols([...published]);
  const onBoard = new Set(board.map(({ row }) => row.symbol));
  const lapsed = TECHNICAL_SYMBOLS.filter(
    (symbol) => published.has(symbol) && !onBoard.has(symbol),
  );
  /* Dial her iki hâli de sayıyor: ikisinde de bugünün kartı yok ve
     "Bekliyor" ikisi için de doğru. Ayrım künyede, çünkü yanlış cümle
     oradaydı. */
  const awaiting = [...pending, ...lapsed];

  const counts: Record<VerdictKey, number> = { buy: 0, hold: 0, sell: 0 };
  for (const { row } of board) counts[verdictOf(row.stance)] += 1;
  const segments = (["all", "buy", "hold", "sell"] as const).filter((key) => key === "all" || counts[key] > 0);

  /* PANO KÜNYESİ: FİYAT PLANA GÖRE NEREDE (23 Eylül). Plan panosunda
     okuyucunun ilk sorusu "hangisi şimdi alınabilir" ve cevabı on beş
     rozetin tek tek okunmasıydı (ölçüldü, 22 Eylül: bölgede 0, bölgeye
     %1'den yakın 5, hepsi bölgenin üstünde). Sıralama seçenek değil —
     kartların sırası bilinçli olarak sabit (yukarıdaki kayıt). Sayı
     KARTIN ROZETİYLE AYNI KAYNAKTAN: aynı fiyat (canlı, yoksa fotoğraf),
     aynı `planPosition`, "yakın" da rozetin YAZDIĞI yuvarlanmış yüzdeyle
     karar veriyor — rozet "%1,0" derken künye onu "%1'den yakın" saymasın. */
  const NEAR_ZONE_PCT = 1;
  const proximity = { inZone: 0, near: 0, belowStop: 0 };
  for (const { row } of board) {
    const position = planPosition(
      quoteMap[row.symbol]?.price ?? row.snapshot.price,
      row.entryLow,
      row.entryHigh,
      row.stop,
    );
    if (!position) continue;
    if (position.kind === "inZone") proximity.inZone += 1;
    else if (position.kind === "belowStop") proximity.belowStop += 1;
    else if (Math.round(position.pct * 10) / 10 < NEAR_ZONE_PCT) proximity.near += 1;
  }

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
            <TechnicalPulse
              locale={locale}
              board={board}
              pending={awaiting}
              meta={meta}
              /* BALONUN FİYATI KARTIN FİYATI: aynı paket, aynı etiket
                 kuralı, yeni kotasyon turu yok. */
              quotes={{ pack: quotes, status }}
              t={t}
            />
          ) : undefined
        }
      >
        {latest && (
          <div className={styles.edition}>
            <div className={styles.editionItem}>
              <span className={styles.editionLabel}>{t.technical.latestEdition}</span>
              {/* TELEFONDA KISA TARİH. İngilizce uzun tarih ("Tuesday,
                  September 22") 320'de yarım sütunda dört satıra sarıyor ve
                  ilk kartı 37 piksel aşağı itiyordu (ölçüldü: ilk kart 597,
                  sekme çubuğu 560). Kısa tarih ("Sep 22") iki satır; geniş
                  ekranda gün adıyla uzun hâl kalıyor. İkisi de DOM'da, biri
                  `display:none` — ekran okuyucu yalnızca görüneni okuyor.
                  AYRAÇ ÖNCEKİ PARÇAYA YAPIŞIK (`KUNYE_SEP`, 23 Eylül): 1024'te
                  İngilizce künye "Tuesday, September 22" ardından kırılıyor
                  ve ikinci satır "· 14:45 NY" diye noktayla başlıyordu. */}
              <span className={styles.editionValue}>
                {slotLabel(latest.slot, t)}
                {KUNYE_SEP}
                <span className={styles.editionDateLong}>{formatEtDateLong(latest.sessionDate, locale)}</span>
                <span className={styles.editionDateShort}>{formatEtDateCompact(latest.sessionDate, locale)}</span>
                {KUNYE_SEP}
                <span className="numeral">{editionTime(latest.sessionDate, latest.slot, locale)}</span>
              </span>
            </div>
            {next && (
              <div className={styles.editionItem}>
                <span className={styles.editionLabel}>{t.technical.nextEdition}</span>
                <span className={styles.editionValue}>
                  {slotLabel(next.slot, t)}
                  {KUNYE_SEP}
                  <span className="numeral">{editionClock(next.at, locale)}</span>
                  {todayEt(next.at) !== status.etDate && (
                    <>{KUNYE_SEP}{formatEtDateCompact(todayEt(next.at), locale)}</>
                  )}
                </span>
              </div>
            )}
            {/* TELEFONDA PROGRAM BURADA DEĞİL, DİPNOTTA (23 Eylül). 320×640'ta
                başlık kartı ilk kartı ekranın dışına itiyordu ve bu satır
                (29 piksel) ilk ekranda hiçbir karara yaramıyor: okuyucunun
                o an sorduğu "sıradaki ne zaman" hemen solunda. Cümle
                dipnota iniyor (`.footSchedule`), kaybolmuyor. */}
            <div className={styles.editionItem} data-item="schedule">
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
          {/* ARAÇ ÇUBUĞU YAPIŞKAN (23 Eylül). Süzgeç yalnızca panonun
              başındaydı: 1440'ta 4.071, 390'da 10.855 piksellik sayfada
              görüş değiştirmek için en üste dönmek gerekiyordu. Masaüstünde
              bütün çubuk (başlık, künye, süzgeç) uygulama çubuğunun altına
              yapışıyor; telefonda yalnızca süzgeç (`.filterBar`), başlık ve
              künye akışta kalıyor. Yapıştığında tam genişlikte bir bant
              açılıyor (`data-stuck`, `TechnicalBoard`) — detay sayfasının
              bölüm çubuğuyla aynı dil. */}
          <div className={styles.boardToolbar} data-sticky-bar>
            <div className={styles.boardHeading}>
              {/* Başlığın önünde "01" rozeti vardı; sayfada ikinci bir
                  bölüm numarası yok, yani sıra bildirmeyen bir süstü (sahibi:
                  "anlamsız", 23 Eylül). Kaldırılınca başlığın tek çocuklu
                  sarmalayıcısı da kalktı. */}
              <h2 id="technical-board" className={styles.boardTitle}>{t.technical.boardTitle}</h2>
              <dl className={styles.proximity} aria-label={t.technical.proximityLabel}>
                <div data-tone={proximity.inZone > 0 ? "up" : undefined}>
                  <dt>{t.technical.proximityInZone}</dt>
                  <dd className="numeral">{proximity.inZone}</dd>
                </div>
                <div>
                  <dt>{t.technical.proximityNear}</dt>
                  <dd className="numeral">{proximity.near}</dd>
                </div>
                <div data-tone={proximity.belowStop > 0 ? "down" : undefined}>
                  <dt>{t.technical.proximityBelowStop}</dt>
                  <dd className="numeral">{proximity.belowStop}</dd>
                </div>
              </dl>
            </div>
            <div className={styles.filterBar} data-sticky-bar>
              {/* EŞİT BÖLMELİ, KAYAN BAŞPARMAKLI. Dört kelime gri bir izin
                  üstünde dağınık duruyordu (390'da aralarında 26 piksellik
                  delikler) ve 320'de "SAT" tek başına ikinci satıra
                  düşüyordu. Bölmeler artık eşit sütunlar; seçimi gösteren
                  kutu (kartın yüzey tonunda) radyonun sırasını (`data-i`)
                  CSS'ten okuyup kayıyor, JavaScript gerekmiyor. */}
              <fieldset className={styles.filter} style={{ "--n": segments.length } as React.CSSProperties}>
                <legend>{t.technical.filterLabel}</legend>
                {segments.map((key, index) => (
                  <span key={key} className="contents">
                    {/* Radyonun iki etiketi var (bu çip ve başlıktaki dağılım
                        satırı); açık ad olmadan ekran okuyucu ikisini birleştirip
                        "SAT 2 SAT 2" diyordu. */}
                    <input
                      type="radio"
                      name="technical-stance"
                      id={stanceFilterId(key)}
                      value={key}
                      data-i={index}
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
                  priceLabel={labelFor(row.symbol)}
                  /* Pano beş güne kadar eski yayınları da taşıyor; en yeni
                     yayından olmayan kart ayağında bunu söylüyor. */
                  stale={row.sessionDate !== latest.sessionDate || row.slot !== latest.slot}
                  locale={locale}
                  t={t}
                />
              </div>
            ))}
          </div>

          {/* BEKLEYENLER IZGARANIN ALTINDA, İÇİNDE DEĞİL. Kartlar altı
              satırlık bir alt ızgarayı paylaşıyor (bkz. `.grid`/`.cell`);
              yayını olmayan bir sembolün kartı o satırların dördünü boş
              bırakır ve bandın boyuna gerilip yarım kalmış bir kart gibi
              durur. Künye tek satır: adları yazıyor, logoları da
              başlıktaki dağılımda duruyor. İki künye ayrı, çünkü iki hâl
              ayrı şey söylüyor. */}
          {pending.length > 0 && (
            <p className={styles.pendingNote}>
              {plural(pending.length, t.technical.pendingNoteOne, t.technical.pendingNoteMany)
                .replace("{symbols}", pending.join(", "))}
            </p>
          )}
          {lapsed.length > 0 && (
            <p className={styles.pendingNote}>
              {plural(lapsed.length, t.technical.lapsedNoteOne, t.technical.lapsedNoteMany)
                .replace("{symbols}", lapsed.join(", "))}
            </p>
          )}
        </TechnicalBoard>
      )}

      <div className={styles.footNote}>
        {latest && (
          <p className={styles.footSchedule}>
            {t.technical.scheduleLabel}: {scheduleText}
          </p>
        )}
        <p>{t.technical.method}</p>
        <p>{t.technical.disclaimer}</p>
      </div>

      {/* YEDİNCİ ADIM BURADA EKSİKTİ. Ekranın en büyük sayısı kart
          başındaki fiyat ve o fiyat canlı kotasyondan geliyor, ama
          `getQuotes` çağıran on bir sayfanın yalnızca bu ikisi damgasızdı:
          kaynak, çekilme saati ve 15 dakikalık gecikme hiçbir yerde
          yazmıyordu. Bayatlık da yalnızca "Şu An" etiketini düşürüyordu —
          o etiket seans dışında zaten düşüyor, yani bayatlığın kendi
          işareti yoktu. Sıra ekranın kuralıyla aynı: künye, sonra damga,
          sonra `GuideHint`. */}
      {quotes.ok && (
        <DataStamp
          labels={t.data}
          source={quotes.source}
          at={quotes.fetchedAt}
          stale={quotes.stale}
          locale={locale}
          /* Seans dışında kartların değişimi satır satır farklı bir güne
             dayanabiliyor; seans içinde hepsi aynı günü gösteriyor. */
          note={
            status.session === "pre-market" || status.session === "after-hours"
              ? t.data.extendedNote
              : undefined
          }
        />
      )}

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
