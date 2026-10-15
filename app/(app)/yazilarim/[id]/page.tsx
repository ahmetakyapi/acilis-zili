import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { previewUserPostBody } from "@/app/actions/user-post-preview";
import { PostEditor } from "@/components/community/PostEditor";
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
    <MotionExperience className={`${polish.page} mx-auto w-full max-w-3xl`}>
      <ScrollProgress />
      <PageHeader title={post.title} subtitle={L.editor.subtitle} />
      <PostEditor post={post} ilkOnizleme={ilkOnizleme} labels={L.editor} locale={post.locale === "en" ? "en" : "tr"} />
    </MotionExperience>
  );
}
