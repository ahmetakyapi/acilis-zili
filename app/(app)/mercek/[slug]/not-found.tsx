import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EmptyState } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";

/* 404'te tek robots etiketi ve doğru başlık — gerekçe lib/page-meta.ts. */
export { notFoundMetadata as generateMetadata } from "@/lib/page-meta";

/** Olmayan mercek yazısı — yumuşak 404 değil, gerçek 404. Gerekçe: `haberler/[id]/not-found.tsx`. */
export default async function StoryNotFound() {
  const { t } = await getI18n();

  return (
    <>
      <EmptyState
        titleAs="h1"
        scene="searching"
        title={t.stories.notFound}
        hint={t.stories.notFoundHint}
        action={
          <Link
            href="/mercek"
            className="text-small font-semibold text-primary"
          >
            {t.stories.backToList}
          </Link>
        }
      />
    </>
  );
}
