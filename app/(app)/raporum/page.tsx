import { MotionExperience, Reveal, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import styles from "@/components/report/BellReport.module.css";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { InkCanvas } from "@/components/ink/InkCanvas";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { loadBellReport } from "@/lib/report-data";
import { directionOf, formatPercent } from "@/lib/utils";

/* Kişisel ekran — dizine girmez (sayfa + NOINDEX_PATHS). */
export const generateMetadata = pageMetadata({
  path: "/raporum",
  robots: { index: false, follow: false },
  tr: { title: "Zil Raporu", description: "Açılış Zili'ndeki yolculuğunun kişisel özeti." },
  en: { title: "Bell Report", description: "A personal summary of your time on Opening Bell." },
});

/**
 * ZİL RAPORU (15 Ekim) — kaydırmayla ilerleyen kişisel özet.
 *
 * Bölüm başına TEK sayı ve bir cümle; sayılar beyan değil kayıt
 * (lib/report-data.ts). Portföy bölümü vitrinle AYNI hesaptan gelir —
 * profilde görünen getiri ile burada görünen asla ayrışmaz (aynı sayı aynı
 * kaynaktan). Veri olmayan bölüm basılmaz; boş bölüm "0" demek yerine
 * hiç durmaz, yalnız üyelik bölümü her hesapta vardır.
 *
 * Sayfa yalnız sahibine: tutar burada da yok (vitrin kuralı) — rapor
 * paylaşılabilir bir şey olarak tasarlanırsa sızdırmasın diye bugünden.
 */
export default async function BellReportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/raporum");

  const { locale, t } = await getI18n();
  const L = t.bellReport;
  const report = await loadBellReport(session.user.id, locale, t.profile.showcase.otherSector);
  if (!report) redirect("/giris?devam=/raporum");

  const number = (n: number) => n.toLocaleString(locale === "tr" ? "tr-TR" : "en-US");
  const joined = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(report.joinedAt);

  const best = report.showcase?.moves[0] ?? null;
  const worst =
    report.showcase && report.showcase.moves.length > 1
      ? report.showcase.moves[report.showcase.moves.length - 1]
      : null;

  let chapter = 0;
  const next = () => String(++chapter).padStart(2, "0");

  return (
    <MotionExperience className={`${polish.page} ${styles.report}`}>
      <ScrollProgress />

      <section className={styles.opening}>
        {/* Sahne bir kez oynar ve oturur; hareketi azaltana son kare. */}
        <InkCanvas scene="heroRing" className={styles.scene} />
        <h1 className="display-ink text-4xl font-black tracking-tight sm:text-5xl">{L.title}</h1>
        <p className={styles.line}>{L.intro.replace("{name}", report.username)}</p>
      </section>

      <Reveal>
        <section className={styles.chapter}>
          <span className={styles.index}>{next()}</span>
          <h2 className={styles.title}>{L.memberTitle}</h2>
          <p className={styles.figure}>
            <RollingFigure value={number(report.memberDays)} />
            <span className={styles.unit}>{L.days}</span>
          </p>
          <p className={styles.line}>
            {L.memberLine.replace("{date}", joined).replace("{sessions}", number(report.tradingDays))}
          </p>
          <p className={styles.note}>{L.sessionsNote}</p>
        </section>
      </Reveal>

      {report.listSymbols > 0 && (
        <Reveal>
          <section className={styles.chapter}>
            <span className={styles.index}>{next()}</span>
            <h2 className={styles.title}>{L.watchTitle}</h2>
            <p className={styles.figure}>
              <RollingFigure value={number(report.listSymbols)} />
              <span className={styles.unit}>{L.symbols}</span>
            </p>
            <p className={styles.line}>
              {(report.lists === 1 ? L.watchLineOne : L.watchLine).replace("{lists}", number(report.lists))}
            </p>
          </section>
        </Reveal>
      )}

      {report.alertsTotal > 0 && (
        <Reveal>
          <section className={styles.chapter}>
            <span className={styles.index}>{next()}</span>
            <h2 className={styles.title}>{L.alertsTitle}</h2>
            <p className={styles.figure}>
              <RollingFigure value={number(report.alertsHit)} />
              <span className={styles.unit}>/ {number(report.alertsTotal)}</span>
            </p>
            <p className={styles.line}>{L.alertsLine}</p>
          </section>
        </Reveal>
      )}

      {report.showcase && (
        <Reveal>
          <section className={styles.chapter}>
            <span className={styles.index}>{next()}</span>
            <h2 className={styles.title}>{L.portfolioTitle}</h2>
            {/* Renk işaretten: artı yeşil, eksi kırmızı (CLAUDE.md). */}
            <p
              className={`${styles.figure} ${
                directionOf(report.showcase.returnPct) === "up"
                  ? styles.figureUp
                  : directionOf(report.showcase.returnPct) === "down"
                    ? styles.figureDown
                    : ""
              }`}
            >
              {formatPercent(report.showcase.returnPct, locale, 1)}
            </p>
            <p className={styles.line}>
              {report.showcase.spyReturnPct !== null
                ? L.portfolioLineSpy.replace("{spy}", formatPercent(report.showcase.spyReturnPct, locale, 1))
                : L.portfolioLine}
            </p>
            {(best || worst) && (
              <div className={styles.duo}>
                {best && (
                  <div className={styles.duoCell}>
                    <span className={styles.duoLabel}>{L.best}</span>
                    <span className={styles.duoValue}>{best.symbol}</span>
                    <span className={directionOf(best.returnPct) === "down" ? "text-down" : "text-up"}>
                      {formatPercent(best.returnPct, locale, 1)}
                    </span>
                  </div>
                )}
                {worst && worst.symbol !== best?.symbol && (
                  <div className={styles.duoCell}>
                    <span className={styles.duoLabel}>{L.worst}</span>
                    <span className={styles.duoValue}>{worst.symbol}</span>
                    <span className={directionOf(worst.returnPct) === "up" ? "text-up" : "text-down"}>
                      {formatPercent(worst.returnPct, locale, 1)}
                    </span>
                  </div>
                )}
              </div>
            )}
            <p className={styles.note}>{L.portfolioNote}</p>
          </section>
        </Reveal>
      )}

      {report.posts > 0 && (
        <Reveal>
          <section className={styles.chapter}>
            <span className={styles.index}>{next()}</span>
            <h2 className={styles.title}>{L.postsTitle}</h2>
            <p className={styles.figure}>
              <RollingFigure value={number(report.posts)} />
              <span className={styles.unit}>{L.posts}</span>
            </p>
            <p className={styles.line}>{L.postsLine}</p>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section className={styles.chapter}>
          <span className={styles.index}>{next()}</span>
          <h2 className={styles.title}>{L.nextTitle}</h2>
          <p className={styles.line}>{report.profilePublic ? L.nextLinePublic : L.nextLine}</p>
          <div className={styles.links}>
            <Link href={`/u/${report.username}`}>{L.toProfile}</Link>
            <Link href="/yazilarim/yeni">{L.toWrite}</Link>
            <Link href="/tarama">{L.toScreener}</Link>
          </div>
        </section>
      </Reveal>
    </MotionExperience>
  );
}
