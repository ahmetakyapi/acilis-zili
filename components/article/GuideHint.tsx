import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { GlyphTile } from "@/components/article/GlyphTile";
import { guideArticle } from "@/content/guide";
import { cn } from "@/lib/utils";

/**
 * Ekranın altındaki "bunu anlamak için" şeridi.
 *
 * Rehber kendi başına iyi bir bölüm ama kimse "acaba bugün bir kavram
 * öğrensem mi" diye açmıyor. Soru, sayıya bakarken doğuyor: bilanço
 * ekranında EPS'in ne olduğu, makro ekranında çekirdek enflasyonun neden
 * ayrı hesaplandığı. Bağlantıyı sorunun doğduğu yere koymak, ayrı bir
 * bölüme koymaktan çok daha fazla okunuyor.
 *
 * Yalnızca slug alır ve başlığı/açıklamayı içerikten okur — bir yazının adı
 * değiştiğinde burada güncellenecek bir şey kalmaz. Slug yoksa sessizce
 * düşer, bozuk kart göstermez.
 */
export function GuideHint({
  slugs,
  label,
  locale,
  /** "stack" iki kartı alt alta dizer — dar bir yan kolonda `sm:grid-cols-2`
      görüntü genişliğine bakıyor, KAPSAYICI genişliğine değil, ve 340px'lik
      bir kolonda başlıkları üç satıra kırıyordu. */
  layout = "row",
  className,
}: {
  slugs: string[];
  /** Şeridin üstündeki küçük başlık — ekranın diline göre değişir. */
  label: string;
  /** Başlık ve açıklama içerikten okunur; hangi dilden okunacağı buradan. */
  locale: string;
  layout?: "row" | "stack";
  className?: string;
}) {
  const articles = slugs
    .map((slug) => guideArticle(slug, locale))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (articles.length === 0) return null;

  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <p className="plate text-[10px] tracking-[0.09em]">{label}</p>
      <div
        className={cn(
          "grid gap-3",
          layout === "stack"
            ? "grid-cols-1"
            : articles.length > 1
              ? "sm:grid-cols-2"
              : "sm:max-w-md",
        )}
      >
        {articles.map((article) => (
          <Link
            key={article.slug}
            href={`/rehber/${article.slug}`}
            prefetch={false}
            className="panel panel-hover flex min-w-0 items-center gap-3 p-3.5 transition-colors"
          >
            <GlyphTile glyph={article.glyph} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold text-strong">
                {article.title}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                {article.dek}
              </span>
            </span>
            <ArrowRight
              weight="bold"
              size={13}
              className="shrink-0 text-primary"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
