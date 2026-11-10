import type { CSSProperties } from "react";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { FoldToggle } from "@/components/ui/FoldToggle";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import type { CompanyCardExtra } from "@/lib/company-card";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { quoteBasis, type MarketStatus } from "@/lib/market-hours";
import { DAY_LANE_SPAN, WEEK_LANE_SPAN, capShares, laneModeOf, laneOver, laneSpan, rangeShare } from "@/lib/market-scales";
import type { Quote } from "@/lib/providers/types";
import { sectorLabel } from "@/lib/sectors";
import {
  cn,
  formatMoneyCompact,
  formatPercentPlain,
  formatPrice,
  NO_VALUE,
} from "@/lib/utils";
import { BoardSortHead, CompanyCell, MoreBand, MoveFigure, RangeFigure, board, rowStep } from "./BoardTable";
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
import { RowFlip, RowTap } from "./RowFlip";
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

/* SIRALAMA BAŞLIĞI ve KULVAR ortak parçada (10 Kasım, gece):
   `BoardSortHead`, `ZeroBar` — components/markets/BoardTable.tsx. Buradaki
   `SortHead` ve `Lane` oraya taşındı; karar yorumları (üç hâlli sıralama
   imi, `aria-sort`, 44 piksellik hedef, sabit ölçek, tam %0'da dolgu yok)
   onlarla birlikte. */

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
      case "hafta":
        return row.week;
      default:
        return row.quote?.changePct ?? null;
    }
  };

  /* Cubuk olcegi: grubun EN BUYUK mutlak degisimi. Yuzde degerleri
     kendi araliginda kucuk (±%3) oldugu icin sabit bir olcek cubuklari
     gorunmez yapiyordu.
     10 Kasım (akşam): ÖLÇEK SABİT. O karar şeridin sütunun bütün esnek
     genişliğini (320–541 piksel) kapladığı tablo içindi; sahibinin itirazı
     "yüzde ve fiyat geri planda kalıyor" — şerit satırın yarısını tutuyordu.
     Şerit artık sayının yanında 56 piksellik bir yardımcı ve tam kolu
     `DAY_LANE_SPAN` (±%3; ısı haritasının doyduğu eşik): dar kulvarda
     "en büyüğe göre" ölçek tek bir uç satır yüzünden herkesi 1 piksele
     indirirdi (gerekçe ve test: lib/market-scales.ts → `laneArm`).
     10 Kasım (gece): ÖLÇEK LİSTEYE GÖRE AÇILIR, ±%3 / ±%8 TABAN. Sabit
     ölçekte "en çok düşen" sıralamasının ilk satırları aynı dolu kolu
     çiziyordu (−%9,34, −%3,88, −%3,01; farkı yalnız sayı söylüyordu).
     Ölçek sekmenin BÜTÜN üyelerinden (`rows`; yalnız açık satırlardan
     değil): "Daha Fazla Göster" çubukları yeniden çizdirmez. İki okuma (`laneSpan`): olağan sırada üyelerin 90.
     yüzdeliği, liste o değişime göre sıralıyken o YÖNÜN ucunun eşiği
     (azalan sırada yükselenlerin, artanda düşenlerin). "En büyüğe
     göre ölçek" yasağı duruyor: tek uç değer ölçeği belirlemez, kola
     dayanır ve ucunda kesik taşır. Künye gerçek ölçeği yazar. */
  const daySpan = laneSpan(rows.map((row) => row.quote?.changePct), DAY_LANE_SPAN, laneModeOf(sort === "degisim", dir));
  const weekSpan = laneSpan(rows.map((row) => row.week), WEEK_LANE_SPAN, laneModeOf(sort === "hafta", dir));
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
     bir eksende bir nokta.
     10 Kasım (akşam), sahibinin itirazı — "piyasa değerini de direkt yazsak
     daha doğru olacak": NOKTA EKSENİ KALKTI. Eksen sayıyı dolaylı
     okutuyordu (okur noktanın yerini çentiklere göre çözüp sonra soluk
     gri sayıya dönüyordu) ve 132 piksel tutuyordu. Şimdi sayının KENDİSİ
     güçlü mürekkeple (14/600), yanında tek yardımcı: şirketin listedeki
     toplam piyasa değerinden PAYI (`capShares`, testli). Pay bir sayı,
     çizim değil — doğrusal çubuğun 3 pikselin altında kalan uçlarını
     ("%0,07") yazıyla söylüyor; logaritmik çubuk yasağı yerinde. Resmî
     endeks ağırlığı olmadığı tablo künyesinde yazılı. Dow fiyat ağırlıklı:
     orada pay yanıltırdı, basılmıyor (Katkı sütunu zaten var). */
  const shareOf = tab === "dow" ? null : capShares(rows.map((row) => row.marketCap));
  /* HAFTALIK SÜTUN (10 Kasım, sahibinin isteği). Veri sayfada kuruluyor
     (`getWeeklyChanges`, Şirketler tablosuyla aynı kaynak). Sağlayıcı bar
     vermediyse hiçbir satırda değer yoktur ve sütun HİÇ basılmaz ("–"
     duvarı olmaz); tek tek eksik satırda hücre "–". */
  const showWeek = rows.some((row) => row.week !== null);
  const showSector = rows.some((row) => Boolean(row.member.sector));
  /* GÜN ARALIĞI SÜTUNU (10 Kasım). Şirket adı ile Değişim arasında 1320
     piksellik tabloda ~500 piksel boşluk vardı; kotasyon ise günün dibini
     ve tepesini zaten taşıyor (şirket kartında yazıyla duruyordu). Sütun
     endeks kartındaki gün aralığı şeridinin aynısı: kulvar, önceki
     kapanışın çentiği, ondan fiyata dolgu, fiyat noktası. Kural da aynı
     (veri dürüstlüğü 4): kotasyon bu seansa ait değilse (`lastClose`) ya da
     dip/tepe yoksa satırda aralık HİÇ çizilmez; hiçbir satırda yoksa
     (açılış öncesi) sütun da basılmaz; boşluk sayı sütunlarının arasına
     dağılır (kulvarlar tavanlı, şerit yeniden büyümez). */
  const rangeOf = (quote: Quote | undefined) =>
    quote && quote.low !== null && quote.high !== null && rangeShare(quote.low, quote.high, quote.price) !== null &&
    quoteBasis(quote, cards.status) !== "lastClose"
      ? { low: quote.low, high: quote.high }
      : null;
  const showRange = rows.some((row) => rangeOf(row.quote) !== null);
  /** "İlk üç" vurgusu yalnız hareket sıralamalarında (gerekçe satırda). */
  const leadSort = sort === "degisim" || sort === "hafta";

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

  /* Künyenin "kesik uç" cümlesi yalnız GÖRÜNEN satırlarda taşan varsa. */
  const anyOver = sorted.some(
    (row) => (row.quote?.changePct != null && laneOver(row.quote.changePct, daySpan)) || (showWeek && row.week !== null && laneOver(row.week, weekSpan)),
  );

  const fresh = sorted.filter((row) => !cards.skip.has(row.member.symbol));
  const shownShare = (sorted.length / ordered.length) * 100;

  return (
    <Panel
      id="market-members"
      className={cn(board.panel, styles.panel)}
      style={{ "--fold-inset": "16px" } as CSSProperties}
      data-range={showRange || undefined}
      data-week={showWeek || undefined}
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
      {/* SATIRIN TAMAMI HİSSE SAYFASINA GİDER (10 Kasım). Bağlantı yalnız
          Şirket hücresindeydi; yüzdeye ya da fiyata basan okur hiçbir yere
          gitmiyordu. Gerçek bağlantı yerinde (klavye, orta tık, şirket
          kartı); bu yaprak satırın geri kalanına basışı ona taşıyor
          (gerekçe RowFlip.tsx → `RowTap`). */}
      <RowTap scope="market-members" />
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
        className={cn("scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)", board.scroller)}
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
            Sonra ölçümü: MembersTable.module.css başında.

            10 Kasım (akşam), sahibinin canlı ekrana itirazı: "yüzdeyi ve
            fiyatı daha gözle seçilebilir şekle alalım". YÜZDE VE FİYAT
            KAHRAMAN. Esnek şerit satırın yarısını (320–541 piksel) tutup
            asıl iki sayıyı 15 piksel ve soluk bırakıyordu. Yeni hiyerarşi:
            günlük değişim satırın en güçlü sayısı (17/700, yön renginde;
            yön İŞARETLE söylenir, ok yok — `formatPercent` zaten +/−
            basıyor, ok ikinci kez söylerdi); fiyat ikinci (15/700, güçlü
            mürekkep); haftalık ve piyasa değeri üçüncü (13–14/600); gün
            aralığı ve pay künye (12, soluk). Şerit YARDIMCI: sayının hemen
            solunda 56 piksel, sabit ölçekli (`Lane`). |%| ≥ 3 olan satırda
            yüzde yön renginin yıkamasında bir hap zemini alır
            (`data-big`): büyük hareket bir bakışta seçilir, öteki satırlar
            zeminsiz kaldığı için renk duvarı olmaz. Sıra: Şirket · Değişim
            · Fiyat · Haftalık · Gün Aralığı · Piyasa Değeri (+Pay) · Katkı.
            Tabular rakam yok (tests/no-tabular-nums.test.ts): hiza sağa
            yaslı sayı ve sabit `ch` genişliğinden.

            10 Kasım (gece), sahibinin aynı akşamki ikinci sözü: "Endeks
            bileşenlerini de çok daha görsel yapalım; gerçek bir designer
            tasarlamış gibi… şirketlerin adı ve logolar az daha büyüyebilir,
            kolay okunabilir." PANO SATIRI. 46 piksellik tek katlı satır
            okunuyordu ama "tablo programı" gibiydi: 28 piksellik logo, 14
            piksellik sembol, soluk ad, 5 piksellik ince kulvarlar. Yoğunluk
            kararı (sabah) geri alınmadı, DENGELENDİ: satır 62 piksel
            (telefonda 56), kimlik yeniden iki katlı ama bu kez iri — logo
            28 → 40, sembol 14 → 16/700, ad soluk 13 → gövde mürekkebi 14.
            Çizimler KALIN (`arayuz.md` → "Büyüklük kalın yatay şeritle
            okunur"): günlük ve haftalık değişim sıfırdan uzanan 8 / 6
            piksellik dolu çubuk, gün aralığı dipten fiyata dolu şerit +
            tek "şimdi" imi (önceki kapanış çentiği ve nokta kalktı). Punto:
            yüzde 17 → 19, fiyat 15 → 16, piyasa değeri 14 → 15. Telefonda
            günlük çubuk sayının ALTINDA (sabah kalkmıştı; iki katlı satırda
            yeri var). Sıra aynı. Parçalar Şirketler tablosuyla ortak:
            components/markets/BoardTable.tsx; ölçüm
            MembersTable.module.css → "ÖLÇÜM 3". */}
        <table className={cn(board.table, styles.table)}>
          <caption className="sr-only">{INDEX_TABS.find((entry) => entry.key === tab)?.label} · {t.markets.constituents}</caption>
          <thead>
            <tr>
              <th scope="col" className={board.rankHead}>#</th>
              <BoardSortHead
                label={t.companies.company}
                href={sortHref(tab, "ad", sort, dir, limit, basePath)}
                active={sort === "ad"}
                dir={dir}
                className={board.companyHead}
              />
              {/* SEKTÖR (10 Kasım akşam). Kulvarlar daralınca Şirket adı ile
                  Değişim arasında, gün aralığının basılmadığı kapalı piyasada
                  1440'ta ~370 piksel boş kaldı (ölçüldü). Boşluk esnetilmez,
                  doldurulur: üyelik listesi her şirketin GICS ana sektörünü
                  zaten taşıyor (db/seed/indices.ts) — Şirketler tablosunun
                  da ikinci sütunu. Yalnız sığdığı yerde basılır (1280+ ve
                  gün aralığı ya da haftalık sütun yokken; CSS), hiçbir
                  üyede sektör yoksa hiç. */}
              {showSector && <th scope="col" className={cn(board.tagHead, styles.sectorHead)}>{t.companies.sector}</th>}
              {/* Değişim fiyattan önce — bkz. /sirketler tablosu. */}
              <BoardSortHead
                label={t.companies.change}
                href={sortHref(tab, "degisim", sort, dir, limit, basePath)}
                active={sort === "degisim"}
                dir={dir}
                className={styles.changeHead}
              />
              <BoardSortHead
                label={`${t.companies.price} ($)`}
                href={sortHref(tab, "fiyat", sort, dir, limit, basePath)}
                active={sort === "fiyat"}
                dir={dir}
                className={styles.priceHead}
              />
              {showWeek && (
                <BoardSortHead
                  label={t.companies.weekChange}
                  href={sortHref(tab, "hafta", sort, dir, limit, basePath)}
                  active={sort === "hafta"}
                  dir={dir}
                  className={styles.weekHead}
                />
              )}
              {showRange && (
                <th scope="col" className={styles.rangeHead}>{t.markets.dayRange}</th>
              )}
              <BoardSortHead
                label={t.market.marketCap}
                href={sortHref(tab, "cap", sort, dir, limit, basePath)}
                active={sort === "cap"}
                dir={dir}
                className={cn(styles.capHead, shareOf && styles.capShared)}
              >
                {shareOf && <span className={styles.shareHead}>{t.markets.capShare}</span>}
              </BoardSortHead>
              {showContribution && (
                <BoardSortHead
                  label={t.markets.contribution}
                  href={sortHref(tab, "katki", sort, dir, limit, basePath)}
                  active={sort === "katki"}
                  dir={dir}
                  className={styles.contributionHead}
                />
              )}
            </tr>
          </thead>
          <tbody data-motion-stagger>
            {sorted.map((row, index) => {
              const quote = row.quote;
              const change = quote?.changePct ?? null;
              const share = shareOf?.(row.marketCap) ?? null;
              const range = rangeOf(quote);
              return (
                <tr
                  key={row.member.symbol}
                  data-row={row.member.symbol}
                  data-fold={index >= PHONE_ROWS || undefined}
                  /* İLK ÜÇ, yalnız değişime göre sıralıyken: günün (ya da
                     haftanın) en çok artan/düşen üçünde sıra numarası güçlü
                     mürekkebe geçer. Süs yok; ada ya da piyasa değerine göre
                     dizili listede "ilk üç" bir haber değil, vurgu da yok. */
                  data-lead={leadSort && index < 3 ? "" : undefined}
                  /* Çizim kapısı satırda: ekranın altındaki satırın
                     kulvarları son karede bekler, satır görününce dolar
                     (`components/motion/DrawGate.tsx`). İlk on satır
                     kademeli (`--i` × `--step`, toplam ≤ 400 ms). */
                  data-draw
                  style={rowStep(index)}
                >
                  {/* SIRA NUMARASI LOGOYLA AYNI HATTA (10 Kasım): hücre tepeye
                      yaslıyken "1" logonun 6 piksel üstünde duruyordu. Satır
                      dikeyde ortalı; sayı sağa yaslı — "9" ile "10" aynı
                      sağ kenarda. */}
                  <td className={cn("numeral", board.rank)}>{index + 1}</td>
                  <CompanyCell symbol={row.member.symbol} name={row.member.name} logoUrl={row.logoUrl} />
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
                      (`--line-strong`); `ScaleBar` öteki ekranlarda aynen.
                      10 Kasım (akşam): esnek şerit geri alındı — sayının
                      solunda 56 piksel, sabit ölçek, sıfır HER ZAMAN ortada
                      (listede eksi olmasa da: sabit ölçekte tek yönlü ray
                      aynı %1'i sekmeden sekmeye başka yere koyardı).
                      Gerekçe yukarıda, "YÜZDE VE FİYAT KAHRAMAN".
                      10 Kasım (gece): çubuk KALIN — 5 piksellik kulvarın
                      üstünde 8 piksellik dolu çubuk (`ZeroBar`); gerekçe
                      yukarıda, "PANO SATIRI". */}
                  {showSector && <td className={cn(board.tag, styles.sector)}>{sectorLabel(row.member.sector, locale) ?? ""}</td>}
                  <td className={styles.changeCell} data-sorted={sort === "degisim" || undefined}>
                    <MoveFigure value={quote ? change : null} span={daySpan} locale={locale} />
                  </td>
                  <td className={cn("numeral", board.price, styles.priceCell, !quote && board.none)} data-sorted={sort === "fiyat" || undefined}>
                    {quote ? formatPrice(quote.price, locale) : NO_VALUE}
                  </td>
                  {showWeek && (
                    <td className={styles.weekCell} data-sorted={sort === "hafta" || undefined}>
                      <MoveFigure value={row.week} weight="week" span={weekSpan} locale={locale} />
                    </td>
                  )}
                  {showRange && (
                    <td className={styles.rangeCell}>
                      {range ? (
                        <RangeFigure low={range.low} high={range.high} price={quote!.price} label={t.markets.dayRange} locale={locale} />
                      ) : (
                        <span className={styles.rangeNone}>{NO_VALUE}</span>
                      )}
                    </td>
                  )}
                  <td className={styles.capCell} data-sorted={sort === "cap" || undefined}>
                    <span className={styles.cap} data-share={shareOf ? "" : undefined}>
                      <span className={cn("numeral", board.strong, !row.marketCap && board.none)}>
                        {row.marketCap ? formatMoneyCompact(row.marketCap, locale) : NO_VALUE}
                      </span>
                      {shareOf && (
                        <span className={cn("numeral", board.quiet)}>
                          {/* Onda birin altı iki ondalıkla: S&P 500'ün küçük
                              üyelerinde pay "%0,0" diye sıfırlanmasın. */}
                          {share !== null ? formatPercentPlain(share, locale, share >= 10 ? 1 : 2) : ""}
                        </span>
                      )}
                    </span>
                  </td>
                  {showContribution && (
                    <td className={cn("numeral", styles.contribution)} data-sorted={sort === "katki" || undefined}>
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
          tek grupta, solda; şerit açılan payı gösteriyor.
          10 Kasım (gece): bant ortak parça (`MoreBand`), şerit kalın. */}
      {hasMore && (
        <MoreBand
          count={t.companies.showing
            .replace("{n}", String(sorted.length))
            .replace("{total}", String(ordered.length))}
          share={shownShare}
          href={moreHref}
          label={t.companies.showMore}
        />
      )}

      {/* KÜNYE (10 Kasım): tablonun kendi söylemediği üç şey tek düz
          paragrafta — şeridin ölçeği (tam boyu yazılı; gece turundan beri
          listenin GERÇEK ölçeği, `laneSpan`), haftalığın tanımı (5 işlem
          günü, takvim haftası değil) ve payın resmî ağırlık OLMADIĞI. Sütun
          yoksa cümlesi de yok; taşan çubuk yoksa kesik cümlesi de. */}
      <p className={board.note}>
        {(showWeek
          ? t.markets.laneScaleNote.replace("{week}", `±${formatPercentPlain(weekSpan, locale, 0)}`)
          : t.markets.laneScaleNote.replace(/,[^,]*\{week\}/, "")
        ).replace("{day}", `±${formatPercentPlain(daySpan, locale, 0)}`)}
        {anyOver && ` ${t.markets.laneOverNote}`}
        {showWeek && ` ${t.markets.weekNote}`}
        {shareOf && ` ${t.markets.capShareNote}`}
      </p>
      {showContribution && (
        <p className={board.note}>{t.markets.contributionHint}</p>
      )}
    </Panel>
  );
}
