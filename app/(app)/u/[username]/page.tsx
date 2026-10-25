import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { notFound } from "next/navigation";
import { ArrowUpRight, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ScaleBar } from "@/components/markets/CompareScale";
import { SectorStrip } from "@/components/portfolio/PortfolioVisuals";
import { DataStamp, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { ReturnTimeline } from "@/components/portfolio/ReturnTimeline";
import { Suspense } from "react";
import { initialsOf } from "@/lib/avatars";
import { getUserWatchlists } from "@/lib/data";
import { formatIsoMonth } from "@/lib/fx";
import { getI18n } from "@/lib/i18n";
import { metaDescription, missingMetadata } from "@/lib/page-meta";
import { loadShowcase } from "@/lib/profile-showcase";
import {
  getAuthorProfile,
  getOwnerProfile,
  getPublicProfile,
  profileBadges,
  type PublicProfile,
} from "@/lib/profile-data";
import { pageAlternates } from "@/lib/site";
import { getPublishedPostsByUser } from "@/lib/user-post-data";
import { listUserReports } from "@/lib/ai-analysis-reports";
import { verdictTextClass } from "@/lib/analysis";
import {
  cn,
  directionOf,
  directionText,
  formatPercent,
  formatPercentPlain,
  normalizeUsername,
} from "@/lib/utils";

/**
 * Herkese açık üye profili — /u/[kullanici].
 *
 * VARSAYILAN GİZLİ ve gizliyle yok AYNI CEVAP: profil satırı olmayan,
 * profili kapalı duran ve hiç var olmayan kullanıcı adı üçü de 404.
 * Girişteki kullanıcı adı sayım orakülü bilinçli kapalı
 * (app/actions/auth.ts → DUMMY_HASH); bu sayfa onu yeniden açmamalı.
 * Tek istisna SAHİBİN KENDİSİ: kendi adresini gizliyken de görür, sayfanın
 * tepesinde yalnızca ona görünen "Profilin Gizli" paneli durur — profili
 * açmadan nasıl görüneceğini bilsin.
 */

/** Sembol çipi sayısı liste başına tavanlı; kalanı "+n" ile söylenir. */
const CHIP_LIMIT = 16;

export async function generateMetadata(props: PageProps<"/u/[username]">) {
  const { username } = await props.params;
  const { locale, t } = await getI18n();
  const profile = await getPublicProfile(username);
  if (profile) {
    return {
      title: `${profile.username} · ${t.profile.title}`,
      description: metaDescription(profile.bio ?? t.profile.subtitle),
      alternates: pageAlternates(`/u/${profile.username}`, locale),
    };
  }
  /* Sahip önizlemesi: gövde gizli profili sahibine çiziyor; başlık
     "Bulunamadı" olmamalı (15 Ekim incelemesi). Dizine girmez — gizli
     önizlemenin canonical'ı ve hreflang'i de yok. */
  const session = await auth();
  const viewer = session?.user;
  if (viewer?.id && viewer.name && normalizeUsername(viewer.name) === normalizeUsername(username)) {
    const own = await getOwnerProfile(viewer.id);
    if (own) {
      return {
        title: `${own.username} · ${t.profile.title}`,
        description: metaDescription(t.profile.subtitle),
        robots: { index: false, follow: false },
      };
    }
  }
  /* Yazar görünümü (gövdedeki düşüşün aynısı, `hasAuthorView`): yayını ya
     da raporu olan üyenin sayfası gerçek başlığıyla açılır. */
  const author = await getAuthorProfile(username);
  if (author && (await hasAuthorView(author.userId))) {
    return {
      title: `${author.username} · ${t.profile.title}`,
      description: metaDescription(t.profile.subtitle),
      alternates: pageAlternates(`/u/${author.username}`, locale),
    };
  }
  return missingMetadata(locale);
}

/* Gizli profilde yazar görünümünün TEK ölçüsü: yayında yazı ya da Claude
   raporu. Gövde ile `generateMetadata` koşulu ayrı yazıyordu ve rapor
   yalnız gövdeye eklenmişti: yalnız raporu olan üyenin sayfası 200 dönüp
   "Bulunamadı" başlığı ve noindex taşıyordu (20 Ekim). İki okuma da
   `cache()`li; gövde ikinci kez sorgu ödemiyor. */
async function hasAuthorView(userId: string): Promise<boolean> {
  return (
    (await getPublishedPostsByUser(userId)).length > 0 ||
    (await listUserReports(userId)).length > 0
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-brass/40 bg-brass/10 px-2 py-0.5 text-tiny font-semibold text-strong">
      {children}
    </span>
  );
}

export default async function ProfilePage(props: PageProps<"/u/[username]">) {
  const { username: raw } = await props.params;
  const target = normalizeUsername(raw);
  const [{ locale, t }, session] = await Promise.all([getI18n(), auth()]);

  const viewer = session?.user;
  const isOwner = Boolean(
    viewer?.id && viewer.name && normalizeUsername(viewer.name) === target,
  );

  let profile: PublicProfile | null =
    isOwner && viewer?.id ? await getOwnerProfile(viewer.id) : await getPublicProfile(raw);
  /* Gizli profil ama yayında yazısı ya da raporu var: yazar görünümü —
     yalnız künye, yazılar ve raporlar (gerekçe lib/profile-data.ts →
     getAuthorProfile). Yazısız ve raporsuz hesap yine 404: sayım orakülü
     yazarlar dışında kapalı kalır. */
  if (!profile && !isOwner) {
    const author = await getAuthorProfile(raw);
    if (author && (await hasAuthorView(author.userId))) profile = author;
  }
  if (!profile) notFound();

  const previewOnly = isOwner && !profile.isPublic;
  const [badges, lists, showcase, posts, reports] = await Promise.all([
    profileBadges(profile.joinedAt),
    profile.showWatchlists
      ? getUserWatchlists(profile.userId).then((all) => all.filter((list) => list.items.length > 0))
      : Promise.resolve([]),
    profile.showPortfolio
      ? loadShowcase(profile.userId, locale, t.profile.showcase.otherSector)
      : Promise.resolve(null),
    /* Yayındaki yazılar görünürlük anahtarına bağlı DEĞİL: yayımlamak zaten
       açık bir edim, yazı /topluluk'ta kullanıcı adıyla duruyor. */
    getPublishedPostsByUser(profile.userId),
    /* Claude raporları hisse sayfalarında oluşturanın adıyla zaten açık
       (lib/ai-analysis-reports.ts kararı); profil yalnız kişi bazında toplar. */
    listUserReports(profile.userId),
  ]);
  const hasBlocks = lists.length > 0 || showcase !== null || posts.length > 0 || reports.length > 0;

  const joinedLabel = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(profile.joinedAt);

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <PageHeader title={profile.username} subtitle={t.profile.subtitle} />

      {previewOnly && (
        <Panel className="border-brass/40">
          <PanelHeader title={t.profile.privateTitle} />
          <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <p className="flex items-start gap-2 text-small leading-relaxed text-body">
              <LockSimple weight="duotone" size={16} className="mt-0.5 shrink-0 text-brass" />
              {t.profile.privateHint}
            </p>
            <Link
              href="/ayarlar"
              className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-hover sm:min-h-0"
            >
              {t.profile.privateCta}
              <ArrowUpRight size={14} aria-hidden />
            </Link>
          </div>
        </Panel>
      )}

      {/* Künye şeridi — panel değil: ekran düzeninde başlığın altındaki
          kimlik katmanı (CLAUDE.md, ekran sırası 2). */}
      <section className="flex items-start gap-4">
        <AvatarTile
          icon={profile.avatar?.icon ?? null}
          color={profile.avatar?.color}
          initials={initialsOf(profile.username, locale)}
          className="size-16 rounded-(--radius-lg) text-xl sm:size-20"
        />
        <div className="flex min-w-0 flex-col gap-1.5 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-strong">{profile.username}</span>
            {badges.map((badge) => (
              <Badge key={badge.kind}>
                {badge.kind === "early"
                  ? t.profile.badgeEarly
                  : t.profile.badgeYear.replace("{n}", String(badge.n))}
              </Badge>
            ))}
            {posts.length > 0 && <Badge>{t.profile.badgeAuthor}</Badge>}
          </div>
          <p className="text-small text-muted">
            {t.profile.joined} ·{" "}
            <time dateTime={profile.joinedAt.toISOString().slice(0, 10)}>{joinedLabel}</time>
          </p>
          {profile.bio && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-body [overflow-wrap:anywhere]">{profile.bio}</p>
          )}
          {!hasBlocks && !previewOnly && (
            <p className="text-small leading-relaxed text-muted">{t.profile.quiet}</p>
          )}
        </div>
      </section>

      {/* İKİ KOLON (15 Ekim): kap artık diğer ekranlarla aynı genişlikte;
          tek sütun 1280'de satır uzunluğunu iki katına çıkarıyordu. Solda
          kanıtlı içerik (vitrin, yazılar), sağda kısa listeler. Kolonlardan
          biri boşsa ızgara tek sütun kalır — yarım ekran boş durmaz. */}
      <div
        className={
          (showcase || posts.length > 0) && (reports.length > 0 || lists.length > 0)
            ? "grid items-start gap-5 lg:grid-cols-2"
            : "grid gap-5"
        }
      >
        <div className="flex min-w-0 flex-col gap-5 empty:hidden">
          {showcase && (
            <Panel>
              <PanelHeader
                title={t.profile.showcase.title}
                /* Başlangıç AY hassasiyetinde: gün bazında alış tarihi KVKK'nın
                   "hiçbir durumda gösterilmez" sınıfında (content/legal.ts) —
                   ilk sürüm günü basıyordu, incelemede yakalandı (15 Ekim). */
                meta={`${
                  showcase.symbolCount === 1
                    ? t.profile.showcase.metaOne
                    : t.profile.showcase.meta.replace("{n}", String(showcase.symbolCount))
                } · ${t.profile.showcase.since} ${formatIsoMonth(showcase.sinceDay.slice(0, 7), locale)}`}
              />
              <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
                {/* Ölçü ızgarası: iki getiri AYNI HATTA biter; karşılaştırılan
                    büyüklük bir de çizgi olarak okunur (ScaleBar, işaretli). */}
                <div className="grid grid-cols-2 gap-5">
                  {(() => {
                    const maxAbs = Math.max(
                      Math.abs(showcase.returnPct),
                      Math.abs(showcase.spyReturnPct ?? 0),
                      0.01,
                    );
                    const figure = (label: string, hint: string, value: number | null) => (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-tiny font-semibold text-muted">
                          {label}
                        </span>
                        <span
                          className={`numeral text-2xl font-bold tracking-tight ${directionText(directionOf(value))}`}
                        >
                          {formatPercent(value, locale, 1)}
                        </span>
                        <ScaleBar
                          ratio={value === null ? 0 : Math.max(-1, Math.min(1, value / maxAbs))}
                          signed={showcase.returnPct < 0 || (showcase.spyReturnPct ?? 0) < 0}
                          tone="signal"
                        />
                        <span className="text-tiny leading-relaxed text-muted">{hint}</span>
                      </div>
                    );
                    return (
                      <>
                        {figure(
                          t.profile.showcase.returnLabel,
                          t.profile.showcase.returnHint,
                          showcase.returnPct,
                        )}
                        {figure(
                          t.profile.showcase.spyLabel,
                          t.profile.showcase.spyHint,
                          showcase.spyReturnPct,
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* ALIŞTAN BUGÜNE (25 Ekim): iki yalın sayının NE ZAMAN
                    ayrıştığı. Yalnız bu blokta, yani sahip portföy bloğunu
                    açtıysa; tarih AY hassasiyetinde, tutar yok (gerekçe
                    components/portfolio/ReturnTimeline.tsx). Uçları vitrinle
                    aynı kotasyon paketinden: çizgi tam bu iki sayıda biter. */}
                <Suspense fallback={<Skeleton className="h-[236px] w-full" />}>
                  <ReturnTimeline
                    userId={profile.userId}
                    quoteKey="showcase"
                    variant="profile"
                    locale={locale}
                    t={t}
                  />
                </Suspense>
                {/* Ağırlıklar: çubuk MUTLAK pay (%50 = yarım kulvar) — görece
                    ölçek en büyük dilimi hep tam basıp payları abartırdı. */}
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-tiny font-semibold text-muted">
                    {t.profile.showcase.weightsTitle}
                  </h3>
                  <ul className="flex flex-col">
                    {showcase.weights.map((weight) => (
                      <li
                        key={weight.symbol}
                        className="grid grid-cols-[88px_minmax(0,1fr)_56px] items-center gap-3 py-1.5"
                      >
                        <Link
                          href={`/hisse/${weight.symbol}`}
                          className="-my-1.5 inline-flex min-h-11 items-center truncate py-1.5 font-mono text-xs font-semibold text-body transition-colors hover:text-strong sm:-my-0 sm:min-h-0 sm:py-0"
                        >
                          {weight.symbol}
                        </Link>
                        <ScaleBar ratio={weight.pct / 100} signed={false} tone="neutral" />
                        <span className="numeral text-right text-xs font-semibold text-strong">
                          {formatPercentPlain(weight.pct, locale, 1)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {showcase.sectors.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-tiny font-semibold text-muted">
                      {t.profile.showcase.sectorsTitle}
                    </h3>
                    <SectorStrip weights={showcase.sectors} locale={locale} />
                  </div>
                )}

                {/* Künye ve uyarılar panelin İÇİNDE, hairline üstünde. */}
                <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
                  <p className="text-tiny leading-relaxed text-muted">
                    {t.profile.showcase.note}
                    {showcase.excludedCount > 0 &&
                      ` ${t.profile.showcase.excluded.replace("{n}", String(showcase.excludedCount))}`}
                    {showcase.spyReturnPct !== null &&
                      showcase.spyCoverage < 0.995 &&
                      ` ${t.profile.showcase.spyPartial.replace("{pct}", String(Math.round(showcase.spyCoverage * 100)))}`}
                  </p>
                  <DataStamp
                    source={showcase.source}
                    at={showcase.asOf}
                    stale={showcase.stale}
                    locale={locale}
                    labels={t.data}
                  />
                </div>
              </div>
            </Panel>
          )}

          {posts.length > 0 && (
            <Panel>
              <PanelHeader
                title={t.profile.postsTitle}
                meta={
                  posts.length === 1
                    ? t.profile.postCountOne
                    : t.profile.postCount.replace("{n}", String(posts.length))
                }
              />
              <ul className="divide-y divide-line-soft px-4 sm:px-5">
                {posts.map((post) => (
                  <li key={post.id} className="py-3">
                    <Link href={`/topluluk/${post.slug}`} className="group flex flex-col gap-0.5">
                      <span className="text-base font-semibold text-strong transition-colors group-hover:text-primary">
                        {post.title}
                      </span>
                      <span className="flex items-center gap-2 text-tiny text-muted">
                        {post.publishedAt && (
                          <time dateTime={post.publishedAt.toISOString().slice(0, 10)} className="numeral">
                            {new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }).format(post.publishedAt)}
                          </time>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

        </div>
        <div className="flex min-w-0 flex-col gap-5 empty:hidden">
          {reports.length > 0 && (
            <Panel>
              <PanelHeader
                title={t.profile.reportsTitle}
                meta={t.profile.reportCount.replace("{n}", String(reports.length))}
              />
              <ul className="divide-y divide-line-soft px-4 sm:px-5">
                {reports.map((report) => (
                  <li key={report.id}>
                    <Link
                      href={`/claude/${encodeURIComponent(report.symbol)}?sekme=rapor&rapor=${report.id}`}
                      className="grid min-h-11 grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 transition-colors hover:text-primary"
                    >
                      <span className="font-mono text-sm font-bold text-strong">{report.symbol}</span>
                      <span className="min-w-0 truncate text-small text-muted">
                        {report.horizon === "medium" ? t.aiAnalysis.focus.selection : t.aiAnalysis.focus.technical}
                        {" · "}
                        {new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(report.generatedAt))}
                      </span>
                      {/* Görüş üçlüsü site genelinde aynı (25 Ekim renk kararı):
                          tek kaynak `verdictTextClass` (lib/analysis.ts). "Veri
                          Yetersiz" bir görüş değil: pirince düşüyordu, artık sönük. */}
                      <span
                        className={cn(
                          "text-small font-bold",
                          report.verdict === "insufficient" ? "text-muted" : verdictTextClass(report.verdict),
                        )}
                      >
                        {t.aiAnalysis.verdicts[report.verdict]}
                        {report.score !== null && <span className="numeral ml-1.5 font-semibold text-muted">{report.score}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="border-t border-line-soft px-4 py-3 text-tiny leading-relaxed text-muted sm:px-5">
                {t.profile.reportsNote}
              </p>
            </Panel>
          )}

          {lists.length > 0 && (
            <Panel>
              <PanelHeader title={t.profile.watchlistsTitle} />
              <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
                {lists.map((list) => (
                  <div key={list.id} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold text-strong">{list.name}</h3>
                      <span className="shrink-0 text-tiny text-muted">
                        {list.items.length === 1
                          ? t.profile.listCountOne
                          : t.profile.listCount.replace("{n}", String(list.items.length))}
                      </span>
                    </div>
                    <ul className="flex flex-wrap gap-1.5">
                      {list.items.slice(0, CHIP_LIMIT).map((item) => (
                        <li key={item.id}>
                          <Link
                            href={`/hisse/${item.symbol}`}
                            className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface-sunken px-3 font-mono text-xs font-semibold text-body transition-colors hover:border-line-focus hover:text-strong sm:min-h-8 sm:px-2.5"
                          >
                            {item.symbol}
                          </Link>
                        </li>
                      ))}
                      {list.items.length > CHIP_LIMIT && (
                        <li className="inline-flex min-h-11 items-center px-1 text-xs font-semibold text-muted sm:min-h-8">
                          {t.profile.moreSymbols.replace("{n}", String(list.items.length - CHIP_LIMIT))}
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
                {/* Uyarı panelin İÇİNDE, hairline ile ayrılmış düz paragraf —
                    yeni kutu açılmaz (CLAUDE.md, ekran sırası 6). */}
                <p className="border-t border-line-soft pt-3 text-tiny leading-relaxed text-muted">
                  {t.profile.watchlistNote}
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </MotionExperience>
  );
}
