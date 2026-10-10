import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/news/NewsExperience.module.css";
import type { Metadata } from "next";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { notFound } from "next/navigation";
import { NewsImage } from "@/components/news/NewsImage";
import { PageShare } from "@/components/article/PageShare";
import { ArrowSquareOut, CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { ChangePill, DataStamp, LogoTile, Panel, PanelHeader, buttonClass } from "@/components/ui/primitives";
import { Sparkline } from "@/components/ui/Sparkline";
import {
  getLatestNews,
  getNewsById,
  getStatus,
  getSymbolNames,
  isGenericNewsImage,
} from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { metaDescription, missingMetadata } from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { getChartBarsMulti, getQuotes } from "@/lib/providers";
import { displayZone, zoneTag } from "@/lib/session-clock";
import { directionOf, formatPrice, headlineMentions, safeExternalUrl, timeAgo, titleCaseLabel, NO_VALUE } from "@/lib/utils";

/** Haberde gösterilen en çok şirket — sağlayıcı etiketi uzun bir liste olabiliyor. */
const MENTIONED_MAX = 6;

/**
 * Haber detayı — kullanıcı siteden ayrılmadan okur.
 *
 * Sağlayıcı yalnızca başlık + kısa özet verir (tam makale telifle korunur),
 * bu yüzden sayfa metni uzatmak yerine BAĞLAM ekler: haberde geçen şirketlerin
 * canlı fiyatı ve aynı konudaki diğer haberler. Kaynağa giden bağlantı tek
 * yerde, gövdenin sonunda durur.
 */
/**
 * Künye — başlık haberin kendisi.
 *
 * Yoktu: her haber detayı kök şablonun genel başlığıyla açılıyordu, yani
 * paylaşılan bağlantı da arama sonucu da hangi haber olduğunu söylemiyordu.
 * Başlık okuyucunun dilindeki çeviriden geliyor; çeviri yoksa orijinal.
 */
export async function generateMetadata(
  props: PageProps<"/haberler/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const { locale } = await getI18n();
  const item = await getNewsById(id);
  if (!item) return missingMetadata(locale);

  const headline =
    locale === "tr" && item.headlineTr ? item.headlineTr : item.headline;
  const summary =
    locale === "tr" && item.summaryTr ? item.summaryTr : item.summary;
  return {
    title: headline,
    description: metaDescription(summary),
    /* CANONICAL VE HREFLANG. Dinamik sayfalar künyelerini elden yazıyor ve
       `alternates` bloğunu hiç vermiyorlardı: sitenin en kalabalık
       adresleri (yüzlerce hisse, her yazı, her analiz) canonical'sız ve
       "öteki dildeki karşılığı şu" bilgisi olmadan yayımlanıyordu. Kök
       layout canonical yazmıyor (orada gerekçesi var), yani miras da yok.
       `pageAlternates` RSS keşif etiketini de birlikte taşıyor. */
    alternates: pageAlternates(`/haberler/${id}`, locale),
  };
}

export default async function NewsDetailPage(
  props: PageProps<"/haberler/[id]">,
) {
  const { id } = await props.params;
  const { locale, t } = await getI18n();
  const item = await getNewsById(id);

  /* Olmayan haber 404 DÖNER, 200 değil — ekran `not-found.tsx` dosyasında. */
  if (!item) notFound();

  const useTr = locale === "tr" && item.headlineTr;
  const headline = useTr ? item.headlineTr! : item.headline;
  const summary =
    locale === "tr" && item.summaryTr ? item.summaryTr : item.summary;

  // Kaynak logosu olan görseller gösterilmez — bilgi taşımaz, sayfayı bozar.
  const showImage = item.imageUrl
    ? !(await isGenericNewsImage(item.imageUrl))
    : false;

  const sourceHref = safeExternalUrl(item.url);

  /* HABERDE GEÇEN ŞİRKETLER BİR KEZ HESAPLANIYOR (9 Ekim): hem başlığın
     altındaki şeritte hem aşağıdaki fiyat panelinde aynı liste. Sağlayıcı
     etiketi haberin konusunu değil çekildiği beslemeyi söyleyebiliyor;
     yalnızca metinde adı ya da sembolü geçenler (`headlineMentions`).
     `getSymbolNames` istek içinde önbellekli, panel aynı anahtarı soruyor. */
  const tagged = (item.symbols ?? []).slice(0, MENTIONED_MAX);
  const names = tagged.length ? await getSymbolNames(tagged) : {};
  const context = `${item.headline} ${item.summary ?? ""}`;
  const mentioned = tagged.filter((symbol) => headlineMentions(context, symbol, names[symbol]?.name));

  /* SAAT DİLİMİ ŞART. Burada `timeZone` verilmiyordu, yani biçimlendirici
     SUNUCUNUN dilimini kullanıyordu — Vercel'de UTC. Türkiye'de 22 Ağustos
     00:42'de yayımlanan bir haberin künyesi üretimde "21 Ağustos 21:42"
     yazıyor, hemen yanındaki göreli saat ("11 saat önce") ise doğru
     hesaplandığı için ikisi çelişiyordu: aynı satırda üç saat ve bir gün
     fark eden iki zaman.
     Dilim projenin kuralına göre seçiliyor (TR'de İstanbul, EN'de New York)
     ve künyeye hangi saat olduğu yazılıyor — okuyucu "21:42" görüp hangi
     duvar saati olduğunu tahmin etmek zorunda kalmamalı. */
  const publishedFull = new Intl.DateTimeFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: displayZone(locale),
    },
  ).format(item.publishedAt);

  return (
    <MotionExperience>
    <ScrollProgress />
    <article className={styles.detail}>
      <Link
        href="/haberler"
        className="inline-flex items-center gap-1.5 self-start text-sm text-soft transition-colors hover:text-strong"
      >
        <CaretLeft weight="duotone" size={15} />
        {t.news.title}
      </Link>

      <header>
        {/* Paylaş düğmesi bir div taşır. p içine koymak tarayıcının
            paragrafı erken kapatmasına ve tüm haberin hidrasyonda
            yeniden çizilmesine neden oluyordu (React #418). */}
        <div className={`${styles.detailMeta} flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted`}>
          {item.source && (
            <span className="font-medium text-soft">{item.source}</span>
          )}
          <span aria-hidden>·</span>
          <span>
            {publishedFull} {zoneTag(locale).primary}
          </span>
          <span aria-hidden>·</span>
          <span>{titleCaseLabel(timeAgo(item.publishedAt, locale), locale)}</span>
          {/* PAYLAŞ (8 Ekim). Okuma ekranlarının hepsinde vardı (mercek,
              rehber, bülten, tema…) — sahibinin kuralı "böyle ekranlara hep
              paylaş" (StockHeader); haber detayı dışarıda kalmıştı. */}
          <PageShare
            path={`/haberler/${item.id}`}
            title={headline}
            locale={locale}
            t={t}
            compact
            className="ml-auto"
          />
        </div>
        {/* Çevirisi yoksa başlık İngilizce basılıyor; `lang` bunu söylüyor
            (gerekçe liste sayfasında). */}
        <h1
          lang={locale === "tr" && !useTr ? "en" : undefined}
          className="mt-2 text-heading font-bold leading-snug tracking-[-0.03em] text-strong sm:text-subdisplay"
        >
          {headline}
        </h1>
        {useTr && (
          <p className="mt-2 text-tiny text-muted">
            {t.news.translated} ·{" "}
            <span className="italic">{item.headline}</span>
          </p>
        )}
        {/* ŞİRKET ŞERİDİ (9 Ekim). Haberin kimin hakkında olduğu sayfanın
            dibindeki panelde, özetin ve kaynak çağrısının altında
            kalıyordu; okuyucu başlığı okuyup "hangi şirket" sorusunun
            cevabını aşağıda arıyordu. Künye şeridi kuralı (CLAUDE.md →
            ekran düzeni 2): başlığın hemen altında logolu çipler. Sayı yok
            — fiyat ve yüzde aşağıdaki panelde, tek yerde. */}
        {mentioned.length > 0 && (
          <ul className={styles.detailChips}>
            {mentioned.map((symbol) => (
              <li key={symbol}>
                <Link href={`/hisse/${symbol}`} className={styles.detailChip}>
                  <LogoTile symbol={symbol} logoUrl={names[symbol]?.logoUrl} size="xs" />
                  <span className="numeral font-semibold text-strong">{symbol}</span>
                  {names[symbol]?.name && <span className={styles.detailChipName}>{names[symbol]!.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>

      {/* Sabit oran: `max-h-96` yükseklik AUTO bıraktığı için object-cover
          kırpacak bir kutu bulamıyordu ve görsel kendi oranında uzayıp
          kutudan taşıyordu — mobilde en belirgin haliyle. 16/9 hem kırpmayı
          çalıştırıyor hem de görsel yüklenmeden önce yerini ayırdığı için
          sayfa zıplamıyor. */}
      {showImage && item.imageUrl && (
        <NewsImage
          src={item.imageUrl}
          className="rounded-xl"
          sizeClass="aspect-[16/9] w-full"
        />
      )}

      {summary ? (
        <div className="text-lead leading-8 text-body">
          {summary.split("\n").map(
            (paragraph, index) =>
              paragraph.trim() && (
                <p key={index} className="mb-4">
                  {paragraph}
                </p>
              ),
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">{t.common.noDataHint}</p>
      )}

      {/* Kaynak çağrısı — özetin kısa olduğunu dürüstçe söyler.
          Adres sağlayıcıdan geliyor; şeması süzülmeden href'e konmaz. */}
      {sourceHref && (
      <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-strong">
            {t.news.fullStoryTitle}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-soft">
            {t.news.fullStoryHint}
            {item.source ? `: ${item.source}` : ""}
          </p>
        </div>
        <a
          href={sourceHref}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClass({ className: "shrink-0" })}
        >
          {t.news.readAtSource}
          <ArrowSquareOut weight="duotone" size={14} />
        </a>
      </Panel>
      )}

      {mentioned.length > 0 && (
        <MentionedSymbols symbols={mentioned} names={names} locale={locale} t={t} />
      )}

      <RelatedNews
        currentId={item.id}
        symbols={item.symbols ?? []}
        locale={locale}
        title={t.news.related}
      />
    </article>
    </MotionExperience>
  );
}

/**
 * Haberde geçen şirketler — canlı fiyatla.
 * Kısa özetin veremediği bağlamı sayı veriyor: haber çıkarken hisse ne yapıyor?
 */
async function MentionedSymbols({
  symbols: mentioned,
  names,
  locale,
  t,
}: {
  symbols: string[];
  names: Awaited<ReturnType<typeof getSymbolNames>>;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  /* GÜNÜN ÇİZGİSİ (9 Ekim): satırda fiyat ve yüzde vardı, şekli yoktu.
     Ana sayfanın favori özetiyle aynı kalıp — bir günlük barlar, çizgi
     yalnızca kotasyon taze iken (şekil sayıyla aynı seansı anlatmalı;
     gerekçe IndexStrip). Barlar düşerse satır çizgisiz kalıyor. */
  const [result, bars] = await Promise.all([
    getQuotes(mentioned, status),
    getChartBarsMulti(mentioned, "1D", status).catch(() => ({}) as Awaited<ReturnType<typeof getChartBarsMulti>>),
  ]);
  const quotes = result.ok ? result.data : {};
  const sparkOk = result.ok && !result.stale;

  return (
    <Panel>
      <PanelHeader title={t.news.relatedSymbols} />
      <ul className="divide-y divide-line-soft">
        {mentioned.map((symbol) => {
          const quote = quotes[symbol];
          return (
            <li key={symbol}>
              <Link
                href={`/hisse/${symbol}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <LogoTile symbol={symbol} logoUrl={names[symbol]?.logoUrl} size="sm" />
                  <span className="min-w-0">
                    <span className="numeral block text-sm font-semibold text-strong">{symbol}</span>
                    <span className="block truncate text-xs text-soft">{names[symbol]?.name ?? ""}</span>
                  </span>
                </span>
                {sparkOk && quote && (bars[symbol]?.length ?? 0) > 1 && (
                  <Sparkline
                    points={bars[symbol]!.map((bar) => ({ value: bar.close }))}
                    title={`${symbol} · 1D`}
                    tone={directionOf(quote.changePct)}
                    width={72}
                    height={28}
                    showArea={false}
                    className="hidden h-7 w-[72px] shrink-0 min-[420px]:block"
                  />
                )}
                {quote ? (
                  /* Fiyat üstte, yüzde altında, sabit sütun: satırlar aynı
                     hatta bitiyor (CLAUDE.md → ölçü ızgarası). */
                  <span className="flex w-[92px] shrink-0 flex-col items-end gap-1">
                    <span className="numeral text-sm font-semibold text-strong">
                      {formatPrice(quote.price, locale)}
                    </span>
                    <ChangePill
                      changePct={quote.changePct}
                      locale={locale}
                      size="sm"
                    />
                  </span>
                ) : (
                  <span className="text-xs text-muted">{NO_VALUE}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* DAMGA — panel yüzde basıyor ve yaşını söylemiyordu. Haber detayı
          sitenin en uzun ömürlü sayfası: bir hafta önceki habere gelen
          okuyucu da bu paneli görüyor ve oradaki yüzde "haberin günündeki
          hareket" değil, o anki seansın hareketi. Damga hangisi olduğunu
          söyleyen tek şey. */}
      {result.ok && (
        <DataStamp
          labels={t.data}
          source={result.source}
          at={result.fetchedAt}
          stale={result.stale}
          locale={locale}
          className="border-t border-line px-4 py-2.5 sm:px-5"
        />
      )}
    </Panel>
  );
}

/**
 * Benzer haberler — önce ortak sembol taşıyanlar, kalan yer son haberlerle
 * dolar. Kısa özetli sayfaya bağlam kazandırır, okuyucuyu içeride tutar.
 */
async function RelatedNews({
  currentId,
  symbols,
  locale,
  title,
}: {
  currentId: string;
  symbols: string[];
  locale: string;
  title: string;
}) {
  const pool = (await getLatestNews(24)).filter((n) => n.id !== currentId);
  const related = pool.filter((n) =>
    symbols.some((s) => n.symbols?.includes(s)),
  );
  const fill = pool.filter((n) => !related.includes(n));
  const shown = [...related, ...fill].slice(0, 5);

  if (shown.length === 0) return null;
  /* LOGO (9 Ekim): satırlar yalnızca metindi ve beş başlık alt alta tek
     bir gri blok gibi okunuyordu. Ana sayfanın haber bandıyla aynı kural:
     logo yalnızca haber gerçekten o şirketle ilgiliyse (başlıkta adı ya da
     sembolü geçiyorsa); değilse kaynağın baş harfi. */
  const firstSymbols = [...new Set(shown.map((n) => n.symbols?.[0]).filter((s): s is string => Boolean(s)))];
  const logos = firstSymbols.length ? await getSymbolNames(firstSymbols) : {};
  const logoOf = (n: (typeof shown)[number]) => {
    const symbol = n.symbols?.[0];
    const meta = symbol ? logos[symbol] : undefined;
    return symbol && meta && headlineMentions(n.headline, symbol, meta.name) ? { symbol, logoUrl: meta.logoUrl } : null;
  };

  return (
    <Panel>
      <PanelHeader title={title} />
      <ul className="divide-y divide-line-soft">
        {shown.map((n) => (
          <li key={n.id}>
            <Link
              href={`/haberler/${n.id}`}
              className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
            >
              {logoOf(n) ? (
                <LogoTile symbol={logoOf(n)!.symbol} logoUrl={logoOf(n)!.logoUrl} size="sm" className="mt-0.5" />
              ) : (
                <span aria-hidden className={styles.relatedInitial}>
                  {(n.source ?? "?").slice(0, 1).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
                </span>
              )}
              <span className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium leading-snug text-strong">
                <span lang={locale === "tr" && !n.headlineTr ? "en" : undefined}>
                  {locale === "tr" && n.headlineTr ? n.headlineTr : n.headline}
                </span>
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-tiny text-muted">
                {n.source && <span>{n.source}</span>}
                <span aria-hidden>·</span>
                <span>{titleCaseLabel(timeAgo(n.publishedAt, locale), locale)}</span>
              </p>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
