import { PageShare } from "@/components/article/PageShare";
import { GuideHint } from "@/components/article/GuideHint";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import directory from "@/components/motion/DirectoryExperience.module.css";
import styles from "@/components/technical/Technical.module.css";
import { EditionTrack } from "@/components/technical/EditionTrack";
import { PlanAtlas } from "@/components/technical/PlanAtlas";
import { TechnicalBoard } from "@/components/technical/TechnicalBoard";
import { TechnicalCard } from "@/components/technical/TechnicalCard";
import { STANCE_GUIDE_SLUG, StanceGuide } from "@/components/technical/StanceGuide";
import { TechnicalPulse, stanceFilterId } from "@/components/technical/TechnicalPulse";
import { DataStamp, EmptyState, Panel } from "@/components/ui/primitives";
import { verdictLabel, verdictOf, type VerdictKey } from "@/lib/analysis";
import { getHolidays, getStatus, getSymbolNames } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { displayZone, formatInZone } from "@/lib/session-clock";
import {
  TECHNICAL_SYMBOLS,
  editionTime,
  livePriceLabel,
  newestEdition,
  nextEdition,
  pendingSymbols,
  slotInstant,
} from "@/lib/technical";
import { getPublishedSymbols, getTechnicalBoard } from "@/lib/technical-data";
import { atlasSummary } from "@/lib/technical-visuals";
import { plural } from "@/lib/utils";


export const generateMetadata = pageMetadata({
  path: "/teknik-analiz",
  tr: {
    title: "ABD Hisseleri Teknik Analizi: Destek ve Direnç",
    description:
      "Takip edilen hisselerin günlük teknik görünümü: ortalamalar, destek ve direnç, alım bölgesi ve stop.",
  },
  en: {
    title: "US Stocks: Technical Analysis and Levels",
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
  /* 25 Ekim: hesap `atlasSummary`e taşındı (lib/technical-visuals.ts) —
     araç çubuğunun üç sayısı ile plan atlasının cümlesi artık AYNI
     fonksiyondan, aynı fiyatla; ikisi ayrı döngülerde yaşasaydı bir gün
     aynı ekranda iki farklı "yakın" sayısı dururdu. */
  const summary = atlasSummary(
    board.map(({ row }) => ({
      price: quoteMap[row.symbol]?.price ?? row.snapshot.price,
      entryLow: row.entryLow,
      entryHigh: row.entryHigh,
      stop: row.stop,
    })),
  );
  const proximity = { inZone: summary.inZone, near: summary.near, belowStop: summary.belowStop };

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
        shareInTitle
        share={<PageShare compactOnMobile align="right" path="/teknik-analiz" title={t.technical.title} locale={locale} t={t} />}
        className={styles.directoryHeader}
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
        {/* YAYIN KÜNYESİ BİR ŞERİT (8 Kasım, sahibinin isteği: "daha görsel,
            alanı daha iyi kullanacak şekilde"). Burada üç düz künye vardı:
            "Son Yayın", "Sıradaki Yayın" (kalan süreyle) ve program cümlesi.
            Kayıtlı dersleri şeride taşındı: tarih ve saat bölünmez
            (`white-space:nowrap`; eskiden `KUNYE_SEP` ayracı ve telefonda kısa
            tarih bunu çözüyordu — şeritte ayraç yok, saat kendi satırında),
            kalan süre kendi yerinde (başlık satırının sağı). Program cümlesi
            dipnotta, artık her genişlikte (`.footSchedule`): üç saat şeridin
            kendisinde çizili. Gerekçe ve ölçüm `EditionTrack`te. */}
        {latest && (
          <div className={styles.editionTrack}>
            <EditionTrack edition={latest} next={next} variant="latest" locale={locale} t={t} />
          </div>
        )}
        {/* PANO KÜNYESİ BAŞLIK KARTINDA, ÜÇ ÖLÇÜ (10 Kasım). Üç sayı "Hisse
            Planları" başlığının yanında 15 piksellik bir satırdı; başlık
            kartında ise yayın şeridinin altı boştu (sağdaki dağılım daha
            uzun: 1440'ta 89, 1024'te 106 piksel, ölçüldü). Sayfanın ilk
            sorusu ("hangisi şimdi alınabilir") artık ilk ekranda ve display
            puntoyla; boşluk esnetilmedi, dolduruldu (1440: 89 → 9 piksel).
            Telefonda tek satırlık künye olarak kalıyor (CSS `.headStats`):
            orada başlık kartı zaten 491 piksel. Hesap ve "yakın" kuralı
            aşağıda, `summary`de; aynı sayılar atlas cümlesinde. */}
        {/* 14 Kasım 2026 (görsel tur): üç sayı bağlamsız duruyordu ("4 Bölgede"
            neyin dördü?). Üstüne ad ve payda ("Plana Göre Fiyat · 7 Alım
            Planı"), altına aynı üç sayının kalın şeridi geldi: yedi planın
            kaçı bölgede (yükseliş), kaçı yakın (nötr), kaçı stopun altında
            (düşüş). Sayılar ve kural aynı (`summary`); yeni veri yok. */}
        {board.length > 0 && latest && summary.plans > 0 && (
          <div className={styles.headGauge}>
            <p className={styles.headGaugeLabel}>
              <b>{t.technical.proximityLabel}</b>
              <span className="numeral">{t.technicalVisuals.plansCount.replace("{n}", String(summary.plans))}</span>
            </p>
            <span className="value-lane" data-draw aria-hidden style={{ "--lane-h": "8px" } as React.CSSProperties}>
              {proximity.inZone > 0 && (
                <i className="value-bar bar-fill" data-tone="up" data-end={proximity.near + proximity.belowStop === 0 ? "end" : undefined} style={{ left: 0, width: `${(proximity.inZone / summary.plans) * 100}%`, borderRadius: "999px 0 0 999px" }} />
              )}
              {proximity.near > 0 && (
                <i className="value-bar bar-fill" style={{ left: `${(proximity.inZone / summary.plans) * 100}%`, width: `${(proximity.near / summary.plans) * 100}%`, borderRadius: 0 }} />
              )}
              {proximity.belowStop > 0 && (
                <i className="value-bar bar-fill" data-tone="down" style={{ right: 0, width: `${(proximity.belowStop / summary.plans) * 100}%`, borderRadius: "0 999px 999px 0" }} />
              )}
            </span>
          </div>
        )}
        {board.length > 0 && latest && (
          <dl className={styles.headStats} aria-label={t.technical.proximityLabel}>
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
        )}
      </DirectoryHeader>

      {board.length === 0 || !latest ? (
        <Panel>
          <EmptyState title={t.technical.empty} hint={t.technical.emptyHint} scene="chart" />
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
              {/* Üç sayılık pano künyesi 10 Kasım'da başlık kartına çıktı
                  (`.headStats`, yukarıda); çubukta başlık ve süzgeç kaldı. */}
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
              <div key={row.symbol} className={styles.cell} data-verdict={verdictOf(row.stance)} data-morph-scope>
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

      {/* HARİTA KARTLARIN ALTINDA (25 Ekim, sahibinin isteği): önce
          başlığın hemen altında, kartlardan önceydi; 1440'ta ilk ekranı
          tümüyle kaplıyor ve okur sayfayı açınca planları değil haritayı
          görüyordu ("ilk açılışta hisse planlarını görelim"). Kartlar
          ana içerik; harita on altı planı yan yana okumak isteyene özet. */}
      {board.length > 0 && latest && (
        <PlanAtlas
          items={board.map(({ row }) => ({
            row,
            quote: quoteMap[row.symbol] ?? null,
            company: meta[row.symbol]?.name ?? null,
            priceLabel: labelFor(row.symbol),
          }))}
          summary={summary}
          locale={locale}
          t={t}
        />
      )}

      {/* Kartlar görüşü tek kelimeyle söylüyor; o kelimenin anlamı
          panonun hemen altında, künyeden önce. */}
      <StanceGuide variant="board" t={t} id="technical-stances" />

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
        slugs={[STANCE_GUIDE_SLUG, "risk-yonetimi"]}
      />
    </MotionExperience>
  );
}
