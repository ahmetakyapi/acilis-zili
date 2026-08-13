import Link from "next/link";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";

/** Olmayan mercek yazısı — yumuşak 404 değil, gerçek 404. Gerekçe: `haberler/[id]/not-found.tsx`. */
export default async function StoryNotFound() {
  const { t } = await getI18n();

  return (
    <Panel>
      <EmptyState
        title={t.stories.notFound}
        hint={t.stories.notFoundHint}
        action={
          <Link
            href="/mercek"
            className="text-[12.5px] font-semibold text-primary"
          >
            {t.stories.backToList}
          </Link>
        }
      />
    </Panel>
  );
}
