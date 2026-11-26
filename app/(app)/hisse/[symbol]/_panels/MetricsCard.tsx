import styles from "../stock.module.css";
import { DataError } from "@/components/ui/primitives";
import { getStatus } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getChartBars, getCompanyProfile, getQuote } from "@/lib/providers";
import { getKeyMetrics } from "@/lib/providers/finnhub";
import { etParts } from "@/lib/market-hours";
import { US_WITHHOLDING } from "@/lib/tax";
import { peerSpread, type PeerMetric } from "@/lib/peer-spread";
import { trAblative } from "@/lib/scorecard";
import { formatPercentPlain, formatPrice, formatVolume, NO_VALUE, bandFiyatiKapsiyorMu, peRatioOf } from "@/lib/utils";
import { sectorPeerValues } from "./peer-spreads";
import { PeerStrip } from "./PeerStrip";
import { MetricGauge } from "./MetricGauge";
import depth from "./depth.module.css";

/** Kulvar alan ölçü: kartta yazan SAYI (biçimlenmeden önce) ve biçimleyicisi. */
type PeerCell = { metric: PeerMetric; value: number | null; format: (v: number) => string };
/** Sektör verisi olmayan hücrenin kıyası (MetricGauge): çizim ya da yalnız künye. */
type Gauge = { bar?: { value: number; reference: number; max: number }; caption: string; aria: string };
/** Kıyasla değer arasında bu yüzdeden az fark "aynı" okunur — "%0 Düşük" yazmasın. */
const SAME_PCT = 3;

export async function MetricsCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [metricsResult, quoteResult, profileResult, sectorPeers, barsResult] = await Promise.all([
    getKeyMetrics(symbol),
    getQuote(symbol, status),
    /* PARA BİRİMİ ŞART. Finnhub'ın metrik ucu EPS ve 52 hafta bandını
       şirketin ANA BORSASININ para biriminde veriyor, bu tablo ise hepsini
       dolar sanıp `$` basıyordu. TSM'de başlıktaki ADR fiyatı 419,55 $
       dururken tabloda "52 Hafta En Yüksek 2.535,00 $" yazıyordu; sayı
       doğru, para birimi yanlıştı (TWD) ve okuyucu fiyatı bandın çok
       altında sanıyordu. Depoda 21 sembol USD dışı (TSM, ASML, PDD,
       NTES, SKHY…). */
    getCompanyProfile(symbol),
    /* Sektör kulvarının komşuları — Hisse Skor Kartı'yla aynı satırlar ve
       aynı kotasyon isteği (istek içi önbellek, `peer-spreads.ts`). */
    sectorPeerValues(symbol, status),
    /* HACMİN KIYASI (26 Kasım 2026): son 20 tamamlanmış seansın ortalaması.
       Seri Hareketli Ortalamalar'ın (ve Teknik Fotoğraf'ın) zaten çektiği
       bir yıllık gün barları — aynı istek, aynı önbellek; yeni sağlayıcı
       turu yok. Gelmezse hacim hücresi yalnız sayı kalır. */
    getChartBars(symbol, "1Y", status),
  ]);

  if (!metricsResult.ok) {
    return <DataError message={t.data.failed} />;
  }
  const m = metricsResult.data;
  const quote = quoteResult.ok ? quoteResult.data : null;
  const currency = profileResult.ok ? profileResult.data.currency : null;
  const homeCurrency = Boolean(currency && currency !== "USD");

  /* ÖLÇÜLER BU HİSSEYE AİT Mİ. Sağlayıcı BRK.B için A SINIFININ rakamlarını
     döndürüyor: 506 dolarlık hissenin sayfasında "F/K 0,01", "Hisse Başına
     Kâr 59.668,81 $" ve "52 Hafta Bandı 698.000 – 806.102 $" yazıyordu.
     Gerekçe ve ölçüm lib/utils.ts → `bandFiyatiKapsiyorMu`.

     Test yalnızca PARA BİRİMİ AYNIYKEN çalışıyor: ADR'de band ana borsanın
     parasında ve fiyatla zaten tutmuyor — orada ayrı ve yazılı bir çözüm var
     (`homeCurrency` dalı, aşağıdaki not). */
  const olculerTutarli =
    homeCurrency ||
    bandFiyatiKapsiyorMu(quote?.price, m.low52, m.high52);

  /* Hisse başına ölçüler tutarsızsa GÖSTERİLMİYOR. Oranlar (beta, temettü
     verimi, ileri F/K) sınıflar arasında ortak olduğu için kalıyor; mutlak
     tutarlar (EPS, band) ve onlardan türeyen F/K düşüyor. */
  const hisseBasi = <T,>(value: T): T | null =>
    olculerTutarli ? value : null;

  /* Üçüncü öğe sektör kulvarı: yalnız kaynağı olan üç ölçüde (F/K, net
     marj, borç/özsermaye — gerekçe lib/peer-spread.ts). */
  const fmtRatio = (v: number) => formatPrice(v, locale);
  const signedMargin = (v: number) => `${v < 0 ? "−" : ""}${formatPercentPlain(v, locale, 1)}`;
  const peValue = hisseBasi(homeCurrency ? null : peRatioOf(quote?.price, m.eps));
  /* KIYASLAR (26 Kasım 2026, görsel tur) — gerekçe MetricGauge.tsx. Hepsi
     bu kartın zaten okuduğu alanlardan türüyor; yeni sayı yok. */
  const v = t.stockVisuals;
  const fmtPct = (n: number) => String(Math.round(Math.abs(n)));
  const relCaption = (diffPct: number, above: string, below: string, same: string) =>
    Math.abs(diffPct) < SAME_PCT ? same : (diffPct > 0 ? above : below).replace("{p}", fmtPct(diffPct));
  /* F/K kartta yazan sayı (ADR'de sağlayıcının ana borsa oranı). */
  const peShown = hisseBasi(homeCurrency ? m.peRatio : peValue);

  /* İleri F/K'nın kıyası bugünkü F/K: çentik F/K, çubuk F/K'dan ileri F/K'ya.
     İkisi de pozitifken (zarar beklentisinde oran anlamsız). */
  let fwdGauge: Gauge | undefined;
  if (m.forwardPe && m.forwardPe > 0 && peShown && peShown > 0) {
    const caption = relCaption(((m.forwardPe - peShown) / peShown) * 100, v.gaugeFwdAbove, v.gaugeFwdBelow, v.gaugeFwdEqual);
    fwdGauge = {
      bar: { value: m.forwardPe, reference: peShown, max: Math.max(m.forwardPe, peShown) * 1.25 },
      caption,
      aria: v.gaugeFwdAria.replace("{v}", fmtRatio(m.forwardPe)).replace("{r}", fmtRatio(peShown)).replace("{pos}", caption),
    };
  }
  /* PD/DD'nin paydası: hisse başına defter değeri, doların kendisi. ADR'de
     ana borsanın parasında, sınıf karışıklığında başka hissenin — yazılmaz. */
  let bookGauge: Gauge | undefined;
  if (!homeCurrency && olculerTutarli && m.bookValuePerShare && m.bookValuePerShare > 0) {
    const book = formatPrice(m.bookValuePerShare, locale, { currency: true });
    bookGauge = { caption: v.gaugeBook.replace("{v}", book), aria: v.gaugeBookAria.replace("{v}", book) };
  }
  /* Hisse başına kârın fiyata oranı (kâr getirisi = 1 / F/K): mevduat ya da
     tahvil faiziyle yan yana konabilen tek değerleme okuması. */
  let epsGauge: Gauge | undefined;
  if (!homeCurrency && peShown && peShown > 0) {
    const y = formatPercentPlain(100 / peShown, locale, 1);
    epsGauge = { caption: v.gaugeEarningsYield.replace("{v}", y), aria: v.gaugeEarningsYieldAria.replace("{v}", y) };
  }
  /* Temettü: Türk bireysel yatırımcının eline geçen, W-8BEN'li %20 stopaj
     sonrası (tek kaynak lib/tax.ts → US_WITHHOLDING). Sıfır verim "ödemiyor". */
  let dividendGauge: Gauge | undefined;
  if (m.dividendYield === 0) {
    dividendGauge = { caption: v.gaugeNoDividend, aria: v.gaugeNoDividend };
  } else if (m.dividendYield !== null && m.dividendYield !== undefined && m.dividendYield > 0) {
    const net = formatPercentPlain(m.dividendYield * (1 - US_WITHHOLDING.w8ben / 100), locale, 2);
    dividendGauge = {
      caption: v.gaugeNetDividend.replace("{v}", net),
      aria: v.gaugeNetDividendAria.replace("{w}", String(US_WITHHOLDING.w8ben)).replace("{v}", net),
    };
  }
  /* Beta'nın kıyası piyasanın kendisi (1). Ölçek en az 0–2: 1,06 ile 1,00
     arasındaki fark kulvarın ortasında kısa bir çubuk, abartılmış değil. */
  let betaGauge: Gauge | undefined;
  if (m.beta && m.beta > 0) {
    const caption = relCaption((m.beta - 1) * 100, v.gaugeBetaAbove, v.gaugeBetaBelow, v.gaugeBetaEqual);
    betaGauge = {
      bar: { value: m.beta, reference: 1, max: Math.max(2, m.beta * 1.25) },
      caption,
      aria: v.gaugeBetaAria.replace("{v}", fmtRatio(m.beta)).replace("{pos}", caption),
    };
  }
  /* Hacmin kıyası: anlatılan seanstan ÖNCEKİ son 20 seansın ortalaması
     (bugünün barı ortalamaya girmez, yoksa kendisiyle kıyaslanır). Seans
     sürerken hacim henüz birikiyor; bu ekran okuyucu adında ve `title`da
     söyleniyor. 20 seans yoksa kıyas yok. */
  let volumeGauge: Gauge | undefined;
  if (quote?.volume && barsResult.ok) {
    const prior = barsResult.data
      .filter((bar) => bar.volume > 0 && etParts(new Date(bar.time * 1000)).dateStr < status.sessionDate)
      .slice(-20);
    if (prior.length === 20) {
      const avg = prior.reduce((sum, bar) => sum + bar.volume, 0) / prior.length;
      const caption = relCaption(((quote.volume - avg) / avg) * 100, v.gaugeVolAbove, v.gaugeVolBelow, v.gaugeVolEqual);
      const aria = v.gaugeVolAria
        .replace("{v}", formatVolume(quote.volume, locale))
        .replace("{r}", formatVolume(Math.round(avg), locale))
        .replace("{pos}", caption);
      volumeGauge = {
        bar: { value: quote.volume, reference: avg, max: Math.max(quote.volume, avg) * 1.25 },
        caption,
        aria: status.session === "regular" ? `${aria} ${v.gaugeVolLive}` : aria,
      };
    }
  }

  const rows: [string, string, PeerCell?, Gauge?][] = [
    /* F/K sağlayıcının hazır alanından değil, sayfanın gösterdiği fiyattan
       kuruluyor — o alan geriden gelen bir fiyatla hesaplanmış oluyor ve
       tablonun hemen üstündeki kotasyonla çelişiyordu. Bkz. `peRatioOf`.
       AMA yalnızca ikisi aynı para birimindeyse: ADR'de fiyat dolar, EPS
       ana borsanın parası ve bölüm anlamsız bir sayı veriyordu (TSM'de
       4,80 gibi). Orada sağlayıcının kendi oranı kullanılıyor — o oran ana
       borsanın içinde kurulduğu için birimsiz ve tutarlı. */
    [
      t.stock.peRatio,
      formatPrice(
        hisseBasi(homeCurrency ? m.peRatio : peRatioOf(quote?.price, m.eps)),
        locale,
      ),
      /* Kulvar yalnız F/K CANLI fiyattan kurulduğunda: ADR'de sağlayıcının
         ana borsa oranı yazıyor, sektör tablosunun F/K'si ise dolar fiyatı /
         dolar EPS — iki ayrı taban yan yana konmaz. */
      { metric: "pe", value: peValue, format: fmtRatio },
    ],
    /* İLERİ F/K sağlayıcının kendi oranı — TTM F/K'nin aksine yeniden
       KURULMUYOR, çünkü ileri EPS elimizde yok (gerekçe
       `KeyMetrics.forwardPe` künyesinde). Oran para biriminden bağımsız:
       pay da payda da ana borsanın parasında ve bölümde sadeleşiyor. Bu
       yüzden ADR'de de, sınıf karışıklığında da doğru okunuyor — mutlak
       tutar değil. ETF'de gelmiyor, o zaman satır hiç yazılmıyor. */
    ...(m.forwardPe
      ? ([[t.stock.forwardPe, formatPrice(m.forwardPe, locale), undefined, fwdGauge]] as [
          string,
          string,
          undefined,
          Gauge?,
        ][])
      : []),
    /* PD/DD CANLI FİYATTAN (2 Ekim, sahibinin isteği: "F/K, PD/DD daha
       doğru ve anlık"). F/K ile aynı gerekçe: sağlayıcının hazır `pb`si
       geriden gelen bir fiyatla kurulu (MU'da 8,54 diyordu, defter değeri
       ve canlı fiyattan 8,7 çıkıyor). Pay canlı kotasyon, payda son
       çeyreğin hisse başına defter değeri — çeyrekte bir değişen bir sayı,
       yani oran fiyatla birlikte anlık. ADR'de para birimleri karıştığı
       için sağlayıcının kendi oranı. Özsermayesi eksi olan şirkette oran
       anlamsız; satır tire basıyor. */
    [
      t.valuation.priceToBook,
      formatPrice(
        hisseBasi(
          homeCurrency
            ? m.priceToBook
            : quote?.price && m.bookValuePerShare && m.bookValuePerShare > 0
              ? quote.price / m.bookValuePerShare
              : null,
        ),
        locale,
      ),
      undefined,
      bookGauge,
    ],
    [
      t.stock.eps,
      hisseBasi(m.eps)
        ? formatPrice(m.eps, locale, { currency: currency ?? true })
        : NO_VALUE,
      undefined,
      epsGauge,
    ],
    [
      t.stock.dividend,
      /* İşaret elle SONA konuyordu ve Türkçede başa gelmesi gerekiyor;
         kural tek yerde: lib/utils.ts → withPercent. */
      /* `!== null` ile ayrılıyor: `m.dividendYield ?` sıfır temettüyü de
         "—" yapıyordu, oysa "temettü ödemiyor" ile "bilinmiyor" aynı şey
         değil. */
      m.dividendYield !== null && m.dividendYield !== undefined
        ? formatPercentPlain(m.dividendYield, locale, 2)
        : NO_VALUE,
      undefined,
      dividendGauge,
    ],
    [t.stock.beta, m.beta ? formatPrice(m.beta, locale) : NO_VALUE, undefined, betaGauge],
    /* NET KÂR MARJI — kartın tek KÂRLILIK ölçüsü. Sekiz satırın hepsi
       değerleme (F/K, ileri F/K), dağıtım (temettü), oynaklık (beta) ya da
       fiyatın kendi geçmişindeki yeri (52 hafta bandı, hacim) hakkındaydı;
       "bu şirket kazanıyor mu" sorusunu hiçbiri yanıtlamıyordu. Gelirin
       yüzde kaçının net kâra döndüğü tek satırda onu söylüyor.

       PARA BİRİMİ SORUNU YOK, çünkü ORAN: pay da payda da ana borsanın
       parasında ve bölümde sadeleşiyor. Bu yüzden `hisseBasi()` ile
       sarılmıyor — o sarmalayıcı MUTLAK tutarlar için ve BRK.B'de yanlış
       sınıfın rakamını düşürmek üzere var. Marj şirket düzeyinde bir ölçü;
       iki hisse sınıfı için de aynı sayı, ADR'de de doğru okunuyor
       (ölçüldü: TSM %50,70, ASML %29,49 — ikisi de kendi gerçek marjı).

       Alan zaten çekiliyordu ve iki ekranda daha basılıyor (bilanço detayı
       ve karşılaştırma); yeni bir sağlayıcı turu ya da yeni sözlük anahtarı
       getirmiyor. Kapsam ölçüldü: 24 sembolün 22'sinde geliyor, gelmeyen
       ikisi ETF (SPY, QQQ) ve onlar zaten fon dalına gidip bu kartı hiç
       görmüyor. `!== null` ile ayrılıyor — zarardaki şirketin marjı negatif
       bir sayı, "bilinmiyor" değil (DKNG %-2,68, SOFI %-19,79). */
    ...(m.netMarginPct !== null && m.netMarginPct !== undefined
      ? ([
          [
            t.stock.netMargin,
            /* EKSİ MARJ İŞARETİYLE (25 Ekim). `formatPercentPlain` mutlak
               değer basıyor; zarardaki şirketin marjı (SOFI %-19,79) kartta
               "%19,8" diye, KÂRLI gibi okunuyordu. Kulvar eklenince nokta
               sektörün sol ucuna düşüp sayıyla çelişecekti — ikisi artık
               aynı işareti taşıyor. */
            signedMargin(m.netMarginPct),
            { metric: "netMargin", value: m.netMarginPct, format: signedMargin },
          ],
        ] as [string, string, PeerCell][])
      : []),
    /* BORÇ / ÖZSERMAYE — kartın tek KALDIRAÇ ölçüsü, marjın kâr tarafına
       karşılık bilanço tarafı. Marjla aynı gerekçelerle güvenli: oran
       olduğu için para birimi sadeleşiyor, şirket düzeyinde olduğu için
       hisse sınıfından bağımsız. Kapsam ölçüldü: 20 sembolün 20'sinde
       geliyor ve hepsi çeyreklik alandan (`totalDebt/totalEquityQuarterly`).

       ORAN, YÜZDE DEĞİL — beta gibi biçimlendiriliyor. Ölçülen değerler
       0,04 (NVDA, neredeyse borçsuz) ile 7,52 (BA) arasında; yüzde sanılıp
       "%0,04" basılsaydı borçsuz bir bilanço "sıfıra yakın borç" değil
       "ölçülemeyecek kadar küçük" gibi okunurdu.

       `> 0` DEĞİL `!== null`: sıfır borç gerçek bir bilanço durumu ve
       "bilinmiyor"dan farklı — temettü satırındaki aynı ayrım. */
    ...(m.debtToEquity !== null && m.debtToEquity !== undefined
      ? ([
          [
            t.stock.debtToEquity,
            formatPrice(m.debtToEquity, locale),
            { metric: "debtToEquity", value: m.debtToEquity >= 0 ? m.debtToEquity : null, format: fmtRatio },
          ],
        ] as [string, string, PeerCell][])
      : []),
    /* HACİM YOKSA HÜCRE DE YOK (10 Kasım 2026). Açılış öncesinde kotasyon
       hacim taşımıyor ve kartın son hücresi "Hacim –" basıyordu: dokuz
       ölçülük ızgarada tek başına bir tire. Elde olmayan ölçü için yer
       ayrılmıyor; seans açılınca hücre geri geliyor (ızgara sütun sayısını
       `data-count`tan kuruyor, sekiz ölçü dört sütunda iki tam satır). */
    ...(quote?.volume
      ? ([[t.market.volume, formatVolume(quote.volume, locale), undefined, volumeGauge]] as [string, string, undefined, Gauge?][])
      : []),
  ];

  /* 52 HAFTA BANDI BU KARTTA DEĞİL (24 Eylül). "İki satırdan bir bloğa"
     dönmüştü (fiyatın bandın neresinde durduğu tek bakışta); o blok şimdi
     Hareketli Ortalamalar'ın fiyat cetvelinde, ortalamalarla AYNI eksende
     — iki kart aynı soruyu iki ayrı ölçekle yanıtlıyordu. Gerekçe
     MovingAverages'ta. */

  /* FİYAT / SATIŞ DEĞERLENDİRİLDİ, EKLENMEDİ — gerekçe yazılıyor çünkü
     aday güçlü ve yeniden önerilmesi çok olası.

     Lehine olan taraf gerçek: `psTTM` bir ORAN, yani para birimi bölümde
     sadeleşiyor (TSM'de baştan sona TWD içinde kuruluyor) ve hisse
     sınıfından bağımsız (BRK.A ile BRK.B birebir aynı 2,5391 dönüyor, çünkü
     pay ve payda birlikte 1500'e bölünüyor). Kapsam 67/68. Üstelik kartın
     değerleme tarafının TÜMÜYLE çöktüğü yeri dolduruyor: CRWV, RKLB, ASTS
     ve NBIS'te ne F/K ne İleri F/K geliyor, F/S dördünde de dolu.

     ENGEL FİYAT TABANI. `psTTM` sağlayıcının KENDİ fiyatından kurulu ve o
     fiyat geriden geliyor: ölçüldü, AAPL'de oran 301,07 dolarlık bir fiyat
     ima ediyor, canlı kotasyon 324,96 — %7,4 sapma. Depo sağlayıcının hazır
     `peTTM`ini tam bu yüzden zaten reddetmiş ve oradaki ölçüm %5,6'ydı
     (lib/utils.ts → `peRatioOf`), yani bu daha büyük. Aynı kartta F/K CANLI
     fiyattan kuruluyor; F/S eklenseydi iki değerleme oranı iki farklı fiyat
     tabanında yan yana dururdu.

     İleri F/K'nin neden kabul edildiği sorulursa: orada yeniden kurmanın
     yolu KAPALI, ileri EPS elimizde yok (types.ts → `forwardPe`). F/S'de
     ise yol açık görünüyor ama açılırsa yanlış — `price / revenuePerShare`
     ADR'de dolar/TWD karışımı verir, BRK.B'de 0,002 basar. Yani ne olduğu
     gibi alınabiliyor ne yeniden kurulabiliyor. */

  /* BOŞ ÖLÇÜ HÜCRE AÇMAZ (14 Kasım 2026, görsel tur). Kârı ya da temettüsü
     olmayan şirkette ızgaranın yarısı tireydi (sahte küçük şirket: altı
     hücrenin dördü "–", 1440). Değeri olmayan ölçü basılmaz; sütun sayısı
     kalan hücreye göre (`data-count`). Hiçbiri yoksa eski liste kalır ki
     kart boş bir kutuya dönmesin. */
  const filled = rows.filter(([, value]) => value !== NO_VALUE);
  const cells = (filled.length > 0 ? filled : rows).map(([label, value, cell, gauge]) => ({
    label,
    value,
    cell,
    gauge,
    spread: cell && cell.value !== null && sectorPeers ? peerSpread(cell.value, sectorPeers.values[cell.metric]) : null,
  }));

  return (
    /* LİSTE KUTUYU DOLDURUYOR. Izgara satırının boyunu orta sütun kuruyor
       ve bu kartın içeriği 156 piksel erken bitiyordu: son satırın altında
       kartın üçte biri kadar boş yer kalıyor, kart yarım kalmış gibi
       duruyordu. Satırlar artan yeri PAYLAŞIYOR (`flex-1`) — sekiz satıra
       yirmişer piksel, yani liste seyreliyor ama hiçbir yerde delik yok.
       Dar ekranda ızgara tek sütuna düşüyor, gerilme olmuyor ve satırlar
       kendi doğal boylarında kalıyor. */
    <div className={styles.metricsBody}>
      {/* `data-count`: sütun sayısı ölçü sayısına göre (stock.module.css) —
          dokuz ölçü dört sütunda son satırda tek başına kalıyordu. */}
      <dl data-motion-stagger data-count={cells.length} className={styles.metricsList}>
        {cells.map(({ label, value, cell, spread, gauge }) => {
          return (
            <div key={label}>
              <dt>{label}</dt>
              <dd className="numeral">{value}</dd>
              {/* Sektör kulvarı varsa o; yoksa hücrenin kendi kıyası
                  (MetricGauge, 26 Kasım 2026) — ikisi aynı dilde. */}
              {spread && cell ? (
                <PeerStripFor label={label} value={value} spread={spread} format={cell.format} locale={locale} t={t} />
              ) : (
                gauge && <MetricGauge bar={gauge.bar} caption={gauge.caption} aria={gauge.aria} />
              )}
            </div>
          );
        })}
      </dl>
      {/* Kulvarın okunuşu KATLAMADA (Analist eğilimi panelinin "Nasıl
          Okunur"u ile aynı kalıp). Açık paragraf 1440'ta kartı 70 piksel
          uzatıyor ve aynı ızgara satırındaki Hareketli Ortalamalar'ın
          altında boşluk açıyordu (ölçüldü, 25 Ekim). */}
      {sectorPeers && cells.some((c) => c.spread) && (
        <details className={depth.how}>
          <summary>{t.stockDepth.howRead}</summary>
          <p>{t.stockVisuals.peerNote.replace("{n}", String(sectorPeers.companies))}</p>
        </details>
      )}
      {/* Para birimi başlıktaki dolar fiyatından farklıysa sebebi yazılır —
          yoksa okuyucu iki sayıyı yan yana koyup birini yanlış sanıyor. */}
      {homeCurrency && (
        <p className="mt-2 border-t border-line-soft pt-2.5 text-small text-muted">
          {t.stock.homeCurrencyNote.replace("{code}", currency!)}
        </p>
      )}
      {/* Sessizce "—" basmak da yanlış olurdu: okuyucu veriyi bizim
          alamadığımızı sanır, oysa sağlayıcı BAŞKA bir menkul kıymetin
          rakamlarını gönderiyor ve biz onları bilerek yazmıyoruz. */}
      {!olculerTutarli && (
        <p className="mt-2 border-t border-line-soft pt-2.5 text-small text-muted">
          {t.stock.metricsMismatch}
        </p>
      )}
    </div>
  );
}

function PeerStripFor({
  label,
  value,
  spread,
  format,
  locale,
  t,
}: {
  label: string;
  value: string;
  spread: NonNullable<ReturnType<typeof peerSpread>>;
  format: (v: number) => string;
  locale: Locale;
  t: Dictionary;
}) {
  const v = t.stockVisuals;
  /* Yüzdelik yarıdan büyükse "yüksek", değilse "düşük" ve tümleyeni:
     "%30'undan yüksek" yerine "%70'inden düşük" — okuyucu büyük sayıyı
     okuyor. Tam sayıya yuvarlanıyor; eşit yarı "yüksek" tarafında. */
  const above = spread.below >= 50;
  const p = Math.round(above ? spread.below : 100 - spread.below);
  const position = (above ? v.peerAbove : v.peerBelow)
    .replace("{p}", String(p))
    .replace("{ek}", locale === "tr" ? trAblative(p) : "");
  const median = format(spread.median);
  return (
    <PeerStrip
      spread={spread}
      position={position}
      aria={v.peerAria
        .replace("{metric}", label)
        .replace("{v}", value)
        .replace("{m}", median)
        .replace("{n}", String(spread.peers))
        .replace("{pos}", position.toLocaleLowerCase(locale === "tr" ? "tr-TR" : "en-US"))}
    />
  );
}
