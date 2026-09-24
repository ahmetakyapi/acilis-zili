import { LocaleLink as Link } from "@/components/layout/LocaleLink";
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
      <p className="plate text-nano">{label}</p>
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
            /* YAN YANA İKİ KART AYNI HATTA. Kart bir süre `items-center`
               taşıyan bir flex satırıydı ve iki kartın başlıkları farklı
               uzunlukta olduğunda (biri tek satır, öteki iki) ikisi de
               kendi içinde ortalanıyordu: ölçüldü, 1024 pikselde açıklama
               satırları 26 piksel kayıyordu ve iki kart aynı ızgara
               satırında oldukları hâlde hiçbir hattı paylaşmıyordu.
               Alt ızgara başlığı ve açıklamayı KARDEŞ kartla aynı satıra
               bağlıyor: başlık iki satıra çıkarsa öteki kartın açıklaması
               da onunla birlikte iner. Simge ve ok iki satırı birden
               kaplayıp kendi içinde ortalanıyor; dolgu iki kartta da aynı
               olduğu için hizayı bozmuyor. */
            className="panel panel-hover row-span-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-subgrid gap-x-3 gap-y-0.5 p-3.5 transition-colors"
          >
            <span className="row-span-2 grid place-items-center">
              <GlyphTile glyph={article.glyph} size={36} />
            </span>
            <span className="row-span-2 grid grid-rows-subgrid gap-y-0.5">
              <span className="block self-start text-base font-bold text-strong">
                {article.title}
              </span>
              {/* İKİ SATIR — tek satır değil.
                  `truncate` cümleyi tek satıra sıkıştırıyordu ve dar
                  ekranda cümlenin can alıcı yarısı gidiyordu: ölçüldü,
                  390 ve 768 pikselde kutu 251 piksel, cümleler 360 ve 449
                  piksel istiyor. "Faiz kararının kendisi çoğu zaman sürpriz
                  değildir; sürpriz, kararın yanındaki cümlelerdedir" —
                  kartın var oluş sebebi noktalı virgülden SONRAKİ yarı ve
                  tam da o gidiyordu. */}
              <span className="block self-start line-clamp-2 text-tiny leading-[1.35] text-muted">
                {article.dek}
              </span>
            </span>
            <ArrowRight
              weight="bold"
              size={13}
              className="row-span-2 shrink-0 self-center text-primary"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
