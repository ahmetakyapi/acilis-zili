import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { inArray } from "drizzle-orm";
import styles from "../stock.module.css";
import { NewsImage } from "@/components/news/NewsImage";
import { EmptyState } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { news } from "@/lib/schema";
import { getGenericImageUrls, getSymbolNames } from "@/lib/data";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { getCompanyNews } from "@/lib/providers/finnhub";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { isTranslateConfigured, translateNewsByIds } from "@/lib/translate";
import { headlineMentions, safeExternalUrl, timeAgo, titleCaseLabel } from "@/lib/utils";

export async function CompanyNews({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const to = todayEt();
  const from = addEtDays(to, -14);
  const result = await getCompanyNews(symbol, from, to);

  /* Sağlayıcı hatası "haber yok" DEĞİLDİR — ikisi aynı daldaydı ve uç
     düştüğünde ekranda "Şu an gösterilecek haber yok." yazıyordu. Aynı
     düzeltmenin emsali components/markets/IpoCalendar.tsx'te. */
  if (!result.ok) {
    return <EmptyState title={t.common.noData} hint={t.common.noDataHint} />;
  }

  if (result.data.length === 0) {
    return <EmptyState title={t.news.empty} />;
  }

  /* KONUDAKİ HABER ÖNCE (24 Eylül). Şirketin beslemesi ara ara genel piyasa
     yazıları da döndürüyor ve bunlar yalnızca tarihleri yeni diye listenin
     başına geçiyordu; NVDA'da ilk iki satırın ikisi de NVIDIA'dan söz
     etmiyordu. Başlıkta şirketi anan haberler kararlı bir sıralamayla öne
     alınıyor, kendi aralarındaki tarih sırası korunuyor. Telefonda ilk dört
     satır gösteriliyor (stock.module.css), gerisi "Tümünü Gör"de. */
  const meta = await getSymbolNames([symbol]);
  const companyName = meta[symbol]?.name;
  const shown = [...result.data]
    .map((item, index) => ({ item, index, on: headlineMentions(item.headline, symbol, companyName) }))
    .sort((a, b) => Number(b.on) - Number(a.on) || a.index - b.index)
    .slice(0, 8)
    .map((entry) => entry.item);

  /* Haber önce SİTE İÇİNDE okunur; kaynak bağlantısı detay sayfasındadır.
     Şirket haberleri canlı uçtan gelir ve genel akış tablosunda olmayabilir —
     görüntülendiği anda tabloya işlenir, bağlantı kalıcı id ile kurulur. */
  let idByProvider = new Map<string, string>();
  /* Şirket haberleri canlı uçtan İngilizce geliyor; günlük senkron ise
     tabloya Türkçe başlığı yazıyor. Aynı okumada çeviriyi de alıp varsa onu
     gösteriyoruz — yoksa liste, akış sayfasında Türkçe olan bir haberi
     burada İngilizce göstermeye devam ederdi. */
  let trByProvider = new Map<string, string>();
  /* ÖNCE OKU, YALNIZ EKSİĞİ YAZ (20 Ekim). Her görüntüleme sekiz satırı
     `on conflict do nothing` ile yeniden yazıyor, sonra okuyor, en sonda
     jenerik görselleri sayıyordu — günün ilk ziyaretinden sonra hiçbir şey
     değiştirmeyen bir yazma ve üç SIRALI Neon turu. Artık okuma ile sayım
     aynı turda; yazma yalnız tabloda olmayan haber varken. Yazma `after()`a
     ertelenmedi: yeni haberin kalıcı id'si bu çizimin bağlantısı ve
     çevirisi için gerekiyor, sayım da yeni satırları görmeli (iki yeni
     haber aynı kaynak logosunu taşıyorsa logo ancak yazmadan sonra
     jenerik sayılıyor) — o yüzden yazma olunca sayım yeniden yapılıyor.
     `getGenericImageUrls` hatayı kendisi yutuyor; erken başlatmak güvenli. */
  const providerIds = shown.map((item) => item.providerId);
  const imageUrls = shown.map((item) => item.imageUrl);
  let genericImagesP = getGenericImageUrls(imageUrls);
  try {
    const readRows = () =>
      db
        .select({
          id: news.id,
          providerId: news.providerId,
          headlineTr: news.headlineTr,
        })
        .from(news)
        .where(inArray(news.providerId, providerIds));
    let rows = await readRows();
    const stored = new Set(rows.map((row) => row.providerId));
    const fresh = shown.filter((item) => !stored.has(item.providerId));
    if (fresh.length > 0) {
      await db
        .insert(news)
        .values(
          fresh.map((item) => ({
            providerId: item.providerId,
            headline: item.headline,
            summary: item.summary,
            url: item.url,
            imageUrl: item.imageUrl,
            source: item.source,
            category: item.category,
            symbols: item.symbols,
            publishedAt: item.publishedAt,
          })),
        )
        .onConflictDoNothing();
      genericImagesP = getGenericImageUrls(imageUrls);
      rows = await readRows();
    }
    idByProvider = new Map(rows.map((row) => [row.providerId, row.id]));
    trByProvider = new Map(
      rows
        .filter((row) => row.headlineTr)
        .map((row) => [row.providerId, row.headlineTr as string]),
    );
    /* ÇEVİRİSİ EKSİK BAŞLIK O AN ÇEVRİLİR (18 Ekim, sahibinin isteği).
       Türkçe arayüzde eksikler tek çağrıda çevrilip tabloya yazılıyor;
       panel en çok 4 saniye bekler, yetişmeyen çeviri arka planda biter ve
       sonraki açılışta görünür. Aynı haber ikinci kez ücretlenmez. */
    const missing = shown
      .filter((item) => !trByProvider.has(item.providerId))
      .map((item) => idByProvider.get(item.providerId))
      .filter((id): id is string => Boolean(id));
    if (locale === "tr" && missing.length > 0 && isTranslateConfigured()) {
      const job = translateNewsByIds(missing).catch(() => new Map<string, string>());
      const done = await Promise.race([job, new Promise<Map<string, string>>((resolve) => setTimeout(() => resolve(new Map()), 4000))]);
      for (const [providerId, id] of idByProvider) {
        const tr = done.get(id);
        if (tr) trByProvider.set(providerId, tr);
      }
    }
  } catch {
    // DB yazılamazsa haberler kaynağa bağlanır — liste yine çalışır.
  }

  /* Küçük resim burada da var artık: haber akışı ve ana sayfa listesi
     gösteriyordu, şirket sayfası göstermiyordu ve aynı haber iki ekranda
     farklı görünüyordu. Jenerik görseller (kaynak logosu) elenir — aynı
     logonun sekiz satırda tekrar etmesi listeyi taranabilir yapmıyor,
     bozuyor. */
  // Görseli olmayan haber şirketin logosunu alır — bu listede hepsi aynı
  // şirketin haberi, o yüzden tek sembol yetiyor (`meta` yukarıda).
  // Sayım yukarıda, tablo okumasıyla aynı turda başladı.
  const genericImages = await genericImagesP;
  const logoUrl = meta[symbol]?.logoUrl ?? null;

  return (
    <ul className={styles.newsGrid}>
      {shown.map((item) => {
        const newsId = idByProvider.get(item.providerId);
        const image =
          item.imageUrl && !genericImages.has(item.imageUrl) ? item.imageUrl : null;
        /* Bu liste şirketin kendi beslemesinden geliyor ama besleme ara ara
           genel piyasa yazıları da döndürüyor; logo yalnızca başlıkta şirket
           geçiyorsa konur. */
        const mentionLogo = headlineMentions(item.headline, symbol, companyName)
          ? logoUrl
          : null;
        const inner = (
          <span className={styles.newsInner}>
            <span className="min-w-0 flex-1">
              {/* ÇEVİRİSİ OLMAYAN BAŞLIK DİLİNİ SÖYLER. Türkçe arayüzde
                  çeviri yoksa sağlayıcının İngilizce başlığına düşülüyor ama
                  metin `<html lang="tr">` altında kalıyordu: ekran okuyucu
                  İngilizce cümleyi Türkçe sesletim kurallarıyla okuyor.
                  Kural üç ekranda uygulanmış (`/haberler`, haber detayı ve
                  oradaki ilgili haberler listesi), bu panel atlanmış. */}
              <span
                lang={
                  locale === "tr" && !trByProvider.get(item.providerId)
                    ? "en"
                    : undefined
                }
                className="line-clamp-2 block text-sm font-medium leading-snug text-strong"
              >
                {(locale === "tr" && trByProvider.get(item.providerId)) ||
                  item.headline}
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-tiny text-muted">
                {item.source && <span>{item.source}</span>}
                <span aria-hidden>·</span>
                <span>{titleCaseLabel(timeAgo(item.publishedAt, locale), locale)}</span>
              </span>
            </span>
            {/* GÖRSEL DE LOGO DA YOKSA KUTU DA YOK. Boş gri bir kare
                başlığın yanında 84 piksel tutuyordu ve bir şey yüklenmeyi
                bekliyormuş gibi duruyordu; başlık artık o yeri kullanıyor. */}
            {(image || mentionLogo) && (
              <NewsImage src={image} logoUrl={mentionLogo} sizeClass={styles.newsImage} />
            )}
          </span>
        );
        // Kaynak adresi sağlayıcıdan; şeması süzülmezse href'e konmaz.
        const sourceHref = safeExternalUrl(item.url);
        return (
          <li key={item.providerId}>
            {newsId ? (
              <Link
                href={`/haberler/${newsId}`}
                className={styles.newsLink}
              >
                {inner}
              </Link>
            ) : sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.newsLink}
              >
                {inner}
              </a>
            ) : (
              <div className={styles.newsLink}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
