import { Bank, CalendarCheck, Flag, GlobeHemisphereWest, LinkSimple, Stack } from "@phosphor-icons/react/dist/ssr";
import styles from "../stock.module.css";
import { exchangeLabel } from "@/components/stock/exchange-label";
import { DataError, DataStamp, PanelHeader } from "@/components/ui/primitives";
import { PriceRail } from "@/components/ui/PriceRail";
import { getStatus, getCompanies, getSymbolNames, liveMarketCap, getNextReport } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getCompanyProfile, getQuote } from "@/lib/providers";
import { indexMemberOf, primaryOnly } from "@/db/seed/indices";
import { subIndustryName } from "@/db/seed/sub-industries";
import { getKeyMetrics } from "@/lib/providers/finnhub";
import { describeSymbol } from "@/db/seed/descriptions";
import { cn, formatMoneyCompact, formatEtDateMedium, formatPercentPlain, formatPrice, NO_VALUE, safeExternalUrl } from "@/lib/utils";
import { week52Band } from "./shared";

export async function ProfileCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  /* Piyasa değeri CANLI hesaplanıyor: `profile.marketCap` profilin çekildiği
     anın fotoğrafı ve o profil ~29 günde bir tazeleniyor, yani künyedeki sayı
     `/piyasalar` ve bilanço analizindekinden farklı olabiliyordu — aynı
     şirket, iki ekran, iki değer. Kural tek yerde: lib/data.ts →
     liveMarketCap. Fiyat alınamazsa kayıtlı değere düşülür. */
  const status = await getStatus();
  const [result, meta, quoteForCap, nextReport, metricsForBand, directory] = await Promise.all([
    getCompanyProfile(symbol),
    getSymbolNames([symbol]),
    getQuote(symbol, status),
    /* Yerel takvim okuması; sağlayıcıya gitmiyor (lib/data.ts). */
    getNextReport(symbol),
    /* 52 hafta bandı — Anahtar Metrikler ile aynı çağrı, `finnhubFetch`
       altı saat önbellekli: yeni tur yok. */
    getKeyMetrics(symbol),
    /* Dizindeki sıra için — sembol tablosu beş dakika önbellekte
       (lib/data.ts → loadSymbolTable), yeni bir tur yok. */
    getCompanies(),
  ]);
  if (!result.ok) {
    return (
      <>
        <PanelHeader title={t.stock.profile} />
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </>
    );
  }
  const profile = result.data;
  /* YEDEK YALNIZCA DOLAR CİNSİNDEYSE. Buradaki `?? profile.marketCap`
     sağlayıcının ham alanına düşüyordu ve o alan şirketin ANA BORSASININ
     para biriminde geliyor — Finnhub'ın kendi belgesi de öyle diyor, bizim
     yorum "milyon dolar" yazıyordu ve yanlıştı. USD dışı bir ADR'de sayı
     dolar işaretiyle basılıyordu: /hisse/SKHY künyesinde "Piyasa Değeri
     1.233 T $", /hisse/TSM'de "61,6 T $" (Apple 4,55 T $ iken).
     `SymbolMeta` bu ayrımı zaten yapıyor (USD dışında null); yedeğin de
     aynı kuralı tanıması gerekiyordu. Bilinmiyorsa tire basılır — uydurma
     bir dolar değerinden iyidir. */
  const band = week52Band(
    metricsForBand.ok ? metricsForBand.data : null,
    quoteForCap.ok ? quoteForCap.data.price : null,
    meta[symbol]?.currency ?? null,
  );
  const liveCapValue = liveMarketCap(meta[symbol], quoteForCap.ok ? quoteForCap.data.price : null);
  const liveCap = liveCapValue !== null;
  const marketCap = liveCapValue ?? (profile.currency === "USD" ? profile.marketCap : null);
  const member = indexMemberOf(symbol);
  /* DİZİNDEKİ SIRA (24 Eylül). Piyasa değeri kartta tek başına bir sayıydı
     ve sağ yarısı boştu: "4,97 T $" büyük mü, küçük mü, okuyucu kendi
     bilgisiyle tamamlamak zorundaydı. Sıra ve en büyük şirkete oranı o
     sayıyı ölçeğe oturtuyor. Bu şirketin değeri CANLI (yukarıda), ötekiler
     sembol tablosunun önbellek fiyatından — en fazla birkaç dakika geride;
     sıra o farktan ancak sınırdaki iki şirket arasında oynayabilir. Şirket
     dizinde yoksa (ikinci sınıf pay, dolar dışı ADR) blok basılmıyor. */
  const listed = primaryOnly(directory).filter(
    (row) => row.marketCap !== null && row.marketCap > 0,
  );
  const rankInfo = (() => {
    if (marketCap === null || !listed.some((row) => row.symbol === symbol)) return null;
    const others = listed.filter((row) => row.symbol !== symbol);
    const rank = 1 + others.filter((row) => (row.marketCap as number) > marketCap).length;
    const leader = others.reduce<(typeof others)[number] | null>(
      (best, row) => (best === null || (row.marketCap as number) > (best.marketCap as number) ? row : best),
      null,
    );
    const leaderCap = leader ? Math.max(leader.marketCap as number, marketCap) : marketCap;
    return { rank, total: listed.length, leader: rank === 1 ? null : leader, share: marketCap / leaderCap };
  })();
  const about = await describeSymbol(symbol, locale);
  const websiteHref = safeExternalUrl(profile.weburl);
  const hourLabels: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  /* Ülke adı — kod tanınmazsa `of()` girdiyi aynen geri veriyor, o durumda
     "US" gibi ham bir kod basmak yerine satırı hiç açmıyoruz. */
  const ulkeAdi = (() => {
    const kod = profile.country?.trim();
    if (!kod || kod.length !== 2) return null;
    try {
      const ad = new Intl.DisplayNames([locale === "tr" ? "tr" : "en"], {
        type: "region",
      }).of(kod.toUpperCase());
      return ad && ad !== kod.toUpperCase() ? ad : null;
    } catch {
      return null;
    }
  })();

  const rows: [string, React.ReactNode][] = [
    /* SEKTÖR SATIRI YOK — kimlik künyesinde, bu kartın hemen SOLUNDA duruyor.
       İkisi AYNI tercih zincirinden besleniyor (GICS varsa o, yoksa
       sağlayıcının serbest metinli alanı; StockHeader'daki `kunyeSektor`
       yorumu da bunu yazıyor), yani üretilen dize garantili aynı. Kimlik
       grafiğin içine girmeden önce başlık sayfanın en üstünde ayrı bir
       satırdı ve tekrar göze batmıyordu; şimdi iki panel yan yana ve aynı
       cümle iki kez okunuyor. Değeri boşsa ikisi de boş — "Sektör: —"
       basmanın da bir faydası olmuyordu.
       ALT SEKTÖR KALIYOR: daha dar bir sınıflandırma ve künyede yok. */
    ...(member?.sub
      ? ([[t.stock.industry, subIndustryName(member.sub, locale)]] as [
          string,
          React.ReactNode,
        ][])
      : []),
    /* ÜLKE — sağlayıcı ISO-2 kodu veriyor ("US", "TW", "NL") ve çeviri
       `Intl.DisplayNames` ile yapılıyor: yeni bir ülke sözlüğü kurmaya gerek
       yok, kural tarayıcının ve Node'un kendisinde. Satır ADR'lerde asıl
       işini görüyor — TSM "Tayvan", ASML "Hollanda" — ve o sembollerde
       zaten para birimi notu duran kartın hemen yanında duruyor.
       Kod tanınmazsa `of()` girdiyi aynen döndürüyor; o zaman ham kod
       basmak yerine satır hiç yazılmıyor. */
    ...(ulkeAdi ? ([[t.stock.country, ulkeAdi]] as [string, React.ReactNode][]) : []),
    [t.stock.exchange, exchangeLabel(profile.exchange, locale) ?? NO_VALUE],
    /* DEĞER YOKSA SATIR DA YOK. Koruma bilinçli (dolar dışı para biriminde
       null döner, gerekçe yukarıda) ama sonucu hep "—" olan bir satır yer
       kaplayıp hiçbir şey söylemiyordu — üstelik tam da ADR'lerde, kartın
       en havadar olduğu yerde. Boş satır sildikçe kalanlar gerçek bilgi
       taşıyor; aynı desen `ulkeAdi` ve alt sektörde de var. */
    /* Piyasa değeri artık listenin üstündeki büyük okumada; aynı kaynağı
       iki defa basmamak için bu satır oraya taşındı. */
    [
      t.stock.ipoDate,
      profile.ipoDate ? (
        <span className="numeral">
          {formatEtDateMedium(profile.ipoDate, locale)}
        </span>
      ) : (
        NO_VALUE
      ),
    ],
    /* SIRADAKİ BİLANÇO BİR SATIR, BİR KART DEĞİL. Yaklaşan bilanço kartı
       ilk ekrandan Bilançolar bölümüne taşınmıştı (ilk ekranın boyunu
       uzatıyordu); ama tarihin kendisi şirket künyesinin bir satırı ve
       profil kartının altında boşluk bırakan yere tam oturuyor. Satır
       bölüme bağlanıyor — ayrıntı orada. Tarih yoksa satır da yok. */
    ...(nextReport
      ? ([
          [
            t.stock.nextReportRow,
            <a key="next" href="#stock-earnings" className="tap-44 numeral text-primary hover:underline">
              {formatEtDateMedium(nextReport.date, locale)}
              {nextReport.hour && hourLabels[nextReport.hour]
                ? ` · ${hourLabels[nextReport.hour]}`
                : ""}
            </a>,
          ],
        ] as [string, React.ReactNode][])
      : []),
  ];
  /* SATIRIN İKONU (26 Eylül). Profil etiket-değer satırlarından ibaretti ve
     "düz sayfa" gibi okunuyordu. Her satırın başında ne anlattığını
     gösteren küçük bir karo var; göz etiketi okumadan satırı buluyor.
     Eşleme etikete göre: satırlar koşullu eklendiği için sıra değil ad
     tanımlayıcı. Eşlenmeyen satır ikonsuz kalır, kaymaz. */
  const rowIcon = new Map<string, typeof Stack>([
    [t.stock.industry, Stack],
    [t.stock.country, GlobeHemisphereWest],
    [t.stock.exchange, Bank],
    [t.stock.ipoDate, Flag],
    [t.stock.nextReportRow, CalendarCheck],
    [t.stock.website, LinkSimple],
  ]);
  const rowLabel = (label: string) => {
    const Icon = rowIcon.get(label);
    return (
      <dt className={styles.factLabel}>
        {Icon && <Icon aria-hidden size={14} weight="duotone" />}
        {label}
      </dt>
    );
  };

  /* KÜNYE BAŞLIĞIN SAĞINDA. "Finnhub · 22 Eylül 21:52 Güncellendi" kartın
     dibinde tek başına bir satır tutuyordu; başlık satırının sağı ise
     boştu. Aynı damga orada, satır harcamadan. */
  return (
    <>
    <PanelHeader
      title={t.stock.profile}
      action={
        <DataStamp
          labels={t.data}
          source={result.source}
          at={result.fetchedAt}
          stale={result.stale}
          locale={locale}
          className={styles.headerStamp}
        />
      }
    />
    <div className={styles.profileBody}>
      {/* TEK BÜYÜK OKUMA: PİYASA DEĞERİ (24 Eylül). Kartın tepesinde "Son
          Fiyat", yüzdesi ve kotasyon damgası duruyordu — solundaki başlığın
          birebir kopyası, aynı panelin 400 piksel yanında. Kopyası gitti;
          kalan tek sayı başlığın söylemediği şey. Künye onun neyle
          hesaplandığını söylüyor (lib/data.ts → liveMarketCap). Arka
          plandaki sembol filigranı ve yörünge halkaları da gitti: derinlik
          tonla kuruluyor, süsle değil (tema § 1). */}
      {marketCap !== null && (
        <div className={styles.profileVisual} data-has-rank={rankInfo !== null}>
          <dl className={styles.profileMetric}>
            <dt>{t.market.marketCap}</dt>
            <dd className={cn("numeral", styles.profileCapValue)}>
              {formatMoneyCompact(marketCap, locale)}
            </dd>
            {liveCap && <dd className={styles.profileCapNote}>{t.stock.capLiveNote}</dd>}
          </dl>
          {rankInfo && (
            <dl className={styles.profileRank}>
              <dt>{t.stock.capRank}</dt>
              <dd className={cn("numeral", styles.profileRankValue)}>
                {rankInfo.rank.toLocaleString(locale)}.
                <span>{t.stock.capRankOf.replace("{n}", rankInfo.total.toLocaleString(locale))}</span>
              </dd>
              {/* Ölçek: en büyük şirkete oran — bir büyüklük, yargı değil
                  (CLAUDE.md "Karşılaştırılan her büyüklük bir de ÇİZGİ"). */}
              <dd aria-hidden className={styles.profileRankTrack}>
                <i style={{ width: `${Math.max(2, Math.min(100, rankInfo.share * 100)).toFixed(1)}%` }} />
              </dd>
              <dd className={styles.profileCapNote}>
                {rankInfo.leader
                  ? t.stock.capLeader
                      .replace("{symbol}", rankInfo.leader.symbol)
                      .replace("{value}", formatMoneyCompact(rankInfo.leader.marketCap, locale))
                  : t.stock.capLeaderSelf}
              </dd>
            </dl>
          )}
        </div>
      )}
      {/* Şirket ne iş yapar — sektör satırından önce düz cümleyle anlatılır */}
      {about && (
        <p className={styles.about}>
          {about}
        </p>
      )}
      {/* Satırlar artan yere yayılır: kart grafiğin boyuna gerildiğinde
          altta ölü boşluk yerine nefes alan bir liste kalıyor. İçerik
          kartı zaten dolduruyorsa `justify-between`in etkisi olmuyor. */}
      {/* `justify-between` KALKTI — artan yer ARALIKLARA gidiyordu.
          CLAUDE.md "Düzen" bölümü bunu açıkça yasaklıyor: aralık kendi
          ölçüsü olmaktan çıkıp komşu kolonun boyuna bağlanıyor. Burada tam
          o oluyordu: kart grafik panelinin boyuna geriliyor ve 37 piksellik
          satırların ARASI 54 piksele açılıyordu. Kimlik grafiğin içine
          girince panel doksan piksel uzadı ve kusur gözle görülür hâle
          geldi — sebebi birleştirme değil, birleştirmenin ortaya çıkardığı
          bu satırdı.
          Artan yer artık satırların İÇİNE gidiyor (`flex-1`), ayıraçlar eşit
          aralıkta kalıyor; emsali aynı sayfadaki Anahtar Metrikler kartı. */}
      {/* KÜNYE IZGARASI (28 Eylül). Satırlar tam genişlikte etiket-değer
          listesiydi: altı satır × 42 piksel, her birinin solunda ikon
          karosu, arasında kıl çizgi — bir form gibi okunuyordu ve kolonun
          yarısı iki uç arasındaki boşluktu. Künye artık iki sütunlu bir
          ızgara: etiket küçük ve üstte, değer altında ve güçlü. Aynı bilgi
          üç satıra iniyor (tek sayıda kalırsa sonuncusu iki sütunu kaplıyor,
          boş hücre yok); ikonlar etiketin önünde, karo değil. Satır
          sırası ve koşulları aynı. */}
      <dl className={styles.facts}>
        {rows.map(([label, value]) => (
          <div key={label} className={styles.fact}>
            {rowLabel(label)}
            <dd>{value}</dd>
          </div>
        ))}
        {/* Adres sağlayıcıdan geliyor; şeması süzülmeden href'e konmaz. */}
        {websiteHref && (
          <div className={styles.fact}>
            {rowLabel(t.stock.website)}
            <dd className="min-w-0">
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-44 text-primary hover:underline"
              >
                {/* KIRPILMIYOR, SARIYOR: ızgaranın yarım hücresinde
                    "coca-colacompany.com" üç nokta ile kesiliyordu
                    (1440'ta ölçüldü); adres bölünmeden okunmalı. */}
                {/* Sondaki eğik çizgi de gidiyor: "nvidia.com/" bir adres
                    değil, bir yolun başı gibi okunuyordu. */}
                {websiteHref.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            </dd>
          </div>
        )}
      </dl>
      {/* 52 HAFTA BANDI PROFİLİN SONUNDA (24 Eylül). Anahtar Metrikler'de
          ayrı bir bloktu; profil kartı ise grafiğin yanında içeriğinden
          erken bitiyordu (1440'ta AAPL 141, ASTS 251, TSM 295 piksel
          kuyruk). Band şirketin künyesi kadar kalıcı bir okuma: fiyatın
          yılın neresinde durduğu. Uçlar metin olarak yazılı; ray yalnızca
          çizim (`aria-hidden`). ADR'de uçlar ana borsanın parasında ve ray
          yok (`week52Band`). */}
      {/* BANT OKUNUR KILINDI (28 Eylül). Uçlar tek bir "93,54 $ – 2.354,39 $"
          dizesi olarak başlığın sağındaydı, konum yüzdesi etiketin yanında
          soluk bir ekti; ray ise altta sayısız bir çizgi. Şimdi konum
          başlıkta bir rozet, uçlar rayın İKİ UCUNUN ALTINDA kendi adlarıyla
          (en düşük solda, en yüksek sağda): göz sayıyı çizginin ucunda
          buluyor. Ray yine yalnızca çizim, her sayı metinde. ADR'de ray
          yok; uçlar aynı satırda metin olarak kalıyor. */}
      {band && (
        <div className={styles.profileBand}>
          <div className={styles.bandHead}>
            <span className={styles.profileBandLabel}>{t.stock.week52Range}</span>
            {band.position !== null && (
              <span className={cn("numeral", styles.bandPosition)}>
                {t.stock.week52Position.replace("{value}", formatPercentPlain(band.position, locale, 0))}
              </span>
            )}
          </div>
          {band.onRail && quoteForCap.ok && (
            <PriceRail
              marks={[
                { kind: "band", from: band.low, to: band.high, tone: "range" },
                { kind: "point", at: quoteForCap.data.price, variant: "live" },
              ]}
              pad={0}
              className={styles.bandRail}
            />
          )}
          <dl className={styles.bandEnds}>
            <div>
              <dt>{t.chart.periodLow}</dt>
              <dd className="numeral">{formatPrice(band.low, locale, { currency: band.para })}</dd>
            </div>
            <div>
              <dt>{t.chart.periodHigh}</dt>
              <dd className="numeral">{formatPrice(band.high, locale, { currency: band.para })}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
    </>
  );
}
