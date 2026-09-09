import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/news/NewsExperience.module.css";
import { Suspense } from "react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { NewsImage } from "@/components/news/NewsImage";
import {
  getGenericImageUrls,
  getLatestNews,
  getNewsForSymbol,
  getSymbolNames,
} from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { cn, headlineMentions, timeAgo } from "@/lib/utils";

import { pageMetadata } from "@/lib/page-meta";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const generateMetadata = pageMetadata({
  path: "/haberler",
  tr: {
    title: "Haberler",
    description:
      "ABD piyasalarından haberler — Türkçe künyeleriyle.",
  },
  en: {
    title: "News",
    description:
      "Headlines from US markets, with their sources.",
  },
});

/**
 * SAYFA İKİ PARÇAYA BÖLÜNDÜ. Başlık ve süzgeç şeridi hemen akıyor, haber
 * listesi kendi `Suspense` sınırının içinde bekliyor.
 *
 * Eskiden sayfanın tamamı tek bir `await` zincirinin arkasındaydı ve rota
 * yükleme iskeleti (`app/(app)/loading.tsx`) jenerik olduğu için gezinme
 * sırasında ekranda sayfanın onda biri kadar bir taslak görünüyor, veri
 * gelince düzen zıplıyordu. Şimdi sınır listeye özel bir iskelet gösteriyor:
 * satır sayısı ve yükseklikler gerçek listeyle aynı, yani yer değişmiyor.
 */
export default async function NewsPage(props: PageProps<"/haberler">) {
  const search = await props.searchParams;
  const symbolFilter =
    typeof search.sembol === "string" ? search.sembol.toUpperCase() : null;

  const { t } = await getI18n();
  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <PageHeader title={t.news.title} subtitle={t.news.subtitle} />

      {symbolFilter && (
        <div className="flex items-center gap-2">
          <span className="numeral rounded-full bg-primary-wash px-3 py-1 text-sm font-medium text-primary-ink">
            {symbolFilter}
          </span>
          <Link href="/haberler" className="text-xs text-muted hover:text-soft">
            {t.common.all}
          </Link>
        </div>
      )}

      <Suspense fallback={<NewsSkeleton />}>
        <NewsList symbolFilter={symbolFilter} />
      </Suspense>
    </MotionExperience>
  );
}

/** Liste iskeleti — gerçek satırla aynı yükseklik, düzen zıplamasın. */
function NewsSkeleton() {
  return (
    <div>
      <ul className={styles.list}>
        {Array.from({ length: 8 }).map((_, index) => (
          <li key={index} className={styles.row}>
            <span className="min-w-0 flex-1">
              <span className="skeleton block h-4 w-[85%] rounded-md" />
              <span className="skeleton mt-2 block h-3 w-[60%] rounded-md" />
              <span className="skeleton mt-2.5 block h-3 w-32 rounded-md" />
            </span>
            <span className="skeleton size-14 shrink-0 rounded-lg" />
          </li>
        ))}
      </ul>
    </div>
  );
}

async function NewsList({ symbolFilter }: { symbolFilter: string | null }) {
  const { locale, t } = await getI18n();

  /* Sembol süzgeci VERİTABANINDA. Bir dönem en yeni 60 haber çekilip bellekte
     süzülüyordu ve sembol o pencerede geçmiyorsa sayfa "haber yok" diyordu —
     tabloda dünden kalan haberler dururken. Gerekçenin tamamı
     `getNewsForSymbol` yorumunda. */
  const items = symbolFilter
    ? await getNewsForSymbol(symbolFilter, 60)
    : await getLatestNews(60);

  /* Kaynak logoları elenir; kalan makale görselleri küçük resim olarak durur.
     Görseli olmayan habere şirketin logosu konuyor — künye kutusunda sembol
     yazmaktansa haberin konusu olan şirketi göstermek listeyi taranabilir
     kılıyor. */
  const [genericImages, logos] = await Promise.all([
    getGenericImageUrls(items.map((item) => item.imageUrl)),
    getSymbolNames([
      ...new Set(
        items.flatMap((item) => item.symbols ?? []),
      ),
    ]),
  ]);

  return (
      <div>
        {items.length === 0 ? (
          <EmptyState title={t.news.empty} />
        ) : (
          <ul className={styles.list} data-motion-stagger>
            {items.map((item) => {
              // Feed membership alone is not a company mention. Apply the
              // same textual subject check already used for company logos.
              const shownSymbols = (item.symbols ?? []).filter((symbol) => headlineMentions(`${item.headline} ${item.summary ?? ""}`, symbol, logos[symbol]?.name));
              const symbol = item.symbols?.[0];
              const company = symbol ? logos[symbol] : null;
              const hasVisual = Boolean((item.imageUrl && !genericImages.has(item.imageUrl)) || (company?.logoUrl && symbol && headlineMentions(item.headline, symbol, company.name)));
              return <li key={item.id}>
                <Link
                  href={`/haberler/${item.id}`}
                  prefetch={false}
                  className={styles.row}
                >
                  <div className={styles.copy}>
                  {/* ÇEVRİLMEMİŞ SATIR KENDİ DİLİNİ TAŞIR. Türkçe sayfada
                      çevirisi henüz gelmemiş haber orijinal İngilizce
                      başlığıyla görünüyor (çeviri cron'da ve sağlayıcı
                      anahtarı yoksa atlanıyor — lib/translate.ts). `lang`
                      olmadan ekran okuyucu İngilizce cümleyi Türkçe
                      sesletmeye çalışıyordu. Mercek yazılarında aynı kural
                      zaten uygulanıyor. */}
                  <h2
                    lang={locale === "tr" && !item.headlineTr ? "en" : undefined}
                    className={styles.title}
                  >
                    {locale === "tr" && item.headlineTr ? item.headlineTr : item.headline}
                  </h2>
                  {(item.summaryTr || item.summary) && (
                    <p
                      lang={locale === "tr" && !item.summaryTr ? "en" : undefined}
                      className={styles.summary}
                    >
                      {locale === "tr" && item.summaryTr ? item.summaryTr : item.summary}
                    </p>
                  )}
                  <p className={styles.meta}>
                    {item.source && <span>{item.source}</span>}
                    <span aria-hidden>·</span>
                    <span>{timeAgo(item.publishedAt, locale)}</span>
                    {shownSymbols.length > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="flex gap-1">
                          {shownSymbols.slice(0, 4).map((symbol) => (
                            <span
                              key={symbol}
                              className={cn(
                                "numeral rounded bg-surface-sunken px-1.5 py-0.5 text-nano font-medium text-soft",
                              )}
                            >
                              {symbol}
                            </span>
                          ))}
                        </span>
                      </>
                    )}
                  </p>
                  </div>

                  {/* Mobilde de görünür. Ana sayfadaki haber listesi küçük
                      resmi telefonda zaten gösteriyordu; burada gizlemek iki
                      listeyi birbirinden farklı kılıyordu ve küçük resim
                      listeyi taranabilir yapan asıl şey. */}
                  {/* No repeated empty image tile: a story without a real
                      image or verified subject logo keeps an editorial text layout. */}
                  {hasVisual && <NewsImage
                    className={styles.thumb}
                    src={
                      item.imageUrl && !genericImages.has(item.imageUrl)
                        ? item.imageUrl
                        : null
                    }
                    logoUrl={(() => {
                      /* Logo yalnızca haber gerçekten o şirketle ilgiliyse:
                         `symbols` alanı bazen haberin konusunu değil,
                         çekildiği beslemeyi söylüyor. */
                      const symbol = item.symbols?.[0];
                      const meta = symbol ? logos[symbol] : null;
                      if (!symbol || !meta?.logoUrl) return null;
                      return headlineMentions(item.headline, symbol, meta.name)
                        ? meta.logoUrl
                        : null;
                    })()}
                    sizeClass=""
                  />}
                </Link>
              </li>;
            })}
          </ul>
        )}
      </div>
  );
}
