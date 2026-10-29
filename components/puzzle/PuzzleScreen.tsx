import { cookies } from "next/headers";
import { Cards, CaretDown, ChartBar, ChartLineUp, Database, Keyboard, LockSimpleOpen, Swatches } from "@phosphor-icons/react/dist/ssr";
import { PageShare } from "@/components/article/PageShare";
import { GuideHint } from "@/components/article/GuideHint";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/site";
import { ARCHIVE_COOKIE, PROGRESS_COOKIE, PUZZLE_ZONE, firstSentence, neighborHrefs, parseProgressCookie, puzzleDayKey, puzzleNumber } from "@/lib/stock-puzzle";
import { evaluatePuzzle } from "@/lib/stock-puzzle-data";
import { GameNav } from "./GameNav";
import { PuzzleLeaderboard } from "./PuzzleLeaderboard";
import { StockPuzzle } from "./StockPuzzle";
import styles from "./PuzzleScreen.module.css";

/**
 * "Hisseyi Bil" ekranı — günlük bulmaca (`/bulmaca`) ve arşiv günü
 * (`/bulmaca/[gun]`) aynı ekran (25 Ekim). Fark: arşivde başlığın altında
 * "Arşivden oynuyorsun" künyesi ve bugüne dönüş, oyun seriye sayılmaz.
 *
 * Durum okurun ilerleme çerezinden (`PROGRESS_COOKIE` günlük,
 * `ARCHIVE_COOKIE` son oynanan arşiv günü): yarım ya da bitmiş oyun ilk
 * çizimde yerinde, istemci geri yüklerken ekran kaymıyor. Çerez yoksa ya
 * da tutmazsa boş bulmaca; tarayıcı deposu yine geri yükler
 * (`StockPuzzle`). Cevap sayfaya yalnız bitmiş bulmacada girer (uçla aynı
 * kural, `lib/stock-puzzle-data.ts`).
 *
 * İNCE BAŞLIK (25 Ekim, tek ekranlık tahta): başlık kapağı 1280×800'de
 * görünür alanın 260 pikselini alıyordu (69-330) ve oyun ilk ekranın
 * altında başlıyordu. Şimdi çerçevesiz `PageHeader` (embedded), başlık
 * 30 piksel, sağda paylaş. Üst künye yok (CLAUDE.md, `PageHeader`).
 * 29 Ekim'den beri numara, tarih ve arşiv bağlantısı başlığın ALTINDAKİ
 * oyun şeridinde (`GameNav`): oyun sekmeleri ve önceki/sonraki bulmaca.
 *
 * MOBİL TURU (25 Ekim, sahibinin iPhone ekranları): telefonda başlık
 * bandı üç satırdı (başlık; iki satır açıklama; numara ve tarih). Şimdi
 * numara ve tarih kısa hâliyle başlık satırında ("#2 · 25 Eki"), arşiv
 * bağlantısı simge, açıklama tek cümle. Ölçüm StockPuzzle.module.css'te.
 *
 * Tahtanın ALTINDA "Nasıl Oynanır": oyunun kuralları, lejantın uzun
 * açıklaması, havuz ve serinin nerede tutulduğu. Tahtada her biri kendi
 * paragrafıydı ve hep birlikte bir ekran boyu yer alıyordu; okunması
 * gereken ama oynarken bakılmayan metin.
 */
export async function PuzzleScreen({ day, archive }: { day: string; archive: boolean }) {
  const { locale, t } = await getI18n();
  const L = t.stockPuzzle;
  const number = puzzleNumber(day);
  const jar = await cookies();
  const saved = parseProgressCookie(jar.get(archive ? ARCHIVE_COOKIE : PROGRESS_COOKIE)?.value, day);
  const restored = saved.length > 0 ? await evaluatePuzzle(day, saved, locale) : null;
  const result = restored?.ok ? restored : await evaluatePuzzle(day, [], locale);
  const dateLabel = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: PUZZLE_ZONE,
  }).format(new Date(`${day}T12:00:00Z`));
  const path = archive ? `/bulmaca/${day}` : "/bulmaca";
  const neighbors = neighborHrefs(day, puzzleDayKey());
  const title = archive ? `${L.title} #${number}` : L.title;

  const shortDate = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", {
    day: "numeric",
    month: "short",
    timeZone: PUZZLE_ZONE,
  }).format(new Date(`${day}T12:00:00Z`));
  /* Açıklama iki cümle; telefonda yalnız ilki (tek satır). İkincisi
     "Nasıl Oynanır"ın ilk maddesiyle aynı bilgi. */
  const subtitle = archive ? L.archiveDayNote : L.subtitle;
  const subtitleLead = firstSentence(subtitle);
  const subtitleRest = subtitle.slice(subtitleLead.length).trim();
  const rules = [
    { key: "ladder", icon: LockSimpleOpen, text: L.ladderNote },
    { key: "silhouette", icon: ChartLineUp, text: L.silhouetteNote },
    { key: "legend", icon: Swatches, text: L.legendNote },
    { key: "joker", icon: Cards, text: L.jokerHint },
    { key: "pool", icon: Database, text: L.poolNote },
    { key: "stats", icon: ChartBar, text: L.statsNote },
    { key: "keys", icon: Keyboard, text: L.shortcutsNote },
  ];

  return (
    <MotionExperience className={styles.screen}>
      <BreadcrumbJsonLd
        locale={locale}
        items={archive ? [{ name: L.title, path: "/bulmaca" }, { name: L.archiveLink, path: "/bulmaca/arsiv" }, { name: title, path }] : [{ name: L.title, path }]}
      />
      <PageHeader
        embedded
        className={styles.head}
        title={title}
        share={<PageShare compactOnMobile align="right" path={path} title={title} locale={locale} t={t} />}
      />
      <p className={styles.subtitle}>
        {subtitleLead}
        {subtitleRest && <span className={styles.subRest}> {subtitleRest}</span>}
      </p>
      <GameNav
        active="stock"
        labels={L}
        day={{ number, dateLabel: shortDate, dateLong: dateLabel, prevHref: neighbors.prev, nextHref: neighbors.next }}
      />

      {result.ok ? (
        <StockPuzzle
          key={day}
          initial={result.state}
          options={result.options}
          labels={L}
          locale={locale}
          shareUrl={absoluteUrl(path, locale)}
          archive={archive}
        />
      ) : (
        <EmptyState title={L.unavailableTitle} hint={L.unavailable} />
      )}

      {/* GÜNÜN SIRALAMASI (29 Ekim) — yalnız günün bulmacasında; arşiv
          günlerinin sıralaması yok. Gerekçe `PuzzleLeaderboard.tsx`. */}
      {!archive && result.ok && <PuzzleLeaderboard labels={L} />}

      {/* KATLI (25 Ekim, mobil turu): yedi kural telefonda 330 piksellik
          bir liste olarak tahtanın altını dolduruyordu; oynarken bakılmayan
          metin. Başlık satırı katlamanın düğmesi (`<details>`, JS'siz;
          açılınca `ExpandInPlace` bastığın yerde uzatıyor). Kapalıyken de
          metin sunucu HTML'inde. */}
      <Panel>
        <details className={styles.how}>
          <summary className={styles.howSummary}>
            <h2 className="display-ink display-ink-tight w-fit text-lead font-bold tracking-[-0.015em]">{L.howTitle}</h2>
            <CaretDown aria-hidden size={14} weight="bold" className={styles.howCaret} />
          </summary>
          <ul className={styles.rules}>
            {rules.map(({ key, icon: Icon, text }) => (
              <li key={key}>
                <Icon aria-hidden size={16} weight="bold" className={styles.ruleIcon} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </details>
      </Panel>

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["piyasa-degeri", "hisse-senedi"]} />
    </MotionExperience>
  );
}
