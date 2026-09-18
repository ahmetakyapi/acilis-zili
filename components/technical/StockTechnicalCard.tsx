import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { verdictLabel, verdictOf, verdictPillClass } from "@/lib/analysis";
import { getHolidays, getStatus } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { getQuote } from "@/lib/providers";
import {
  editionClock,
  isTechnicalSymbol,
  nextEdition,
  planPosition,
  slotLabel,
  stanceChangeLabel,
  technicalHref,
} from "@/lib/technical";
import { getTechnicalDetail } from "@/lib/technical-data";
import { cn, formatEtDateCompact } from "@/lib/utils";
import { changeToneClass, planPositionLabel } from "./TechnicalCard";
import styles from "./Technical.module.css";

/**
 * Şirket sayfasının teknik analiz kartı — KISA HÂLİ.
 *
 * Bağlantı uzun süre TEK YÖNLÜYDÜ: teknik analiz sayfası şirkete gidiyor,
 * şirket sayfası hissenin günlük teknik analizi olduğunu hiç söylemiyordu.
 * Arada bir köprü vardı ama görünmezdi — Hareketli Ortalamalar panelinin
 * başlığındaki küçük bağlantı, sayfanın ortasında, katlamanın çok altında.
 *
 * KART ÖZETLER, ANLATMAZ. Buraya giren dört şey var: görüş (tek kelime),
 * gerekçesinin ilk cümlesi, fiyatın plana göre YERİ ve yayının künyesi.
 * Seviyeler, senaryolar, göstergeler ve geçmiş bilerek yok — onların yeri
 * analiz sayfası ve kart oraya götürüyor. Sağdaki kolonda profil kartıyla
 * yan yana duruyor; uzun bir kart o kolonu grafiğin iki katına çıkarırdı.
 *
 * KAPSAM DIŞI SEMBOLDE HİÇ BASILMIYOR. `isTechnicalSymbol` saf bir küme
 * sorgusu (on iki sembol), yani 800 şirketin geri kalanında ne sorgu ne
 * yer tutucu maliyeti var. Kapsamdaki sembolde de analiz henüz
 * yayımlanmadıysa kart yine basılmıyor: boş bir "analiz yok" kutusu
 * okuyucuya bir şey söylemiyor.
 *
 * FİYAT AYNI ANAHTARDAN. Konum çipi ("Bölgenin %1,9 Üstünde") canlı fiyata
 * bağlı ve o fiyatı sayfa başlığı zaten `getQuote(symbol)` ile soruyor —
 * aynı anahtar, istek içinde tek çağrı. Teknik analiz sayfası on iki
 * sembolü birden soruyor; burada o listeyi sormak aynı ekranda kullanılmayan
 * on bir sembol için sağlayıcıya gitmek olurdu.
 */
export async function StockTechnicalCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  if (!isTechnicalSymbol(symbol)) return null;
  const detail = await getTechnicalDetail(symbol);
  if (!detail) return null;

  const { row, previousStance } = detail;
  const verdict = verdictOf(row.stance);
  const change = stanceChangeLabel(verdict, previousStance, t);
  const hasEnglish = row.copy.en !== null && row.copy.en !== undefined;
  const copy = locale === "en" ? (row.copy.en ?? row.copy.tr) : row.copy.tr;
  const copyLang = locale === "en" && !hasEnglish ? "tr" : locale;

  const status = await getStatus();
  const [quote, holidays] = await Promise.all([
    getQuote(symbol, status),
    getHolidays(),
  ]);
  /* Sıradaki yayın kartta da yazılı: okuyucu görüşün ne kadar taze
     olduğunu künyeden görüyor, ne kadar süre geçerli olduğunu buradan.
     Gerekçenin tamamı `nextEdition` üzerinde. */
  const next = nextEdition(new Date(), holidays);
  const price = quote.ok ? quote.data.price : row.snapshot.price;
  const position = planPosition(price, row.entryLow, row.entryHigh, row.stop);

  return (
    <section className={styles.stockCard} data-verdict={verdict}>
      <div className={styles.stockCardHead}>
        <h2 className="plate">{t.technical.title}</h2>
        <span className={styles.stockCardMeta}>
          {slotLabel(row.slot, t)} · {formatEtDateCompact(row.sessionDate, locale)}
        </span>
      </div>

      <div className={styles.stockCardStance}>
        {/* Bağlantı GÖRÜŞ ÇİPİNDE, kartın tamamında değil: ekran okuyucuda
            bağlantının adı "TUT · SNDK Teknik Analiz" oluyor, kartın bütün
            metni değil. `::after` kutuyu kaplıyor, yani tıklama alanı yine
            kartın tamamı — liste kartındaki kalıbın aynısı. */}
        <Link href={technicalHref(symbol)} className={styles.stockCardLink}>
          <span className="sr-only">{t.technical.stanceLabel}: </span>
          <span className={cn(styles.stancePill, verdictPillClass(verdict))}>
            {verdictLabel(verdict, t)}
          </span>
          <span className="sr-only"> · {symbol} {t.technical.title}</span>
        </Link>
        {change && (
          <span className={cn(styles.change, changeToneClass(verdict))}>{change}</span>
        )}
        {position && (
          <span className={styles.plan} data-kind={position.kind}>
            {planPositionLabel(position, locale, t)}
          </span>
        )}
      </div>

      <p className={styles.stockCardHeadline} lang={copyLang}>
        {copy.headline}
      </p>

      <div className={styles.stockCardFootRow}>
        <p className={styles.stockCardFoot} aria-hidden>
          {t.technical.readAnalysis}
          <ArrowUpRight size={13} weight="bold" />
        </p>
        {next && (
          <p className={styles.stockCardNext}>
            {t.technical.nextEdition} ·{" "}
            <span className="numeral">{editionClock(next.at, locale)}</span>
          </p>
        )}
      </div>
    </section>
  );
}
