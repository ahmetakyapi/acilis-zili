import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CheckCircle, XCircle } from "@phosphor-icons/react/dist/ssr";
import editorial from "@/components/article/ArticleEditorial.module.css";
import { ArticleBody } from "@/components/article/ArticleBody";
import { AdminPanel, AdminPanelTitle, adminInput } from "@/components/admin/AdminUI";
import { approvePostAction, rejectPostAction } from "@/app/actions/moderation";
import { buttonClass, PageHeader } from "@/components/ui/primitives";
import { ADMIN_SECTIONS, adminDocTitle } from "@/lib/admin-sections";
import { requireAdmin } from "@/lib/admin";
import { getPostForReview } from "@/lib/user-post-data";
import { cn } from "@/lib/utils";

/**
 * Moderasyon detayı — yazının TAMAMI yayındaki çizimle (ArticleBody,
 * editoryal). Moderatör sitede görünmeyecek bir çizimi denetlememeli
 * (önizleme kuralıyla aynı). Onay/red gövdenin ALTINDA: karar okuduktan
 * sonra verilir. Grafik bloğu burada gerçek grafikle çizilir — sayfa
 * normal bir sunucu bileşeni, istemci manifesti tam.
 */

export const metadata = { title: adminDocTitle("Yazı", ADMIN_SECTIONS.moderation.title) };

const DURUM_ADI: Record<string, string> = {
  draft: "Taslak",
  pending: "Kuyrukta",
  published: "Yayında",
  rejected: "Geri Gönderildi",
};

export default async function ModerationDetailPage(props: PageProps<"/admin/moderasyon/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  const post = await getPostForReview(id);
  if (!post) notFound();

  return (
    <div className="flex flex-col gap-5">
      <nav>
        <Link
          href="/admin/moderasyon"
          className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-muted transition-colors hover:text-strong sm:min-h-0"
        >
          <ArrowLeft size={14} aria-hidden />
          Kuyruğa Dön
        </Link>
      </nav>

      <PageHeader title={post.title} subtitle={post.dek} embedded />
      <p className="text-small text-muted">
        <span className="font-semibold text-body">{post.author}</span>
        {" · "}
        {DURUM_ADI[post.status] ?? post.status}
        {post.submittedAt && (
          <>
            {" · "}
            <time dateTime={post.submittedAt.toISOString()} className="numeral">
              {new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(post.submittedAt)}
            </time>
          </>
        )}
        {post.symbols.length > 0 && <span className="numeral"> · {post.symbols.join(", ")}</span>}
        {post.status === "published" && (
          <>
            {" · "}
            <a
              href={`/topluluk/${post.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 font-semibold text-primary"
            >
              Yayındaki Hâli
              <ArrowUpRight size={12} aria-hidden />
            </a>
          </>
        )}
      </p>

      <AdminPanel>
        <AdminPanelTitle>Gövde</AdminPanelTitle>
        <div className="px-4 py-5 sm:px-6">
          <ArticleBody
            markdown={post.bodyMd}
            locale={post.locale}
            variant="editorial"
            className={editorial.prose}
          />
        </div>
      </AdminPanel>

      {post.status === "pending" && (
        <AdminPanel>
          <AdminPanelTitle>Karar</AdminPanelTitle>
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
            <form action={approvePostAction}>
              <input type="hidden" name="id" value={post.id} />
              {/* Onay OKUNAN sürüme bağlanır (TOCTOU) — eylem damga
                  eşleşmezse hiçbir şey yazmaz, sayfa yenilenip yeniden okunur. */}
              <input type="hidden" name="seen" value={post.updatedAt.toISOString()} />
              <button type="submit" className={buttonClass({})}>
                <CheckCircle weight="duotone" size={16} aria-hidden />
                Onayla ve Yayımla
              </button>
            </form>
            <form action={rejectPostAction} className="flex flex-col gap-2 border-t border-line-soft pt-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-small font-semibold text-body">Red Gerekçesi</span>
                <textarea
                  name="note"
                  rows={3}
                  required
                  maxLength={500}
                  placeholder="Yazara görünür: neyi düzeltirse yayımlanır?"
                  className={cn(adminInput, "w-full py-2.5")}
                />
              </label>
              <button type="submit" className={buttonClass({ variant: "ghost", className: "w-fit text-down" })}>
                <XCircle weight="duotone" size={16} aria-hidden />
                Geri Gönder
              </button>
            </form>
          </div>
        </AdminPanel>
      )}
    </div>
  );
}
