"use client";

import type { CSSProperties } from "react";
import { ArrowRight, Bank, BookOpenText, Buildings, CheckCircle, Flag, Scales } from "@phosphor-icons/react";
import { LevelDots } from "@/components/article/LevelBadge";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { GuideLevel } from "@/content/guide";
import { nextUnread, topicProgress } from "@/lib/guide-progress";
import type { Dictionary } from "@/lib/i18n";
import { useGuideRead } from "./useGuideRead";
import styles from "./GuideRoadmap.module.css";

/**
 * REHBERİN YOL HARİTASI (25 Ekim, sahibinin isteği: "sıralı müfredat görsel
 * bir yol haritası olsun").
 *
 * Dört bölüm bir PATİKA üzerinde duruyor: masaüstünde soldan sağa, telefonda
 * yukarıdan aşağı. Eski şerit dört eş karodan ibaretti; sıra yalnız
 * köşedeki "01-04" numarasından okunuyordu. Patika sırayı çizginin kendisiyle
 * söylüyor: bir bölümden çıkan yol bir sonrakine bağlanıyor.
 *
 * YOL OKUDUKÇA DOLUYOR. Her bölümün düğümünden çıkan kulvar o bölümün okunan
 * yazı oranı kadar dolu; bölümün altındaki noktalar yazı yazı aynı bilgiyi
 * taşıyor (dolu nokta okundu). Okunan yazılar YALNIZ tarayıcıda tutuluyor
 * (`guide-progress-store.ts`, try/catch): sunucu bilmiyor, sunucu çiziminde
 * sayaç yok ve ilk istemci çiziminde geliyor. Sayaç satırı sunucuda da yerini
 * tutuyor, yani gelişi sayfayı kaydırmıyor.
 *
 * RENK: kulvarın dolu kısmı ve okunan noktalar mavi ailenin YUMUŞAK tonu
 * (25 Ekim renk kararı: büyüklük ve ilerleme yumuşak mavi; doygun mavi
 * yalnız bağlantı). Bölüm kartının kendisi bağlantı: üzerine gelince ton.
 *
 * Bölüm kartları sayfa içi çapalara gidiyor (#konu-...): eski şeridin işi
 * neyse o — filtre değil, içindekiler tablosu.
 */

export type RoadmapChapter = {
  key: string;
  label: string;
  minutes: number;
  levelSpan: string;
  topLevel: GuideLevel;
  articles: { slug: string; title: string }[];
};

type Labels = Dictionary["guideVisuals"];

const CHAPTER_ICONS = {
  temel: BookOpenText,
  strateji: Scales,
  sirket: Buildings,
  makro: Bank,
} as const;

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

export function GuideRoadmap({
  chapters,
  totalMinutes,
  labels,
}: {
  chapters: RoadmapChapter[];
  totalMinutes: number;
  labels: Labels;
}) {
  const read = useGuideRead();
  const flat = chapters.flatMap((chapter) => chapter.articles.map((article) => ({ ...article, topic: chapter.key })));
  const progress = read ? topicProgress(flat, read) : null;
  const readTotal = progress ? progress.reduce((sum, entry) => sum + entry.read, 0) : 0;
  const next = read ? nextUnread(flat, read) : null;
  const done = flat.length > 0 && readTotal === flat.length;

  return (
    <div className={styles.roadmap}>
      {/* Toplam: sunucuda kapsam (yazı, süre), istemcide okunan oranı.
          Satır iki hâlde de aynı yükseklikte (min-height). */}
      <div className={styles.summary}>
        <div className={styles.summaryFigure}>
          <span className="numeral">
            {read && readTotal > 0
              ? fill(labels.totalRead, { read: readTotal, total: flat.length })
              : fill(labels.totalMeta, { count: flat.length, minutes: totalMinutes })}
          </span>
          <span className={styles.summaryLane} aria-hidden>
            <span
              className={styles.summaryFill}
              style={{ "--p": flat.length > 0 ? readTotal / flat.length : 0 } as CSSProperties}
            />
          </span>
        </div>
        {next ? (
          <Link href={`/rehber/${next.slug}`} className={styles.continue}>
            <span className={styles.continueLabel}>{labels.continueReading}</span>
            <span className={styles.continueTitle}>{next.title}</span>
            <ArrowRight weight="bold" size={14} aria-hidden />
          </Link>
        ) : done ? (
          <span className={styles.allDone}>
            <CheckCircle weight="fill" size={16} aria-hidden />
            {labels.allDone}
          </span>
        ) : null}
      </div>

      <ol className={styles.path} aria-label={labels.roadmapLabel}>
        {chapters.map((chapter, index) => {
          const Icon = CHAPTER_ICONS[chapter.key as keyof typeof CHAPTER_ICONS] ?? BookOpenText;
          const entry = progress?.[index];
          const ratio = entry && entry.total > 0 ? entry.read / entry.total : 0;
          const complete = entry ? entry.total > 0 && entry.read === entry.total : false;
          const last = index === chapters.length - 1;
          return (
            <li
              key={chapter.key}
              className={styles.station}
              data-complete={complete || undefined}
              style={{ "--i": index, "--p": ratio } as CSSProperties}
            >
              {/* Düğümden bir sonrakine giden kulvar; dolu kısmı bu bölümün
                  okunan oranı. Son bölümde yol bir bayrakla bitiyor. */}
              <span className={styles.lane} aria-hidden>
                <span className={styles.laneFill} />
              </span>
              {last && (
                <span className={styles.finish} aria-hidden>
                  <Flag weight="fill" size={14} />
                </span>
              )}
              <a href={`#konu-${chapter.key}`} className={styles.stop}>
                <span className={styles.node} aria-hidden>
                  {/* Düğümün çevresindeki halka bölümün okunan oranı —
                      kulvarla aynı sayı, düğümün üstünde bir bakışta. */}
                  <svg className={styles.ring} viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r="28" pathLength={100} className={styles.ringTrack} />
                    <circle
                      cx="30"
                      cy="30"
                      r="28"
                      pathLength={100}
                      className={styles.ringFill}
                      strokeDasharray={`${ratio * 100} 100`}
                    />
                  </svg>
                  <Icon size={22} weight="duotone" />
                  {complete && (
                    <span className={styles.nodeCheck}>
                      <CheckCircle size={16} weight="fill" />
                    </span>
                  )}
                </span>
                <span className={styles.copy}>
                  <span className={styles.chapterNo}>{fill(labels.chapter, { n: index + 1 })}</span>
                  <span className={styles.chapterName}>{chapter.label}</span>
                  <span className={`numeral ${styles.chapterMeta}`}>
                    {fill(labels.chapterMeta, { count: chapter.articles.length, minutes: chapter.minutes })}
                  </span>
                  <span className={styles.level}>
                    <LevelDots level={chapter.topLevel} />
                    {chapter.levelSpan}
                  </span>
                  <span
                    className={styles.dots}
                    role="img"
                    aria-label={fill(labels.dotsLabel, {
                      label: chapter.label,
                      read: entry?.read ?? 0,
                      total: chapter.articles.length,
                    })}
                  >
                    {chapter.articles.map((article) => (
                      <span key={article.slug} data-read={read?.has(article.slug) || undefined} />
                    ))}
                  </span>
                  <span className={`numeral ${styles.status}`}>
                    {entry && entry.read > 0
                      ? complete
                        ? labels.chapterDone
                        : fill(labels.chapterRead, { read: entry.read, total: entry.total })
                      : " "}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      <p className={styles.note}>{labels.storageNote}</p>
    </div>
  );
}

/**
 * Kartın köşesindeki "Okundu" işareti — yazı listesinde ve telefon
 * satırlarında. Sunucuda hiçbir şey basmıyor; okunmuşsa ilk istemci
 * çiziminde geliyor. Yeri sabit (kartın numara sütunu), gelişi kaydırmıyor.
 */
export function ReadMark({ slug, label }: { slug: string; label: string }) {
  const read = useGuideRead();
  if (!read?.has(slug)) return null;
  return (
    <span className={styles.readMark} title={label}>
      <CheckCircle size={14} weight="fill" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
