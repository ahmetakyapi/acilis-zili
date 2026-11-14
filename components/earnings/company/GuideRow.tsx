import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { GlyphTile } from "@/components/article/GlyphTile";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { guideArticle } from "@/content/guide";
import css from "./CompanyEarnings.module.css";

/**
 * "BUNU ANLAMAK İÇİN" — AÇIK BÖLÜM, TAM GENİŞLİKTE TEK SATIR (14 Kasım 2026,
 * görsel tur).
 *
 * Sayfanın dibinde ortak `GuideHint` duruyordu; tek yazıda kartı 448
 * pikselle sınırlıyor (`sm:max-w-md`) ve 1440'ta sağında ~870 piksel boş
 * kalıyordu (canlı, /bilancolar/NVDA). Rehber bağlantısı destekleyici
 * içerik: turun üç katından üçüncüsü, kutusuz açık bölüm. Üstte saç teli,
 * bölüm adı, altında satırın TAMAMI bağlantı: işaret · başlık + açıklama ·
 * sağ uçta "Rehberde Oku". Ortak bileşene dokunulmadı (öteki ekranlar aynı
 * hâliyle kullanıyor); bu satır yalnız bu sayfanın. Başlık ve açıklama
 * içerikten okunur, slug yoksa bölüm hiç basılmaz (`GuideHint`in kuralı).
 */
export function GuideRow({
  slug,
  label,
  cta,
  locale,
}: {
  slug: string;
  label: string;
  cta: string;
  locale: string;
}) {
  const article = guideArticle(slug, locale);
  if (!article) return null;
  return (
    <section className={css.guide}>
      <h2 data-ink="plain" className={css.guideLabel}>
        {label}
      </h2>
      <Link href={`/rehber/${article.slug}`} prefetch={false} className={css.guideRow}>
        <GlyphTile glyph={article.glyph} size={44} />
        <span className={css.guideText}>
          <span className={css.guideTitle}>{article.title}</span>
          <span className={css.guideDek}>{article.dek}</span>
        </span>
        <span className={css.guideCta}>
          <span>{cta}</span>
          <ArrowRight weight="bold" size={14} aria-hidden />
        </span>
      </Link>
    </section>
  );
}
