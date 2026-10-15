import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { previewUserPostBody } from "@/app/actions/user-post-preview";
import { PostEditor } from "@/components/community/PostEditor";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { PageHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { findPostTemplate } from "@/lib/post-templates";

export const generateMetadata = pageMetadata({
  path: "/yazilarim/yeni",
  robots: { index: false, follow: false },
  tr: { title: "Yeni Yazı", description: "Topluluk için yeni bir yazı yaz." },
  en: { title: "New Post", description: "Write a new community post." },
});

export default async function NewPostPage(props: PageProps<"/yazilarim/yeni">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/yazilarim/yeni");
  const { locale, t } = await getI18n();
  const L = t.community;
  const dil = locale === "en" ? "en" : "tr";

  /* `?sablon=` /topluluk'taki "Şablonla Başla" bağlantılarından gelir;
     tanınmayan değer sessizce boş sayfa. Şablonun önizlemesi sunucuda,
     sayfayla birlikte çizilir (useOnizleme sözleşmesi) — editör boş
     önizlemeyle açılıp 700 ms sonra dolmaz. */
  const { sablon } = await props.searchParams;
  const template = findPostTemplate(sablon);
  const ilkOnizleme = template
    ? await previewUserPostBody(template.content[dil].body).catch(() => null)
    : null;

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <PageHeader
        title={L.mine.newPost}
        subtitle={L.editor.newSubtitle}
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
      {/* key: şablon değişince editör yeniden kurulur (aynı sayfada başka
          bir `?sablon=` bağlantısına basılırsa durum eskide kalmasın). */}
      <PostEditor
        key={template?.key ?? "bos"}
        post={null}
        ilkOnizleme={ilkOnizleme}
        labels={L.editor}
        templateLabels={L.templates}
        locale={dil}
        template={template}
      />
    </MotionExperience>
  );
}
