import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { SectionMasthead } from "@/components/motion/SectionMasthead";
import { PencilSimpleLine } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody, parseBlocks } from "@/components/article/ArticleBody";
import {
  FeedBand,
  PostCard,
  PRIMARY_LINK,
  TemplateTiles,
  WriteGuide,
  type SymbolNames,
} from "@/components/community/CommunityParts";
import { feedStats, leadPreviewBlock, postVisualKinds } from "@/components/community/feed-model";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getPublishedPosts } from "@/lib/user-post-data";
import { getSymbolNames } from "@/lib/data";

export const generateMetadata = pageMetadata({
  path: "/topluluk",
  tr: {
    title: "Topluluk",
    description: "Üyelerin yazdığı, moderasyondan geçmiş piyasa yazıları.",
  },
  en: {
    title: "Community",
    description: "Member-written market posts, published after review.",
  },
});

/** Kartta en çok kaç blok türü basılır — üçten fazlası künyeyi iki satıra taşıyor. */
const CARD_KINDS = 3;
/** Başlık bandındaki logo yığını. */
const BAND_SYMBOLS = 5;

/**
 * Topluluk akışı — üyelerin yazdığı, moderasyondan geçmiş yazılar.
 * Gerekçe lib/schema.ts → userPosts. Kart dili Mercek listesine komşu ama
 * künye farklı: yazar karosu + kullanıcı adı başta — bu içeriğin kimliği
 * sitenin değil yazarın imzası.
 *
 * KAP DİĞER EKRANLARLA AYNI (15 Ekim): `mx-auto max-w-2xl` kaldırıldı;
 * düzenin gerekçesi components/community/CommunityParts.tsx.
 *
 * KOMPAKT BAŞLIK BANDI (25 Ekim görsel turu). Büyük PageHeader 1440'ta
 * 156 piksel boyunca yalnız ad, cümle ve düğme taşıyordu; sağ yarısı boştu.
 * Artık SectionMasthead (Piyasalar'ın kapağı): sağ yarıda akışın sayıları
 * (yazı, yazar, son yayın) ve en çok geçen sembollerin logoları, yanında tek
 * denetim. Sayıların hepsi akışın satırlarından (`feedStats`); boş akışta
 * yalnız düğme kalır, "0 Yazı" basılmaz.
 */
export default async function CommunityPage() {
  const { locale, t } = await getI18n();
  const L = t.community;
  const V = t.communityVisuals;
  const posts = await getPublishedPosts();
  const [lead, ...rest] = posts;
  const stats = feedStats(posts, BAND_SYMBOLS);

  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const shortDate = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { day: "numeric", month: "short" });
  const cardLabels = {
    readMinutes: t.stories.readMinutes,
    symbolsLabel: t.feedVisuals.community.symbolsLabel,
    kindsLabel: V.kindsLabel,
    kinds: V.kinds,
    previewLabel: V.lead.preview,
  };
  /* Rozet logoları (25 Ekim): kartlarda ve banttaki sembollerin tamamı tek sorguda. */
  const wanted = [...new Set([...posts.flatMap((post) => post.symbols.slice(0, 6)), ...stats.topSymbols])];
  const names: SymbolNames = wanted.length
    ? await getSymbolNames(wanted).catch(() => ({}) as Awaited<ReturnType<typeof getSymbolNames>>)
    : {};

  /* Her yazının gövdesi bir kez ayrıştırılır: kart künyesi (blok türleri) ve
     manşetin önizlemesi aynı diziden. Okuma süresi zaten gövdeyi okuyor. */
  const parsed = new Map(posts.map((post) => [post.id, parseBlocks(post.bodyMd, post.locale)]));
  const leadBlocks = lead ? (parsed.get(lead.id) ?? []) : [];
  const previewBlock = leadPreviewBlock(leadBlocks);

  const writeLink = (
    <Link href="/yazilarim/yeni" className={PRIMARY_LINK}>
      <PencilSimpleLine weight="duotone" size={16} aria-hidden />
      {L.feed.write}
    </Link>
  );
  const figures = stats.latest
    ? [
        { label: V.band.posts, value: String(stats.posts) },
        { label: V.band.authors, value: String(stats.authors) },
        { label: V.band.latest, value: shortDate.format(stats.latest) },
      ]
    : [];

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <SectionMasthead
        title={L.feed.title}
        description={L.feed.subtitle}
        aside={
          <FeedBand
            figures={figures}
            symbols={stats.topSymbols}
            symbolsLabel={V.band.symbols}
            names={names}
            label={V.band.label}
            action={writeLink}
          />
        }
      />

      {/* İki kolon, aralık gap-5; kolonlar üstten hizalı (justify-between
          yok — CLAUDE.md "Düzen"). Telefonda rehber akışın altına iner. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {!lead ? (
          /* Boş akış da panelin içinde. Sahnenin altında şablonlar büyük
             karolar hâlinde: "ilk yazı seni bekliyor" cümlesinin hemen
             ardından nereden başlanacağı. Rehber kolonu bu durumda şablon
             basmaz — aynı dört bağlantı iki yerde durmasın. */
          <Panel>
            <PanelHeader title={L.feed.listTitle} />
            <EmptyState scene="press" title={L.feed.emptyTitle} hint={L.feed.emptyHint} className="py-8" />
            <div className="flex flex-col gap-3 border-t border-line-soft px-4 pb-5 pt-4 sm:px-5">
              <div>
                <h3 className="text-sm font-bold text-strong">{V.starters.title}</h3>
                <p className="mt-0.5 text-small leading-relaxed text-muted">{V.starters.hint}</p>
              </div>
              <TemplateTiles templates={L.templates} size="large" />
            </div>
          </Panel>
        ) : (
          <Panel>
            <PanelHeader title={L.feed.listTitle} />
            <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
              <PostCard
                post={lead}
                locale={locale}
                dateFormat={dateFormat}
                labels={cardLabels}
                names={names}
                lead
                kinds={postVisualKinds(leadBlocks, CARD_KINDS)}
                preview={
                  previewBlock ? (
                    <ArticleBody markdown="" blocks={[previewBlock]} locale={lead.locale} ugc />
                  ) : undefined
                }
              />
              {rest.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {rest.map((post) => (
                    <li key={post.id} className="min-w-0">
                      <PostCard
                        post={post}
                        locale={locale}
                        dateFormat={dateFormat}
                        labels={cardLabels}
                        names={names}
                        kinds={postVisualKinds(parsed.get(post.id) ?? [], CARD_KINDS)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Uyarı panelin içinde, hairline üstünde düz paragraf. */}
            <p className="border-t border-line-soft px-4 py-3 text-tiny leading-relaxed text-muted sm:px-5">
              {L.feed.note}
            </p>
          </Panel>
        )}

        <Panel className="lg:sticky lg:top-[calc(var(--app-bar-h)+20px)]">
          <PanelHeader title={L.feed.howTitle} />
          <WriteGuide
            withTemplates={Boolean(lead)}
            labels={{
              stepsLabel: V.stepsLabel,
              steps: L.feed.steps,
              templatesTitle: L.feed.templatesTitle,
              templates: L.templates,
              rules: L.mine.rules,
            }}
          />
        </Panel>
      </div>
    </MotionExperience>
  );
}
