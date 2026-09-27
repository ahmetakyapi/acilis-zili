import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { NewsImage } from "@/components/news/NewsImage";
import { NewsFill } from "@/components/today/NewsFill";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { getGenericImageUrls, getLatestNews, getSymbolNames } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
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
      [...items, ...fill].map((item) => item.symbols?.[0]).filter((s): s is string => Boolean(s)),
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

  /* KÜNYE: kaynak · zaman · dil. Zaman Title Case ("1 Saat Önce"): künye
     bir cümle değil (CLAUDE.md, Title Case). Çevirisi olmayan manşet TR
     sayfada İngilizce duruyor; "EN" rozeti bunu tıklamadan önce söylüyor —
     Mercek listesinde aynı kural. */
  const byline = (item: (typeof pool)[number]) => (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-tiny text-muted">
      {locale === "tr" && !item.headlineTr && (
        <span className="plate text-nano">EN</span>
      )}
      <span className="numeral">{titleCaseLabel(timeAgo(item.publishedAt, locale), locale)}</span>
      {item.source && (
        <>
          <span aria-hidden>·</span>
          {item.source}
        </>
      )}
    </span>
  );
  const headlineOf = (item: (typeof pool)[number]) =>
    locale === "tr" && item.headlineTr ? item.headlineTr : item.headline;
  /* ÇEVRİLMEMİŞ SATIR KENDİ DİLİNİ TAŞIR. Çeviri rutini gecikince TR
     sayfada İngilizce manşet duruyor ve `lang` olmadan ekran okuyucu onu
     Türkçe fonemlerle sesletiyor. */
  const langOf = (item: (typeof pool)[number]) =>
    locale === "tr" && !item.headlineTr ? "en" : undefined;

  return (
    /* METİN ÖNCE, GÖRSEL OLDUĞUNDA (24 Eylül). Bant altı tane 16:9 kart
       basıyordu ve görseli olmayan her kart gri bir gazete simgesiyle
       doluyordu: ölçüldüğü gün altı kartın beşi yer tutucuydu, bölüm
       1440'ta 789, 390'da 1926 piksel tutuyordu — telefon sayfasının beşte
       biri gri dikdörtgendi. Görseli olan ilk haber manşet kartı olarak
       solda kalıyor; ötekiler satır: 56 piksellik karo (haberin görseli,
       yoksa şirketin logosu, o da yoksa kaynağın baş harfi), iki satırlık
       manşet ve künye. Hiç görsel yoksa iki sütun, üçer satır.

       DOM'DA MANŞET ÖNCE, EKRANDA KÜNYE ÜSTTE — `flex-col-reverse`
       bağlantının erişilebilir adını manşetle başlatıyor (yoksa ekran
       okuyucu her satırda önce "7 saat önce · Benzinga" diyordu).
       `<ul>/<li>` kalıyor: ekran okuyucu liste bilgisini kaybetmesin. */
    <>
    <ul
      data-news-grid
      className={cn(
        "mt-4 grid min-w-0 gap-x-8",
        lead
          ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
          : /* Görselsiz ve az haberli günde (kaynak sınırı üç haber
               bıraktı) üç satır tek sırada; iki sütunda üçüncüsü tek
               başına kalıyordu. */
            rows.length === 3
            ? "lg:grid-cols-3"
            : "sm:grid-cols-2",
      )}
    >
      {lead && (
        <li data-news-lead className="min-w-0 pb-4 lg:row-span-6 lg:pb-0">
          <Link
            href={`/haberler/${lead.id}`}
            prefetch={false}
            className="panel panel-hover flex h-full min-w-0 flex-col overflow-hidden"
          >
            <NewsImage
              src={lead.imageUrl}
              logoUrl={logoFor(lead)}
              className="w-full rounded-none border-0 border-b border-line-soft"
              sizeClass="aspect-[16/9] h-auto w-full"
            />
            <span className="flex min-w-0 flex-1 flex-col-reverse justify-end gap-2 p-4 sm:p-5">
              <span
                lang={langOf(lead)}
                className="line-clamp-3 text-lead font-semibold leading-[1.35] text-strong sm:text-title"
              >
                {headlineOf(lead)}
              </span>
              {byline(lead)}
            </span>
          </Link>
        </li>
      )}
      {[
        ...rows.map((item) => ({ item, extra: false })),
        ...(lead ? fill.map((item) => ({ item, extra: true })) : []),
      ].map(({ item, extra }, index) => {
        const logo = logoFor(item);
        return (
          <li
            key={item.id}
            /* Yedek satır: tarayıcı sığdığını ölçerse açıyor (NewsFill). */
            hidden={extra || undefined}
            data-news-fill={extra || undefined}
            className={cn(
              "min-w-0 border-t border-line",
              /* Sütunun ilk satırı üstteki kıl çizgiyi taşımıyor: başlık
                 şeridinin çizgisi hemen üstünde. */
              index === 0 && "lg:border-t-0",
              !lead && index === 0 && "border-t-0",
              !lead && index === 1 && (rows.length === 3 ? "lg:border-t-0" : "sm:border-t-0"),
              !lead && rows.length === 3 && index === 2 && "lg:border-t-0",
            )}
          >
            <Link
              href={`/haberler/${item.id}`}
              prefetch={false}
              className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3 rounded-lg py-3 transition-colors hover:bg-primary-tint lg:px-2"
            >
              {hasImage(item) || logo ? (
                <NewsImage
                  src={hasImage(item) ? item.imageUrl : null}
                  logoUrl={logo}
                  className="rounded-lg"
                  sizeClass="size-14"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid size-14 place-items-center rounded-lg bg-surface-sunken text-lead font-bold text-body"
                >
                  {(item.source ?? "?").slice(0, 1).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
                </span>
              )}
              <span className="flex min-w-0 flex-col-reverse justify-end gap-1">
                <span
                  lang={langOf(item)}
                  className="line-clamp-2 text-lead font-semibold leading-[1.35] text-strong"
                >
                  {headlineOf(item)}
                </span>
                {byline(item)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
    {lead && fill.length > 0 && <NewsFill />}
    </>
  );
}

/**
 * Haber bandının iskeleti.
 *
 * ÖLÇÜ GERÇEK BANDIN ŞEKLİ: bir dönem tek bir 16/10 blok basılıyordu ve
 * gerçek kart ondan seksen piksel uzundu — bant çözülünce altındaki her şey
 * aşağı zıplıyordu. Bant artık manşet kartı + satırlar (gerekçe `TopNews`);
 * iskelet de aynı iki parçayı taklit ediyor.
 */
export function NewsGridSkeleton() {
  return (
    <div aria-hidden className="mt-4 grid gap-x-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="panel overflow-hidden lg:row-span-5">
        <Skeleton className="aspect-[16/9] w-full rounded-none" />
        <div className="flex flex-col gap-2 p-4 sm:p-5">
          <Skeleton className="h-2.5 w-2/5 rounded-md" />
          <Skeleton className="h-5 w-full rounded-md" />
          <Skeleton className="h-5 w-4/5 rounded-md" />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-t border-line py-3 first-of-type:border-t-0">
          <Skeleton className="size-14 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-2/5 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-3/5 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
