import styles from "../stock.module.css";
import { DataError } from "@/components/ui/primitives";
import { getStatus } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getCompanyProfile, getQuote } from "@/lib/providers";
import { getKeyMetrics } from "@/lib/providers/finnhub";
import { formatPercentPlain, formatPrice, formatVolume, NO_VALUE, bandFiyatiKapsiyorMu, peRatioOf } from "@/lib/utils";

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
  const [metricsResult, quoteResult, profileResult] = await Promise.all([
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

  const rows: [string, string][] = [
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
    ],
    /* İLERİ F/K sağlayıcının kendi oranı — TTM F/K'nin aksine yeniden
       KURULMUYOR, çünkü ileri EPS elimizde yok (gerekçe
       `KeyMetrics.forwardPe` künyesinde). Oran para biriminden bağımsız:
       pay da payda da ana borsanın parasında ve bölümde sadeleşiyor. Bu
       yüzden ADR'de de, sınıf karışıklığında da doğru okunuyor — mutlak
       tutar değil. ETF'de gelmiyor, o zaman satır hiç yazılmıyor. */
    ...(m.forwardPe
      ? ([[t.stock.forwardPe, formatPrice(m.forwardPe, locale)]] as [
          string,
          string,
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
    ],
    [
      t.stock.eps,
      hisseBasi(m.eps)
        ? formatPrice(m.eps, locale, { currency: currency ?? true })
        : NO_VALUE,
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
    ],
    [t.stock.beta, m.beta ? formatPrice(m.beta, locale) : NO_VALUE],
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
          [t.stock.netMargin, formatPercentPlain(m.netMarginPct, locale, 1)],
        ] as [string, string][])
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
          [t.stock.debtToEquity, formatPrice(m.debtToEquity, locale)],
        ] as [string, string][])
      : []),
    [t.market.volume, quote?.volume ? formatVolume(quote.volume, locale) : NO_VALUE],
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

  return (
    /* LİSTE KUTUYU DOLDURUYOR. Izgara satırının boyunu orta sütun kuruyor
       ve bu kartın içeriği 156 piksel erken bitiyordu: son satırın altında
       kartın üçte biri kadar boş yer kalıyor, kart yarım kalmış gibi
       duruyordu. Satırlar artan yeri PAYLAŞIYOR (`flex-1`) — sekiz satıra
       yirmişer piksel, yani liste seyreliyor ama hiçbir yerde delik yok.
       Dar ekranda ızgara tek sütuna düşüyor, gerilme olmuyor ve satırlar
       kendi doğal boylarında kalıyor. */
    <div className={styles.metricsBody}>
      <dl data-motion-stagger className={styles.metricsList}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="numeral">{value}</dd>
          </div>
        ))}
      </dl>
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
