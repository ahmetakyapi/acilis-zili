import type { CSSProperties } from "react";
import { CaretDown, CaretUp, CaretUpDown } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { FoldToggle } from "@/components/ui/FoldToggle";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { EmptyState, LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import type { CompanyCardExtra } from "@/lib/company-card";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { quoteBasis, type MarketStatus } from "@/lib/market-hours";
import { capAxis } from "@/lib/market-scales";
import type { Quote } from "@/lib/providers/types";
import {
  cn,
  directionOf,
  formatCompact,
  formatMoneyCompact,
  formatPercent,
  formatPrice,
  NO_VALUE,
} from "@/lib/utils";
import {
  INDEX_TABS,
  PAGE_STEP,
  PHONE_ROWS,
  approxPoints,
  type Row,
  type SortDir,
  type SortKey,
  type TabKey,
} from "./index-shared";
import { RowFlip } from "./RowFlip";
import styles from "./MembersTable.module.css";

/* ---- Tam bileşen tablosu ----
   10 Kasım 2026: `app/(app)/piyasalar/page.tsx`ten taşındı ve yeniden
   kuruldu (görsel tur). Gerekçe ve ölçümler aşağıda "YOĞUNLUK VE IZGARA". */

function sortHref(
  tab: TabKey,
  key: SortKey,
  sort: SortKey,
  dir: SortDir,
  limit: number,
  base: string,
) {
  const nextDir: SortDir = sort === key && dir === "desc" ? "asc" : "desc";
  // Derinlik korunur: 180 satıra inmiş biri sütun başlığına basınca ilk 60'a
  // geri fırlatılmamalı.
  const depth = limit > PAGE_STEP ? `&adet=${limit}` : "";
  return `${base}?endeks=${tab}&sirala=${key}&yon=${nextDir}${depth}`;
}

function SortHead({
  label,
  href,
  active,
  dir,
  className,
  align = "end",
  children,
}: {
  label: string;
  href: string;
  active: boolean;
  dir: SortDir;
  className?: string;
  align?: "start" | "end";
  /** Başlığın yanındaki ek (piyasa değeri ekseninin basamak etiketleri). */
  children?: React.ReactNode;
}) {
  const Icon = active ? (dir === "desc" ? CaretDown : CaretUp) : CaretUpDown;
  return (
    <th
      scope="col"
      /* Sıralı sütun rengi ve `aria-hidden` bir üçgenle anlatılıyordu; ikisi
         de yardımcı teknolojiye ulaşmıyor. Gerekçe ikizinde yazılı:
         app/(app)/sirketler/page.tsx */
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
      className={cn(styles.sortCell, className)}
      data-align={align}
      data-active={active || undefined}
    >
      <span className={styles.sortWrap}>
        {/* Dokunma alanı yazının kendisi kadardı (14px); negatif margin +
            dikey dolgu tabloyu büyütmeden hedefi 32px'e çıkarır. */}
        {/* scroll={false}: sıralama bir gezinme değil, aynı tablonun yeniden
            dizilmesi. Varsayılan davranışta okuyucu tablonun ortasında bir
            başlığa basınca sayfanın en üstüne fırlıyor ve aşağı geri kaydırmak
            zorunda kalıyordu. */}
        {/* MOBİLDE 44px. Sıralama başlığı tablonun ANA denetimi ama dokunma
            hedefi 32 pikseldi. Negatif margin dolguyu emiyor, yani hedef
            büyürken satır yüksekliği değişmiyor; masaüstünde imleç hassas,
            orada 32px yeterli (`.sortLink`). */}
        {/* SIRALAMA DURUMU ÜÇ HÂL (10 Kasım). Üçgen glifleri (▼ ▲ ▽) 8
            piksellik `text-micro` ile basılıyordu: sıralı sütun ötekilerden
            yalnız renkle ayrışıyor, sırasız sütunların içi boş üçgeni "açılır
            menü" gibi okunuyordu. Şimdi ikon: sıralı sütunda yönü gösteren
            dolu ok ve başlığın altında 2 piksellik mavi çizgi (`data-active`),
            ötekilerde sönük çift ok; üzerine gelince koyulaşıyor. */}
        <Link href={href} scroll={false} className={styles.sortLink}>
          {label}
          <Icon aria-hidden size={12} weight={active ? "fill" : "bold"} className={styles.sortIcon} />
        </Link>
        {children}
      </span>
    </th>
  );
}

export function MembersTable({
  tab,
  rows,
  limit,
  sort,
  dir,
  showContribution,
  locale,
  t,
  cards,
  basePath = "/piyasalar",
}: {
  tab: TabKey;
  rows: Row[];
  /** Kaç satır basılacak — sıralama TAMAMI üzerinde, dilim sonra alınır. */
  limit: number;
  sort: SortKey;
  dir: SortDir;
  showContribution: boolean;
  locale: Locale;
  t: Dictionary;
  /** Şirket kartı: sayfanın paketi ve üstte zaten kaydı basılmış semboller. */
  cards: {
    quotes: Record<string, Quote>;
    stale: boolean;
    names: Record<string, SymbolMeta>;
    status: MarketStatus;
    facts: (row: Row) => CompanyCardExtra;
    skip: ReadonlySet<string>;
  };
  /** Sıralama ve "devamı" bağlantılarının kökü — ölçüm önizlemesi kendi
      rotasını verir (`olcum` skill'i); sayfada varsayılan. */
  basePath?: string;
}) {
  if (rows.length === 0) {
    return (
      <Panel>
        <EmptyState title={t.common.noData} />
      </Panel>
    );
  }

  /* Değeri olmayan satır `null` — eksik veri bir uç değer değil bilinmezlik.
     `-Infinity` azalan sıralamada doğru çalışıp artanda bozuluyordu: artana
     geçen okuyucu listenin başında en çok düşenleri değil kotasyonu hiç
     gelmemiş şirketleri buluyordu (aynı düzeltme Şirketler tablosunda da). */
  const valueOf = (row: Row): number | string | null => {
    switch (sort) {
      case "fiyat":
        return row.quote?.price ?? null;
      case "ad":
        return row.member.name;
      case "katki":
        return row.contribution ?? null;
      case "cap":
        return row.marketCap ?? null;
      default:
        return row.quote?.changePct ?? null;
    }
  };

  /* Cubuk olcegi: grubun EN BUYUK mutlak degisimi. Yuzde degerleri
     kendi araliginda kucuk (±%3) oldugu icin sabit bir olcek cubuklari
     gorunmez yapiyordu. */
  const peakChange = Math.max(
    ...rows.map((row) => Math.abs(row.quote?.changePct ?? 0)),
    0.01,
  );
  /* Listede eksi bir değişim var mı — çubuğun sıfırı ortada mı. */
  const changeSigned = rows.some((row) => (row.quote?.changePct ?? 0) < 0);
  /* PİYASA DEĞERİ BİR DE ÇİZİM (26 Eylül). "Karşılaştırılan her büyüklük bir
     de çizgi olarak okunur" (CLAUDE.md); sütun yalnızca sayıydı ve "hangisi
     ne kadar büyük" basamak basamak okunuyordu.
     10 Kasım: DOĞRUSAL ÇUBUK → ONLUK EKSENDE NOKTA. İlk çizim listenin en
     büyüğüne göre doğrusal bir çubuktu ("logaritmik ölçek büyüklüğü
     çarpıtırdı"). Doğruydu ama okunmuyordu: Nasdaq 100'de dev 4,38 T $,
     ortanca ~80 Mr $; 96 piksellik rayda 60 satırın 52'sinde dolgu 3
     pikselin altındaydı ve sütun "veri gelmemiş" gibi duruyordu (1440,
     canlı ekran, ölçüldü). Logaritmik ÇUBUK yine yasak (uzunluğun sıfırı
     yok); yerine çubuk değil KONUM: her şirket, onluk basamakları çentikli
     bir eksende bir nokta (`capAxis`, lib/market-scales.ts; testli).
     Basamak etiketleri sütun başlığında yazılı — ölçeğin doğrusal olmadığı
     saklanmıyor. Nokta bir yargı değil, yumuşak mavide (`--bar-soft`). */
  const axis = capAxis(rows.map((row) => row.marketCap));
  /* GÜN ARALIĞI SÜTUNU (10 Kasım). Şirket adı ile Değişim arasında 1320
     piksellik tabloda ~500 piksel boşluk vardı; kotasyon ise günün dibini
     ve tepesini zaten taşıyor (şirket kartında yazıyla duruyordu). Sütun
     endeks kartındaki gün aralığı şeridinin aynısı: kulvar, önceki
     kapanışın çentiği, ondan fiyata dolgu, fiyat noktası. Kural da aynı
     (veri dürüstlüğü 4): kotasyon bu seansa ait değilse (`lastClose`) ya da
     dip/tepe yoksa satırda aralık HİÇ çizilmez; hiçbir satırda yoksa
     (açılış öncesi) sütun da basılmaz ve boşluğu Değişim şeridi alır. */
  const rangeOf = (quote: Quote | undefined) =>
    quote && quote.low !== null && quote.high !== null && quote.high > quote.low &&
    quoteBasis(quote, cards.status) !== "lastClose"
      ? { low: quote.low, high: quote.high }
      : null;
  const showRange = rows.some((row) => rangeOf(row.quote) !== null);

  const ordered = [...rows].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    // Boşlar her iki yönde de sonda; kendi aralarında tablo sırasını korur.
    if (va === null) return vb === null ? 0 : 1;
    if (vb === null) return -1;
    if (typeof va === "string" || typeof vb === "string") {
      const cmp = String(va).localeCompare(String(vb), "en");
      return dir === "asc" ? cmp : -cmp;
    }
    return dir === "asc" ? va - vb : vb - va;
  });

  // Dilim SIRALAMADAN SONRA — bkz. PAGE_STEP.
  const sorted = ordered.slice(0, limit);
  const hasMore = ordered.length > sorted.length;
  const moreHref = `${basePath}?endeks=${tab}&sirala=${sort}&yon=${dir}&adet=${limit + PAGE_STEP}`;

  const fresh = sorted.filter((row) => !cards.skip.has(row.member.symbol));
  const shownShare = (sorted.length / ordered.length) * 100;

  return (
    <Panel
      id="market-members"
      className={styles.panel}
      style={{ "--fold-inset": "16px" } as CSSProperties}
      data-range={showRange || undefined}
    >
      <CompanyCards
        symbols={fresh.map((row) => row.member.symbol)}
        quotes={cards.quotes}
        stale={cards.stale}
        names={cards.names}
        status={cards.status}
        extras={Object.fromEntries(fresh.map((row) => [row.member.symbol, cards.facts(row)]))}
      />
      {/* SIRALAMA DEĞİŞİNCE SATIRLAR YERİNE KAYAR (10 Kasım; gerekçe
          RowFlip.tsx). Sunucu tabloyu son hâliyle basıyor; bu yaprak yalnız
          eski konumdan yenisine `translate` oynatıyor. */}
      <RowFlip scope="market-members" token={tab} order={`${sort}:${dir}:${limit}`} />
      {/* Sayaç başlıkta: tablo kırpılıyor ve okuyucu tıklamadan önce
          listenin ne kadarını gördüğünü bilmeli. Aynı kalıp ana sayfadaki
          bilanço panelinde ve /mercek arşivinde de var. */}
      <PanelHeader
        title={t.markets.constituents}
        meta={
          hasMore
            ? t.companies.showing
                .replace("{n}", String(sorted.length))
                .replace("{total}", String(ordered.length))
            : undefined
        }
      />
      {/* Tablo telefonda `min-w-[680px]` ile açılıyordu: ilk bakışta yalnızca
          sıra, şirket ve değişimin bir kısmı görünüyor, FİYAT ekranın dışında
          kalıyordu. Bir bileşen listesinde "ne kadar oynamış" ile "kaç dolar"
          birlikte okunur — birini görmek için yana kaydırmak gerekmesi tabloyu
          ilk açılışta kırık gösteriyordu.

          Çözüm daraltmak değil, ELEMEK: sıra numarası, piyasa değeri ve Dow
          katkısı telefonda gizleniyor (sm+ hepsi geri geliyor), kalan üç sütun
          390px'e rahat sığıyor ve yatay kaydırma kalkıyor. Piyasa değeri
          kaybolmuyor — fiyatın altına ikinci satır olarak iniyor.

          10 Kasım: ELEME → SABİT SÜTUN + KAYDIRMA (`arayuz.md`, "Kaydırma
          saklanmaz"). İlk ekranın kuralı duruyor — 390'da Şirket, Değişim
          ve Fiyat kaydırmadan okunuyor (ölçü aşağıda, `.table`); ama gün
          aralığı, piyasa değeri ve Dow katkısı artık telefonda da VAR:
          Şirket sütunu yerinde kalıyor, ötekiler altından kayıyor, sağ kenar
          "devamı var" diye soluyor (`ScrollEdges fixedStart`). Piyasa
          değerinin fiyatın altına inen ikinci satırı bu yüzden kalktı
          (sütunun kendisi geldi; satır 53'ten 48 piksele indi). */}
      {/* KAP KLAVYEYLE ODAKLANABİLİR — gerekçe ikizinde (sirketler). */}
      {/* TELEFONDA İLK ON BEŞ (3 Ekim). Tablo 390 pikselde 60 satır,
          ~4.600 piksel ölçüldü; altındaki bölümlere ulaşmak için yüz kez
          kaydırmak gerekiyordu. Satırlar sunucuda yine çiziliyor, on beşin
          ötesi katlı geliyor ve JS'siz anahtar açıyor (FoldToggle `phone`);
          640'tan itibaren katlama yok. */}
      <FoldToggle
        id="members-fold"
        phone
        hiddenCount={Math.max(0, sorted.length - PHONE_ROWS)}
        more={t.markets.constituentsMore.replace("{n}", String(Math.max(0, sorted.length - PHONE_ROWS)))}
        less={t.markets.constituentsLess}
      >
      <ScrollEdges
        fixedStart
        className={cn("scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)", styles.scroller)}
        tabIndex={0}
        role="region"
        aria-label={t.markets.constituents}
      >
        {/* YOĞUNLUK VE IZGARA (10 Kasım, görsel tur). Önce: 60 satır × 59
            piksel = 3.540 piksellik seyrek bir duvar (1440, canlı). Satır iki
            katlıydı (sembol üstte, ad altta; sayının altında çubuk); 1320
            piksellik tabloda Şirket ile Değişim arasında ~500 piksel boştu,
            Değişim çubuğu 96 piksel ve değerlerin çoğu 1–2 piksellik çizgiydi.
            Şimdi satır TEK KAT (46 piksel; 60 satır 2.760): sembol ve ad aynı
            hatta, şerit sayının ALTINDA değil YANINDA. Boşluğu Değişim şeridi
            alıyor: sıfırı ortada, sütunun bütün esnek genişliğini kaplayan
            ayrışan (diverging) şerit — sıralı listede 60 şerit alt alta tek
            bir dağılım eğrisi çiziyor. Fiyatın sağında gün aralığı (varsa),
            sonra piyasa değeri ve onluk eksendeki noktası. Genişlikler
            `table-fixed` ile değil içerikten: sayı sütunları `width:1%` +
            `nowrap`, Şirket tavanlı, kalan her piksel Değişim şeridinde.
            Sonra ölçümü: MembersTable.module.css başında. */}
        <table className={styles.table} data-signed={changeSigned || undefined}>
          <caption className="sr-only">{INDEX_TABS.find((entry) => entry.key === tab)?.label} · {t.markets.constituents}</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.rankHead}>#</th>
              <SortHead
                label={t.companies.company}
                href={sortHref(tab, "ad", sort, dir, limit, basePath)}
                active={sort === "ad"}
                dir={dir}
                align="start"
                className={styles.companyHead}
              />
              {/* Değişim fiyattan önce — bkz. /sirketler tablosu. */}
              <SortHead
                label={t.companies.change}
                href={sortHref(tab, "degisim", sort, dir, limit, basePath)}
                active={sort === "degisim"}
                dir={dir}
                className={styles.changeHead}
              />
              <SortHead
                label={`${t.companies.price} ($)`}
                href={sortHref(tab, "fiyat", sort, dir, limit, basePath)}
                active={sort === "fiyat"}
                dir={dir}
              />
              {showRange && (
                <th scope="col" className={styles.rangeHead}>{t.markets.dayRange}</th>
              )}
              <SortHead
                label={t.market.marketCap}
                href={sortHref(tab, "cap", sort, dir, limit, basePath)}
                active={sort === "cap"}
                dir={dir}
                className={styles.capHead}
              >
                {axis && (
                  <span className={cn("numeral", styles.capAxis)} aria-hidden>
                    {axis.ticks.map((tick) => (
                      <span key={tick} style={{ left: `${(axis.at(tick) * 100).toFixed(2)}%` }}>
                        {/* "10,0 Mr" → "10 Mr": basamak etiketi tam onluk,
                            ondalık sıfır yalnız yer kaplıyordu (etiketler
                            132 piksellik eksende birbirine biniyordu). */}
                        {formatCompact(tick, locale).replace(/[.,]0+(?=\s|$)/, "")}
                      </span>
                    ))}
                  </span>
                )}
              </SortHead>
              {showContribution && (
                <SortHead
                  label={t.markets.contribution}
                  href={sortHref(tab, "katki", sort, dir, limit, basePath)}
                  active={sort === "katki"}
                  dir={dir}
                />
              )}
            </tr>
          </thead>
          <tbody data-motion-stagger>
            {sorted.map((row, index) => {
              const quote = row.quote;
              const tone = directionOf(quote?.changePct);
              const change = quote?.changePct ?? null;
              const ratio = change !== null ? Math.min(1, Math.abs(change) / peakChange) : 0;
              const range = rangeOf(quote);
              const at = (value: number) =>
                range ? Math.min(100, Math.max(0, ((value - range.low) / (range.high - range.low)) * 100)) : 0;
              const pricePos = range ? at(quote!.price) : 0;
              const closePos = range && quote!.prevClose !== null ? at(quote!.prevClose) : null;
              return (
                <tr
                  key={row.member.symbol}
                  data-row={row.member.symbol}
                  data-fold={index >= PHONE_ROWS || undefined}
                >
                  {/* SIRA NUMARASI LOGOYLA AYNI HATTA (10 Kasım): hücre tepeye
                      yaslıyken "1" logonun 6 piksel üstünde duruyordu. Satır
                      tek kat ve dikeyde ortalı; sayı sağa yaslı, tabular —
                      "9" ile "10" aynı sağ kenarda. */}
                  <td className={cn("numeral", styles.rank)}>{index + 1}</td>
                  <th scope="row" className={styles.company}>
                    <Link
                      href={`/hisse/${row.member.symbol}`}
                      prefetch={false}
                      /* Bağlantı hücreyi dolduruyor: dokunma hedefi metnin
                         kendi 20px'iyle sınırlıydı; satır yüksekliği kadar. */
                      className={styles.companyLink}
                      data-cc={row.member.symbol}
                    >
                      <LogoTile symbol={row.member.symbol} logoUrl={row.logoUrl} size="sm" className={styles.logo} />
                      <span className={styles.companyText}>
                        <span className={styles.symbol}>{row.member.symbol}</span>
                        <span title={row.member.name} className={styles.name}>{row.member.name}</span>
                      </span>
                    </Link>
                  </th>
                  {/* Sayı + oran çubuğu birlikte: tablo yalnızca sayıdan
                      ibaretken "kim ne kadar oynamış" sorusu ancak yüzdeler
                      tek tek okunup kafada sıralanarak cevaplanıyordu.
                      Çubuk sıralamayı göze taşıyor ve üstteki En Çok
                      Artanlar kartıyla aynı ölçeği kullanıyor. */}
                  {/* 6 Kasım: çubuk sitenin ölçek diline geçti (`ScaleBar`,
                      CompareScale.tsx). Eskisi sağa yaslı, tek yönlü ve yön
                      renginde 4 piksellik bir şeritti: artı ile eksi aynı
                      yöne uzuyor, fark yalnız renkteydi. Şimdi listede eksi
                      varsa SIFIR ORTADA — artı sağa, eksi sola açılıyor;
                      renk yalnız işaretten (`signal`), kalınlık 5 piksel.
                      Değişim bilinmiyorsa çubuk yine HİÇ çizilmiyor: sıfır
                      genişlik "hareket yok" demek olurdu ve o da bir iddia.
                      10 Kasım: aynı dil, sütunun kendi şeridi (`.lane`):
                      96 piksel tavan kalktı, şerit sütunun esnek genişliğini
                      kaplıyor ve sıfır çizgisi her satırda görünüyor
                      (`--line-strong`); `ScaleBar` öteki ekranlarda aynen. */}
                  <td className={styles.changeCell}>
                    <span className={styles.change}>
                      {change !== null ? (
                        <span className={styles.lane} data-motion-track aria-hidden>
                          {/* Tam %0: ray ve sıfır çizgisi var, dolgu yok —
                              "değişmedi" bir uzunluk değil. */}
                          {change !== 0 && <i
                            className={styles.fill}
                            data-tone={tone}
                            data-motion-draw="line"
                            style={{
                              width: `${(changeSigned ? ratio * 50 : ratio * 100).toFixed(2)}%`,
                              transformOrigin: change < 0 ? "right center" : "left center",
                            }}
                          />}
                        </span>
                      ) : <span />}
                      <span
                        className={cn(
                          "numeral",
                          styles.changeNum,
                          tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted",
                        )}
                      >
                        {quote ? formatPercent(quote.changePct, locale) : NO_VALUE}
                      </span>
                    </span>
                  </td>
                  <td className={cn("numeral", styles.price)}>
                    {quote ? formatPrice(quote.price, locale) : NO_VALUE}
                  </td>
                  {showRange && (
                    <td className={styles.rangeCell}>
                      {range ? (
                        <span
                          className={cn("numeral", styles.range)}
                          role="img"
                          aria-label={`${t.markets.dayRange}: ${formatPrice(range.low, locale)} – ${formatPrice(range.high, locale)}`}
                        >
                          <span aria-hidden>{formatPrice(range.low, locale)}</span>
                          <i className={styles.rangeLane} aria-hidden>
                            {closePos !== null && (
                              <>
                                <span
                                  className={styles.rangeFill}
                                  data-tone={tone}
                                  style={{ left: `${Math.min(closePos, pricePos)}%`, width: `${Math.abs(pricePos - closePos)}%` }}
                                />
                                <span className={styles.rangeClose} style={{ left: `${closePos}%` }} />
                              </>
                            )}
                            <span className={styles.rangeDot} data-tone={tone} style={{ left: `${pricePos}%` }} />
                          </i>
                          <span aria-hidden>{formatPrice(range.high, locale)}</span>
                        </span>
                      ) : (
                        <span className={styles.rangeNone}>{NO_VALUE}</span>
                      )}
                    </td>
                  )}
                  <td className={styles.capCell}>
                    <span className={styles.cap}>
                      <span className="numeral">
                        {row.marketCap ? formatMoneyCompact(row.marketCap, locale) : NO_VALUE}
                      </span>
                      {axis && (
                        <i className={styles.capLane} aria-hidden>
                          {axis.ticks.map((tick) => (
                            <span key={tick} className={styles.capTick} style={{ left: `${(axis.at(tick) * 100).toFixed(2)}%` }} />
                          ))}
                          {row.marketCap ? (
                            <b className={styles.capDot} style={{ left: `${(axis.at(row.marketCap) * 100).toFixed(2)}%` }} />
                          ) : null}
                        </i>
                      )}
                    </span>
                  </td>
                  {showContribution && (
                    <td className={cn("numeral", styles.contribution)}>
                      {row.contribution !== null
                        ? approxPoints(row.contribution, locale)
                        : NO_VALUE}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollEdges>
      </FoldToggle>
      {/* Sayaç + devamı — /sirketler dizinindeki ölçünün aynısı.
          scroll={false}: okuyucu tablonun dibinde, yeni satırlar geldiğinde
          sayfanın başına fırlatılmamalı. */}
      {/* 10 Kasım: sayaç bir de ÇİZGİ. "102 şirketin 60 tanesi" yazısı ile
          buton, 1320 piksellik bandın iki ucuna gerilmişti (`justify-between`
          yasağı) ve listenin ne kadarının açıldığı yalnız okunarak
          anlaşılıyordu. Şimdi sayaç, 5 piksellik ilerleme şeridi ve buton
          tek grupta, solda; şerit açılan payı gösteriyor. */}
      {hasMore && (
        <div className={styles.more}>
          <p className={cn("numeral", styles.moreCount)}>
            {t.companies.showing
              .replace("{n}", String(sorted.length))
              .replace("{total}", String(ordered.length))}
          </p>
          <span className={styles.moreLane} aria-hidden>
            <i data-motion-draw="line" style={{ width: `${shownShare.toFixed(1)}%` }} />
          </span>
          <Link
            href={moreHref}
            scroll={false}
            /* 44px: sayfanın en altındaki tek eylem ve mobilde dokunma
               eşiğinin altındaydı (40px). */
            className={styles.moreButton}
          >
            {t.companies.showMore}
            <CaretDown aria-hidden size={13} weight="bold" />
          </Link>
        </div>
      )}

      {showContribution && (
        <p className={styles.note}>{t.markets.contributionHint}</p>
      )}
    </Panel>
  );
}
