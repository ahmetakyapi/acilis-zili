import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { getNewsById } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/utils";

/**
 * Haber detayı — kullanıcı siteden ayrılmadan okur.
 * Elimizdeki içerik sağlayıcının verdiği başlık + özettir (tam makale değil);
 * kaynağa giden bağlantı en altta tek yerde durur.
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

      {item.imageUrl && (
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
        <div className="text-base leading-relaxed text-body">
          {summary.split("\n").map(
            (paragraph, index) =>
              paragraph.trim() && <p key={index} className="mb-3">{paragraph}</p>,
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">{t.common.noDataHint}</p>
      )}

      {item.symbols && item.symbols.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">
            {t.news.relatedSymbols}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {item.symbols.map((symbol) => (
              <Link
                key={symbol}
                href={`/hisse/${symbol}`}
                className="numeral rounded-md border border-line-soft bg-surface px-2.5 py-1 text-xs font-medium text-body transition-colors hover:border-primary-faint hover:bg-primary-tint hover:text-primary"
              >
                {symbol}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Panel className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <span className="text-xs text-muted">
          {t.common.source}: {item.source ?? "—"}
        </span>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-(--radius-md) bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {t.news.readAtSource}
          <ExternalLink size={14} />
        </a>
      </Panel>
    </article>
  );
}
