import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import {
  ChangePill,
  EmptyState,
  PanelHeader,
} from "@/components/ui/primitives";
import {
  getLatestNews,
  getNewsById,
  getStatus,
  getSymbolNames,
  isGenericNewsImage,
} from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getQuotes } from "@/lib/providers";
import { formatPrice, timeAgo } from "@/lib/utils";

/**
 * Haber detayı — kullanıcı siteden ayrılmadan okur.
 *
 * Sağlayıcı yalnızca başlık + kısa özet verir (tam makale telifle korunur),
 * bu yüzden sayfa metni uzatmak yerine BAĞLAM ekler: haberde geçen şirketlerin
 * canlı fiyatı ve aynı konudaki diğer haberler. Kaynağa giden bağlantı tek
 * yerde, gövdenin sonunda durur.
 */
export default async function NewsDetailPage(
  props: PageProps<"/haberler/[id]">,
) {
  const { id } = await props.params;
  const { locale, t } = await getI18n();
  const item = await getNewsById(id);

  if (!item) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title={t.news.notFound}
          hint={t.news.notFoundHint}
          action={
            <Link href="/haberler" className="text-sm text-primary hover:underline">
              {t.common.back}
            </Link>
          }
        />
      </div>
    );
  }

  const useTr = locale === "tr" && item.headlineTr;
  const headline = useTr ? item.headlineTr! : item.headline;
  const summary =
    locale === "tr" && item.summaryTr ? item.summaryTr : item.summary;

  // Kaynak logosu olan görseller gösterilmez — bilgi taşımaz, sayfayı bozar.
  const showImage = item.imageUrl
    ? !(await isGenericNewsImage(item.imageUrl))
    : false;

  const publishedFull = new Intl.DateTimeFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    { dateStyle: "long", timeStyle: "short" },
  ).format(item.publishedAt);

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link
        href="/haberler"
        className="inline-flex items-center gap-1.5 self-start text-sm text-soft transition-colors hover:text-strong"
      >
        <ArrowLeft size={15} />
        {t.news.title}
      </Link>

      <header>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {item.source && (
            <span className="font-medium text-soft">{item.source}</span>
          )}
          <span aria-hidden>·</span>
          <span>{publishedFull}</span>
          <span aria-hidden>·</span>
          <span>{timeAgo(item.publishedAt, locale)}</span>
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-snug tracking-tight text-strong sm:text-3xl">
          {headline}
        </h1>
        {useTr && (
          <p className="mt-2 text-[11px] text-muted">
            {t.news.translated} ·{" "}
            <span className="italic">{item.headline}</span>
          </p>
        )}
      </header>

      {showImage && item.imageUrl && (
        <div className="overflow-hidden rounded-(--radius-xl) border border-line">
          {/* Sağlayıcı görselleri farklı alan adlarından gelir — doğal img. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt=""
            className="max-h-96 w-full object-cover"
          />
        </div>
      )}

      {summary ? (
        <div className="text-[17px] leading-8 text-body">
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

      {/* Kaynak çağrısı — özetin kısa olduğunu dürüstçe söyler */}
      <section className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-strong">
            {t.news.fullStoryTitle}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-soft">
            {t.news.fullStoryHint}
            {item.source ? ` — ${item.source}` : ""}
          </p>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-(--radius-md) bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {t.news.readAtSource}
          <ExternalLink size={14} />
        </a>
      </section>

      {item.symbols && item.symbols.length > 0 && (
        <MentionedSymbols
          symbols={item.symbols}
          locale={locale}
          t={t}
        />
      )}

      <RelatedNews
        currentId={item.id}
        symbols={item.symbols ?? []}
        locale={locale}
        title={t.news.related}
      />
    </article>
  );
}

/**
 * Haberde geçen şirketler — canlı fiyatla.
 * Kısa özetin veremediği bağlamı sayı veriyor: haber çıkarken hisse ne yapıyor?
 */
async function MentionedSymbols({
  symbols,
  locale,
  t,
}: {
  symbols: string[];
  locale: Locale;
  t: Dictionary;
}) {
  const shown = symbols.slice(0, 6);
  const status = await getStatus();
  const [result, names] = await Promise.all([
    getQuotes(shown, status),
    getSymbolNames(shown),
  ]);
  const quotes = result.ok ? result.data : {};

  return (
    <section>
      <PanelHeader title={t.news.relatedSymbols} />
      <ul className="divide-y divide-line-soft">
        {shown.map((symbol) => {
          const quote = quotes[symbol];
          return (
            <li key={symbol}>
              <Link
                href={`/hisse/${symbol}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-primary-tint sm:px-5"
              >
                <span className="flex min-w-0 items-baseline gap-2.5">
                  <span className="numeral shrink-0 text-sm font-semibold text-strong">
                    {symbol}
                  </span>
                  <span className="min-w-0 truncate text-xs text-soft">
                    {names[symbol]?.name ?? ""}
                  </span>
                </span>
                {quote ? (
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className="numeral text-sm text-body">
                      {formatPrice(quote.price, locale)}
                    </span>
                    <ChangePill
                      changePct={quote.changePct}
                      locale={locale}
                      size="sm"
                    />
                  </span>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
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

  return (
    <section>
      <PanelHeader title={title} />
      <ul className="divide-y divide-line-soft">
        {shown.map((n) => (
          <li key={n.id}>
            <Link
              href={`/haberler/${n.id}`}
              className="block px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
            >
              <p className="line-clamp-2 text-sm font-medium leading-snug text-strong">
                {locale === "tr" && n.headlineTr ? n.headlineTr : n.headline}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                {n.source && <span>{n.source}</span>}
                <span aria-hidden>·</span>
                <span>{timeAgo(n.publishedAt, locale)}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
