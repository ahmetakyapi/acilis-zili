import Link from "next/link";
import { PageHeader } from "@/components/ui/primitives";
import { AdminEmpty, AdminPanel, AdminPanelError, AdminPanelTitle } from "@/components/admin/AdminUI";
import { ADMIN_SECTIONS, adminDocTitle } from "@/lib/admin-sections";
import { requireAdmin } from "@/lib/admin";
import { adminStamp } from "@/lib/admin-format";
import { getPendingPosts } from "@/lib/user-post-data";

/**
 * Moderasyon — topluluk yazılarının onay kuyruğu (15 Ekim).
 *
 * Kuyruk ESKİDEN YENİYE: ilk gönderen ilk okunur, uzun bekleyen yazı
 * listenin dibinde unutulmaz. Satır detaya götürür; onay/red orada —
 * metni OKUMADAN basılabilecek bir onay düğmesini listeye koymak,
 * moderasyonun kendisini atlamak olurdu.
 */

export const metadata = { title: adminDocTitle(ADMIN_SECTIONS.moderation.title) };

export default async function ModerationPage() {
  await requireAdmin();
  const posts = await getPendingPosts();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={ADMIN_SECTIONS.moderation.title}
        subtitle={ADMIN_SECTIONS.moderation.subtitle}
        embedded
      />
      <AdminPanel>
        <AdminPanelTitle>Bekleyen Yazılar</AdminPanelTitle>
        {posts === null ? (
          <AdminPanelError>
            `user_posts` tablosu okunamadı — migration 0034 üretimde uygulanmamış olabilir.
          </AdminPanelError>
        ) : posts.length === 0 ? (
          <AdminEmpty title="Kuyruk Boş" hint="Bekleyen yazı yok; yeni gönderim gelince burada listelenir." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/admin/moderasyon/${post.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 transition-colors hover:bg-primary-tint sm:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-strong">
                      {post.title}
                    </span>
                    <span className="block truncate text-small text-muted">{post.dek}</span>
                  </span>
                  <span className="shrink-0 text-small font-semibold text-body">{post.author}</span>
                  {post.submittedAt && (
                    <time
                      dateTime={post.submittedAt.toISOString()}
                      className="numeral shrink-0 text-tiny text-muted"
                    >
                      {/* İSTANBUL SAATİ (20 Ekim): dilimsiz biçimleyici
                          sunucunun UTC'siyle basıp paneldeki öteki her
                          damgadan üç saat geri kalıyordu. */}
                      {adminStamp(post.submittedAt)}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>
    </div>
  );
}
