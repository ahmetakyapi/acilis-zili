import { headers } from "next/headers";
import { GLOSSARY_SLUGS } from "@/content/glossary";
import { GUIDE_SLUGS } from "@/content/guide";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { LOCALE_HEADER, localeFromHeader, withLocale } from "@/lib/i18n/routing";
import { SITE_URL } from "@/lib/site";

/**
 * `/llms.txt` — yapay zekâ asistanlarına sitenin haritası (14 Kasım SEO
 * denetimi; ROUTEMAP "yapay zekâ cevaplarında bulunmak"ı hedef sayıyor ve
 * dosya 404 dönüyordu).
 *
 * Düz Markdown: sitenin ne olduğu tek paragraf, sonra bölüm bölüm bağlantı.
 * Dil adresten: `/llms.txt` Türkçe, `/en/llms.txt` İngilizce (beslemeyle
 * aynı kalıp — `app/feed.xml/route.ts`). SAYILAR ELLE YAZILMAZ: rehber ve
 * sözlük sayısı içerik dizinlerinden gelir, yoksa ilk yeni yazıda eskir.
 * Yalnız dizine açık bölümler listelenir; kişisel ekranlar (portföy,
 * favoriler, ayarlar) burada yoktur.
 */
type Entry = [path: string, title: string, note?: string];
type Section = [heading: string, entries: Entry[]];

function sections(tr: boolean): Section[] {
  const guides = GUIDE_SLUGS.length;
  const terms = GLOSSARY_SLUGS.length;
  return tr
    ? [
        ["Bugün", [
          ["/", "Ana Sayfa", "Açılışa geri sayım, endeksler, günün akışı"],
          ["/piyasalar", "Piyasalar", "S&P 500, Nasdaq 100 ve Dow bileşenleri, ısı haritası, sektörler"],
          ["/bulten", "Günlük Bülten", "Her gün açılış öncesi özet; arşiv"],
          ["/gunun-grafigi", "Günün Grafiği", "Her seansın tek grafiği ve kısa açıklaması"],
          ["/haberler", "Haberler", "Şirket ve piyasa haberleri, Türkçe"],
        ]],
        ["Takvimler", [
          ["/bilancolar", "Bilanço Takvimi", "Kim, hangi gün, açılış öncesi mi kapanış sonrası mı; şirket adresi /bilancolar/{sembol}"],
          ["/takvim", "Ekonomik Takvim", "FOMC, TÜFE, istihdam, PCE; Türkiye saatiyle"],
          ["/abd-borsasi-saatleri", "ABD Borsası Saatleri (Türkiye Saatiyle)", "Bugün kaçta açılıyor, şu an açık mı; ön seans, asıl seans, akşam seansı; yaz saati geçişleri"],
          ["/abd-borsasi-tatil-gunleri", "ABD Borsası Tatil Günleri", "NYSE ve Nasdaq tatilleri, yarım günlerin Türkiye saatiyle kapanışı"],
          ["/takvim/fomc", "FOMC Toplantı Tarihleri", "Sıradaki Fed faiz kararı, tarih ve Türkiye saati"],
          ["/takvim/tufe", "ABD TÜFE Açıklama Tarihleri"],
          ["/takvim/tarim-disi-istihdam", "Tarım Dışı İstihdam Açıklama Tarihleri"],
          ["/takvim/pce", "Çekirdek PCE Açıklama Tarihleri"],
          ["/makro", "Makro Göstergeler", "Enflasyon, işsizlik, Fed faizi, getiri eğrisi"],
          ["/olasiliklar", "Olasılıklar", "Tahmin piyasalarının Fed ve veri beklentileri"],
        ]],
        ["Şirketler ve Analiz", [
          ["/sirketler", "Şirketler", "Hisse sayfası adresi /hisse/{SEMBOL}"],
          ["/bilancolar/analizler", "Bilanço Analizleri", "Açıklanan çeyreklerin okuması"],
          ["/teknik-analiz", "Teknik Analiz", "Takip edilen hisselerde trend, destek ve direnç"],
          ["/yatirimcilar", "Ünlü Yatırımcılar", "SEC 13F ve Kongre bildirimleri"],
          ["/temalar", "Temalar", "Tematik hisse listeleri"],
          ["/karsilastir", "Karşılaştır", "Hisseleri aynı ölçekte yan yana"],
          ["/tarama", "Hisse Tarayıcı", "Ölçüye göre süzme"],
        ]],
        ["Öğrenme", [
          ["/rehber", "Rehber", `${guides} sıralı yazı; kavramdan stratejiye`],
          ["/sozluk", "Sözlük", `${terms} terim; adres /sozluk/{terim}`],
          ["/mercek", "Mercek", "Günün olayının arkasındaki mekanizma"],
        ]],
        ["Türkiye'den Yatırım", [
          ["/vergi", "Yurt Dışı Hisse Vergisi Hesaplayıcı"],
          ["/rehber/w-8ben", "W-8BEN ve Temettü Stopajı"],
          ["/araci-kurumlar", "Aracı Kurum Karşılaştırması"],
        ]],
        ["Hakkında", [
          ["/hakkinda", "Hakkında ve Yöntem", "Veri kaynakları, yazıların nasıl üretildiği"],
          ["/feed.xml", "RSS"],
          ["/sitemap.xml", "Site Haritası"],
        ]],
      ]
    : [
        ["Today", [
          ["/", "Home", "Countdown to the open, indices, the day's flow"],
          ["/piyasalar", "Markets", "S&P 500, Nasdaq 100 and Dow constituents, heat map, sectors"],
          ["/bulten", "Daily Brief", "A pre-open summary every day; archive"],
          ["/gunun-grafigi", "Chart of the Day", "One chart per session with a short note"],
          ["/haberler", "News", "Company and market news"],
        ]],
        ["Calendars", [
          ["/bilancolar", "Earnings Calendar", "Who reports when, before the open or after the close; company address /bilancolar/{symbol}"],
          ["/takvim", "Economic Calendar", "FOMC, CPI, jobs, PCE; with times"],
          ["/abd-borsasi-saatleri", "US Stock Market Hours in Türkiye Time", "When it opens today, whether it is open now; pre-market, regular and after-hours; daylight-saving shifts"],
          ["/abd-borsasi-tatil-gunleri", "US Stock Market Holidays", "NYSE and Nasdaq holidays and early closes in Istanbul time"],
          ["/takvim/fomc", "FOMC Meeting Dates", "The next Fed rate decision, with date and time"],
          ["/takvim/tufe", "US CPI Release Dates"],
          ["/takvim/tarim-disi-istihdam", "Nonfarm Payrolls Release Dates"],
          ["/takvim/pce", "Core PCE Release Dates"],
          ["/makro", "Macro Indicators", "Inflation, unemployment, the Fed rate, the yield curve"],
          ["/olasiliklar", "Odds", "What prediction markets price for the Fed and data"],
        ]],
        ["Companies and Analysis", [
          ["/sirketler", "Companies", "Stock page address /hisse/{SYMBOL}"],
          ["/bilancolar/analizler", "Earnings Analyses", "A read of each reported quarter"],
          ["/teknik-analiz", "Technical Analysis", "Trend, support and resistance on tracked stocks"],
          ["/yatirimcilar", "Famous Investors", "SEC 13F and congressional filings"],
          ["/temalar", "Themes", "Thematic stock lists"],
          ["/karsilastir", "Compare", "Stocks side by side at the same scale"],
          ["/tarama", "Stock Screener", "Filter by metric"],
        ]],
        ["Learning", [
          ["/rehber", "Guide", `${guides} articles in order; from concept to strategy`],
          ["/sozluk", "Glossary", `${terms} terms; address /sozluk/{term}`],
          ["/mercek", "Close-Up", "The mechanism behind the day's story"],
        ]],
        ["Investing From Türkiye", [
          ["/vergi", "Foreign Stock Tax Calculator"],
          ["/rehber/w-8ben", "W-8BEN and Dividend Withholding"],
          ["/araci-kurumlar", "Broker Comparison"],
        ]],
        ["About", [
          ["/hakkinda", "About and Method", "Data sources and how the writing is produced"],
          ["/feed.xml", "RSS"],
          ["/sitemap.xml", "Sitemap"],
        ]],
      ];
}

export async function GET() {
  const headerStore = await headers();
  const locale = localeFromHeader(headerStore.get(LOCALE_HEADER)) ?? DEFAULT_LOCALE;
  const tr = locale === "tr";
  /* Site haritası tek dosya, dil öneki almaz. */
  const href = (path: string) => `${SITE_URL}${path === "/sitemap.xml" ? path : withLocale(path, locale)}`;

  const intro = tr
    ? `# Açılış Zili\n\n> ABD borsalarını Türkiye'den, Türkiye saatiyle takip etmek için ücretsiz ve reklamsız site. Fiyatlar 15 dakika gecikmelidir; her sayı kaynağı ve saatiyle damgalanır. İçerik yatırım tavsiyesi değildir. English: ${SITE_URL}/en/llms.txt`
    : `# Opening Bell (Açılış Zili)\n\n> A free, ad-free site for following US stock markets from Türkiye, in Istanbul time. Prices are delayed 15 minutes; every figure carries its source and time. Nothing here is investment advice. Türkçe: ${SITE_URL}/llms.txt`;

  const body = sections(tr)
    .map(([heading, entries]) =>
      [`## ${heading}`, ...entries.map(([path, title, note]) => `- [${title}](${href(path)})${note ? `: ${note}` : ""}`)].join("\n"),
    )
    .join("\n\n");

  return new Response(`${intro}\n\n${body}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
