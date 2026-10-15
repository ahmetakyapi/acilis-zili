import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PostEditor } from "@/components/community/PostEditor";
import { PageHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";

export const generateMetadata = pageMetadata({
  path: "/yazilarim/yeni",
  robots: { index: false, follow: false },
  tr: { title: "Yeni Yazı", description: "Topluluk için yeni bir yazı yaz." },
  en: { title: "New Post", description: "Write a new community post." },
});

export default async function NewPostPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/yazilarim/yeni");
  const { locale, t } = await getI18n();
  const L = t.community;

  return (
    <MotionExperience className={`${polish.page} mx-auto w-full max-w-3xl`}>
      <ScrollProgress />
      <PageHeader title={L.mine.newPost} subtitle={L.editor.subtitle} />
      {/* İlk önizleme boş: yeni yazının çizilecek gövdesi yok. */}
      <PostEditor post={null} ilkOnizleme={null} labels={L.editor} locale={locale === "en" ? "en" : "tr"} />
    </MotionExperience>
  );
}
