import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { NewsImage } from "@/components/news/NewsImage";
import { NewsFill } from "@/components/today/NewsFill";
import styles from "./TopNews.module.css";
import { EmptyState, LogoTile, Skeleton } from "@/components/ui/primitives";
import { getGenericImageUrls, getLatestNews, getSymbolNames } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { displayZone, formatInZone, zoneDateKey, zoneTag } from "@/lib/session-clock";
import { cn, headlineMentions, timeAgo, titleCaseLabel } from "@/lib/utils";

/** Kartta gösterilen haber sayısı ve seçkinin tarandığı havuz. */
const TOP_NEWS_COUNT = 6;
/** Kaynak sınırıyla altıya varılamadığında basılan haber sayısı. */
const TOP_NEWS_FALLBACK = 4;
const TOP_NEWS_POOL = 40;
/** Aynı sembolden listeye en fazla kaç haber girer. */
const TOP_NEWS_PER_SYMBOL = 2;
/**
 * Aynı KAYNAKTAN listeye en fazla kaç haber girer.
 *
 * Sembol sınırı vardı, kaynak sınırı yoktu. Seçim görseli olan haberleri öne
 * aldığı için (Yahoo yer tutucu logo yolluyor, elenmesi gereken oydu) liste
 * pratikte tek bir siteye kayabiliyor: ölçüldüğü gün altı kartın altısı da
 * SeekingAlpha'ydı. Satır listesinde bu görünmüyordu, üç kolonluk görselli
 * ızgarada "öne çıkan haberler" tek bir yayının bülteni gibi duruyor.
 */
const TOP_NEWS_PER_SOURCE = 2;
/** Manşet kartının yanını doldurmak için basılan en fazla yedek satır. */
const TOP_NEWS_FILL_MAX = 6;
/** Yedeklerin tarandığı havuz. Yedek, listedeki en eski satırdan daha eski
 *  olmak zorunda; 40'lık havuzun çoğu o satırdan yeni kalıyordu ve 1440'ta
 *  tek aday çıkıyordu (158 piksel boşluk, ölçüldü). */
export const TOP_NEWS_FILL_POOL = 80;
/** UTF-8'in Latin-1 (ya da cp1252) diye okunmuş izi: "â€™", "â\u0080\u0099", "Ã©". */
const MOJIBAKE = /\u00e2[\u0080-\u00bf\u20ac]|\u00c3[\u0080-\u00bf]/;
/** Manşetin künyesinde en fazla kaç şirket çipi durur. */
const LEAD_CHIPS = 3;

export async function TopNews({ locale, t }: { locale: Locale; t: Dictionary }) {
  // Bu kart "son haberler" değil "öne çıkanlar": son 40 haberlik havuzdan
  // seçim yapılıyor. Sağlayıcının genel akışı Yahoo ağırlıklı ve Yahoo her
  // habere aynı yer tutucu logoyu iliştiriyor; kendi görseli olan haberler
  // (şirket beslemesinden gelenler) öne alınıyor. Sıralama yine tarihe göre,
  // yalnızca hangi altı haberin seçildiği değişiyor.
  const wide = await getLatestNews(TOP_NEWS_FILL_POOL);
  const pool = wide.slice(0, TOP_NEWS_POOL);

  if (pool.length === 0) {
    return <EmptyState title={t.news.empty} />;
  }

  /* Yer tutucu görseller GENİŞ havuz üzerinden: yedekler de oradan geliyor
     ve bir Yahoo yer tutucusu gerçek görselmiş gibi karoya basılırdı. */
  const genericImages = await getGenericImageUrls(
    wide.map((item) => item.imageUrl),
  );
  const hasImage = (item: (typeof pool)[number]) =>
    Boolean(item.imageUrl) && !genericImages.has(item.imageUrl as string);

  /* TEK ŞİRKET LİSTEYİ ELE GEÇİRMESİN. Günlük senkron en büyük şirketlerin
     haber uçlarını tek tek geziyor; hareketli bir günde tek sembol havuzun
     dörtte birini doldurabiliyor (bir gün 40 haberin 12'si MU'ydu) ve
     "Öne Çıkan Haberler" tek şirketin bülteni gibi görünüyordu. Sembol
     başına en fazla iki haber alınır, kalanlar sıradakine yer açar. */
  const capped = (list: typeof pool) => {
    const bySymbol = new Map<string, number>();
    const bySource = new Map<string, number>();
    const kept: typeof pool = [];
    for (const item of list) {
      const symbol = item.symbols?.[0] ?? "";
      const source = item.source ?? "";
      if (symbol && (bySymbol.get(symbol) ?? 0) >= TOP_NEWS_PER_SYMBOL) continue;
      if (source && (bySource.get(source) ?? 0) >= TOP_NEWS_PER_SOURCE) continue;
      bySymbol.set(symbol, (bySymbol.get(symbol) ?? 0) + 1);
      bySource.set(source, (bySource.get(source) ?? 0) + 1);
      kept.push(item);
    }
    return kept;
  };

  /* YEDEK DOLDURMA KAYNAK SINIRINI BOZMUYOR (24 Eylül). Sınırlar altı
     haber bırakmadığında liste sınırsız havuzdan tamamlanıyordu ve kaynak
     sınırı (2) tam o yolla deliniyordu: ölçüldüğü gün altı kartın beşi
     Yahoo'ydu. Yedek geçiş artık yalnızca SEMBOL sınırını gevşetiyor;
     kaynak sınırı her geçişte geçerli. Yine altıya varılamıyorsa dört
     haber basılıyor — tek bir sitenin beş haberi, "öne çıkanlar" değil. */
  const withImage = pool.filter(hasImage);
  const withoutImage = pool.filter((item) => !hasImage(item));
  const ranked = [...withImage, ...withoutImage];
  const ordered = capped(ranked);
  const bySource = new Map<string, number>();
  for (const item of ordered) bySource.set(item.source ?? "", (bySource.get(item.source ?? "") ?? 0) + 1);
  for (const item of ranked) {
    if (ordered.length >= TOP_NEWS_COUNT) break;
    if (ordered.includes(item)) continue;
    const source = item.source ?? "";
    if (source && (bySource.get(source) ?? 0) >= TOP_NEWS_PER_SOURCE) continue;
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
    ordered.push(item);
  }
  const shownCount = ordered.length >= TOP_NEWS_COUNT ? TOP_NEWS_COUNT : Math.min(ordered.length, TOP_NEWS_FALLBACK);
  const items = ordered
    .slice(0, shownCount)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  /* YEDEK SATIRLAR — MANŞETİN YANI BOŞ KALMASIN (26 Eylül). Kaynak sınırı
     havuzu çoğu gün dört habere indiriyor (havuz ağırlıkla iki siteden) ve
     manşet kartının yanında üç satır kalıyordu: kart ~500, satırlar ~265
     piksel, arada bir kart boyu boşluk (ekran görüntüsüyle bildirildi).
     Havuzdan en yeni haberler yedek olarak `hidden` basılıyor; tarayıcı
     manşetin boyuna SIĞAN kadarını açıyor (NewsFill). Yedeklerde kaynak
     sınırı YOK — bu satırlar seçkinin kendisi değil devamı, ve sınır
     korunursa boşluk dolmuyordu — ama sembol sınırı ve aynı manşetin iki
     kez girmemesi geçerli.

     YALNIZCA LİSTEDEKİ EN ESKİ SATIRDAN DAHA ESKİ HABERLER. İlk hâlde
     yedekler havuzun en yenilerinden seçiliyordu ve "13 Saat Önce"nin
     altına "6 Saat Önce" iniyordu; künye zamanı yazdığı için sıra bozuk
     okunuyordu. Şimdi liste doğal olarak geriye doğru devam ediyor ve
     sona eklemek kronolojiyi bozmuyor, hiçbir satır kaymıyor. Yedekler
     arasında şirket başına TEK haber: ilk denemede son iki satır da
     Apple'dı. */
  const leadCandidate = items.find(hasImage) ?? null;
  const baseRows = items.filter((item) => item !== leadCandidate);
  const oldestShown = Math.min(...(baseRows.length ? baseRows : items).map((item) => item.publishedAt.getTime()));
  const fillSymbols = new Set<string>();
  const shownIds = new Set(items.map((item) => item.id));
  const seenHeadlines = new Set(items.map((item) => item.headline.trim().toLocaleLowerCase("en-US")));
  const fillBySymbol = new Map<string, number>();
  for (const item of items) {
    const symbol = item.symbols?.[0] ?? "";
    if (symbol) fillBySymbol.set(symbol, (fillBySymbol.get(symbol) ?? 0) + 1);
  }
  const fill: typeof pool = [];
  for (const item of [...wide].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())) {
    if (fill.length >= TOP_NEWS_FILL_MAX) break;
    if (shownIds.has(item.id)) continue;
    if (item.publishedAt.getTime() >= oldestShown) continue;
    const headline = item.headline.trim().toLocaleLowerCase("en-US");
    if (seenHeadlines.has(headline)) continue;
    const symbol = item.symbols?.[0] ?? "";
    if (symbol && (fillSymbols.has(symbol) || (fillBySymbol.get(symbol) ?? 0) >= TOP_NEWS_PER_SYMBOL)) continue;
    if (symbol) {
      fillSymbols.add(symbol);
      fillBySymbol.set(symbol, (fillBySymbol.get(symbol) ?? 0) + 1);
    }
    seenHeadlines.add(headline);
    fill.push(item);
  }

  /* Görseli olmayan haber, künye kutusunda sembol yazan gri bir kutuyla
     duruyordu. Sıradaki en iyi görsel şirketin kendi logosu: haberin konusunu
     gösteriyor ve zaten elimizde. */
  const logos = await getSymbolNames([
    ...new Set(
      [
        ...[...items, ...fill].map((item) => item.symbols?.[0]),
        /* Manşetin künyesindeki şirket çipleri: ilk üç sembolün hepsi. */
        ...(leadCandidate?.symbols ?? []).slice(0, LEAD_CHIPS),
      ].filter((s): s is string => Boolean(s)),
    ),
  ]);

  /* Logo, haber gerçekten o şirketle ilgiliyse konur — `symbols` alanı
     haberin konusunu değil, çekildiği beslemeyi söyleyebiliyor. */
  const logoFor = (item: (typeof pool)[number]) => {
    const symbol = item.symbols?.[0];
    if (!symbol) return null;
    const meta = logos[symbol];
    if (!meta?.logoUrl) return null;
    return headlineMentions(item.headline, symbol, meta.name) ? meta.logoUrl : null;
  };

  /* Manşet kartı: görseli olan İLK haber. Görselsiz haber 16:9'luk bir kart
     değil, bir satır. */
  const lead = items.find(hasImage) ?? null;
  const rows = items.filter((item) => item !== lead);

  /* KÜNYE: kaynak · zaman · dil (28 Eylül'de yeniden kuruldu).

     SAAT OKUYUCUNUN SAATİ. Satırlar yalnızca "3 Saat Önce" yazıyordu ve
     okuyucu haberin seansın neresine düştüğünü (açılıştan önce mi, sonra
     mı) hesaplamak zorundaydı. Artık her satırın solunda birincil saat
     dilimiyle saat var (TR'de İstanbul, künyesiz; EN'de New York, "NY"
     künyeli, DataStamp ile aynı kural), altında göreli zaman. Haber
     okuyucunun bugününe ait değilse göreli zamanın yerinde tarih duruyor:
     dünkü 22:10, bugünkü 22:10 gibi okunmasın.

     Göreli zaman Title Case ("1 Saat Önce"): künye bir cümle değil
     (CLAUDE.md). Çevirisi olmayan manşet TR sayfada İngilizce duruyor; "EN"
     rozeti bunu tıklamadan önce söylüyor — Mercek listesinde aynı kural. */
  const zone = displayZone(locale);
  const todayKey = zoneDateKey(new Date(), zone);
  const dayFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: zone, day: "numeric", month: "short",
  });
  const clockOf = (item: (typeof pool)[number]) => formatInZone(item.publishedAt, zone);
  const whenOf = (item: (typeof pool)[number]) =>
    zoneDateKey(item.publishedAt, zone) === todayKey
      ? titleCaseLabel(timeAgo(item.publishedAt, locale), locale)
      : dayFormat.format(item.publishedAt);
  const zoneMark = locale === "tr" ? null : zoneTag(locale).primary;
  const enBadge = (item: (typeof pool)[number]) =>
    locale === "tr" && !item.headlineTr ? <span className="plate text-nano">EN</span> : null;

  const headlineOf = (item: (typeof pool)[number]) =>
    locale === "tr" && item.headlineTr ? item.headlineTr : item.headline;
  /* Manşetin özeti: başlıkla AYNI dilde. Türkçe başlığın altına İngilizce
     özet konmuyor; başlık çevrilmemişse özet de orijinal dilinde kalıyor. */
  const summaryOf = (item: (typeof pool)[number]) => {
    const summary = locale === "tr" ? (item.headlineTr ? item.summaryTr : item.summary) : item.summary;
    /* Bozuk kodlanmış özet basılmıyor: bazı beslemeler UTF-8'i Latin-1
       diye okuyup yolluyor ve özet "Nike's" yerine "Nikeâ s" gibi geliyordu (28 Eylül,
       ekranda görüldü). Başlık bu hatayı taşımıyor; özet isteğe bağlı. */
    return summary && !MOJIBAKE.test(summary) ? summary : null;
  };
  /* ÇEVRİLMEMİŞ SATIR KENDİ DİLİNİ TAŞIR. Çeviri rutini gecikince TR
     sayfada İngilizce manşet duruyor ve `lang` olmadan ekran okuyucu onu
     Türkçe fonemlerle sesletiyor. */
  const langOf = (item: (typeof pool)[number]) =>
    locale === "tr" && !item.headlineTr ? "en" : undefined;

  /* MANŞETİN ŞİRKETLERİ. Satırlarda şirket logonun kendisi; manşette en
     fazla üç şirket logo ve sembolüyle künyede. Yalnızca BAŞLIKTA geçen
     şirket: `symbols` alanı bazen haberin konusunu değil çekildiği
     beslemeyi söylüyor (logoFor ile aynı kural). */
  const chipsOf = (item: (typeof pool)[number]) =>
    (item.symbols ?? []).slice(0, LEAD_CHIPS).filter((symbol) => {
      const meta = logos[symbol];
      return meta ? headlineMentions(item.headline, symbol, meta.name) : false;
    });

  const extras = lead ? fill : [];
  const leadSummary = lead ? summaryOf(lead) : null;
  const leadChips = lead ? chipsOf(lead) : [];

  return (
    /* MANŞET VE AKIŞ (28 Eylül). Bant solda kutulu bir manşet kartı, sağda
       künyesi başlığın üstünde duran satırlardı; sahibi "daha iyi hâle
       getirelim" dedi. Üç değişiklik:

       1. MANŞET KUTUSUZ. Görsel kutunun kendisi (CLAUDE.md "Görselin
          etrafında çerçeve yok"); başlık, özet ve künye onun altında,
          sayfanın zemininde. Kart çerçevesi ile görselin kendi köşesi iç
          içe iki kutu gibi okunuyordu. Başlık bir kademe büyüdü ve
          haberin özeti (varsa, başlıkla aynı dilde) iki satır olarak geldi.
       2. SAĞDA ZAMAN AKIŞI. Her satırın solunda okuyucunun saati, bir kıl
          çizgiyle ayrılmış bir sütunda; satırlar bir haber ajansı akışı
          gibi yukarıdan aşağı zamanla okunuyor. Göreli zaman saatin altında.
       3. HAREKET. Satırlar sırayla iniyor (`data-motion-stagger`), görsel
          üzerine gelince hafifçe yakınlaşıyor, satırın oku kayıyor. Hepsi
          azaltılmış harekette kapalı.

       İKİ AYRI SÜTUN, ORTAK IZGARA SATIRLARI DEĞİL. Manşet eskiden satır
       ızgarasında altı satırı kapsıyordu ve kendi boyu satırların
       toplamından uzunsa ızgara farkı SATIRLARA dağıtıyordu: dört satırlık
       bir günde her satır 80 yerine 118 piksele gerildi, künye satırın
       dibine kaçtı (1280'de ölçüldü). Şimdi manşet ve liste iki bağımsız
       sütun; liste yedek satırlarla manşetin doğal dibine kadar doluyor
       (NewsFill), dolmayan kısım listenin altında kalıyor.

       DOM'DA MANŞET ÖNCE, EKRANDA KÜNYE VE SAAT ÖNDE — ızgara alanlarıyla;
       bağlantının erişilebilir adı başlıkla başlıyor. Satırlar `<ul>/<li>`:
       ekran okuyucu liste bilgisini kaybetmesin. */
    <>
    <div data-news-grid className={cn(styles.grid, lead ? styles.withLead : undefined)}>
      {lead && (
        <div data-news-lead data-motion-reveal className={styles.leadItem}>
          <Link href={`/haberler/${lead.id}`} prefetch={false} className={styles.lead}>
            <span lang={langOf(lead)} className={styles.leadHeadline}>
              {headlineOf(lead)}
            </span>
            {leadSummary && (
              <span lang={langOf(lead)} className={styles.leadSummary}>
                {leadSummary}
              </span>
            )}
            <span className={styles.leadMeta}>
              {enBadge(lead)}
              {leadChips.map((symbol) => (
                <span key={symbol} className={styles.chip}>
                  <LogoTile symbol={symbol} logoUrl={logos[symbol]?.logoUrl} size="xs" />
                  {symbol}
                </span>
              ))}
              {lead.source && <span className={styles.leadSource}>{lead.source}</span>}
              <span className="numeral">
                {clockOf(lead)}
                {zoneMark && ` ${zoneMark}`}
              </span>
              <span aria-hidden>·</span>
              <span className="numeral">{whenOf(lead)}</span>
            </span>
            <NewsImage
              src={lead.imageUrl}
              logoUrl={logoFor(lead)}
              className={styles.leadImage}
              sizeClass="aspect-[16/9] h-auto w-full"
            />
          </Link>
        </div>
      )}
      <ul
        data-news-list
        data-motion-stagger
        className={cn(styles.list, !lead && (rows.length === 3 ? styles.three : styles.pair))}
      >
      {[
        ...rows.map((item) => ({ item, extra: false })),
        ...extras.map((item) => ({ item, extra: true })),
      ].map(({ item, extra }) => {
        const logo = logoFor(item);
        return (
          <li
            key={item.id}
            /* Yedek satır: tarayıcı sığdığını ölçerse açıyor (NewsFill). */
            hidden={extra || undefined}
            data-news-fill={extra || undefined}
            className={styles.rowItem}
          >
            <Link href={`/haberler/${item.id}`} prefetch={false} className={styles.row}>
              <span lang={langOf(item)} className={styles.rowHeadline}>
                {headlineOf(item)}
              </span>
              <span className={styles.rowByline}>
                {enBadge(item)}
                {item.source && <span>{item.source}</span>}
              </span>
              <span className={styles.rowTime}>
                <time dateTime={item.publishedAt.toISOString()} className="numeral">
                  {clockOf(item)}
                  {zoneMark && <small> {zoneMark}</small>}
                </time>
                <span className="numeral">{whenOf(item)}</span>
              </span>
              {hasImage(item) || logo ? (
                <NewsImage
                  src={hasImage(item) ? item.imageUrl : null}
                  logoUrl={logo}
                  className={styles.thumb}
                  sizeClass="size-12"
                />
              ) : (
                <span aria-hidden className={cn(styles.thumb, styles.initial)}>
                  {(item.source ?? "?").slice(0, 1).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
                </span>
              )}
            </Link>
          </li>
        );
      })}
      </ul>
    </div>
    {lead && fill.length > 0 && <NewsFill />}
    </>
  );
}

/**
 * Haber bandının iskeleti.
 *
 * ÖLÇÜ GERÇEK BANDIN ŞEKLİ: bir dönem tek bir 16/10 blok basılıyordu ve
 * gerçek kart ondan seksen piksel uzundu — bant çözülünce altındaki her şey
 * aşağı zıplıyordu. Bant manşet + satırlar (gerekçe `TopNews`); iskelet
 * aynı sınıflarla aynı iki parçayı basıyor: görsel 16:9, başlık üç, özet
 * iki satır; satırlar saat sütunu, karo ve iki satır başlıkla.
 */
export function NewsGridSkeleton() {
  return (
    <div aria-hidden className={cn(styles.grid, styles.withLead)}>
      <div className={styles.leadItem}>
        <div className={styles.lead}>
          <div className={styles.leadMeta}>
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
          <Skeleton className="h-6 w-full rounded-md" />
          <Skeleton className="h-6 w-4/5 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className={cn(styles.leadImage, "aspect-[16/9] w-full")} />
        </div>
      </div>
      <div className={styles.list}>
      {Array.from({ length: NEWS_SKELETON_ROWS }).map((_, i) => (
        <div key={i} className={styles.rowItem}>
          <div className={styles.row}>
            <span className={styles.rowTime}>
              <Skeleton className="h-3.5 w-10 rounded-md" />
              <Skeleton className="h-2.5 w-12 rounded-md" />
            </span>
            <Skeleton className={cn(styles.thumb, "size-12")} />
            <span className={styles.rowHeadline}>
              <Skeleton className="mb-1.5 h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-3/5 rounded-md" />
            </span>
            <span className={styles.rowByline}>
              <Skeleton className="h-2.5 w-16 rounded-md" />
            </span>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

/** İskeletteki satır sayısı — en sık görülen günün hâli (manşet + beş). */
const NEWS_SKELETON_ROWS = 5;
