import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { previewUserPostBody } from "@/app/actions/user-post-preview";
import { PostEditor } from "@/components/community/PostEditor";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { PageHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getOwnPost } from "@/lib/user-post-data";

export const generateMetadata = pageMetadata({
  path: "/yazilarim",
  robots: { index: false, follow: false },
  tr: { title: "Yazıyı Düzenle", description: "Topluluk yazını düzenle." },
  en: { title: "Edit Post", description: "Edit your community post." },
});

export default async function EditPostPage(props: PageProps<"/yazilarim/[id]">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/yazilarim");
  const { id } = await props.params;
  const post = await getOwnPost(session.user.id, id);
  /* Başkasının yazısı da, olmayan yazı da aynı 404 — sorgu userId koşullu. */
  if (!post) notFound();

  const { t } = await getI18n();
  const L = t.community;
  /* İlk çizim sunucudan, sayfayla birlikte (useOnizleme sözleşmesi).
     Eylem artık sınırda FIRLATIYOR; sayfa düşmesin, editör boş önizlemeyle
     açılsın — ilk duraklamada yeniden çizilir. */
  const ilkOnizleme = await previewUserPostBody(post.bodyMd).catch(() => null);

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <PageHeader
        title={post.title}
        subtitle={L.editor.editSubtitle}
        action={
          <Link
            href="/yazilarim"
            className="tap-44 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft weight="bold" size={13} aria-hidden />
            {L.editor.backToPosts}
          </Link>
        }
      />
      <PostEditor post={post} ilkOnizleme={ilkOnizleme} labels={L.editor} templateLabels={L.templates} locale={post.locale === "en" ? "en" : "tr"} />
    </MotionExperience>
  );
}
