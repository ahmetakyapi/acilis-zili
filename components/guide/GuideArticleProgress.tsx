"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { Dictionary } from "@/lib/i18n";
import { ChapterIcon, chapterToneStyle } from "./chapter-tone";
import { markRead } from "./guide-progress-store";
import { useGuideRead } from "./useGuideRead";
import styles from "./GuideArticleProgress.module.css";

/**
 * REHBERDEKİ YERİN — yazı sayfasının sonunda (25 Ekim).
 *
 * Yazının bitiminde okuyucunun iki sorusu var: "bu bölümde neredeyim" ve
 * "sırada ne var". İkincisini altındaki önceki/sıradaki kartları
 * cevaplıyor; bu panel birincisini: bölümün yazıları bir şerit üzerinde,
 * her biri bir dilim. Bu yazı koyu, okunanlar yumuşak mavi, kalanlar
 * kulvar. Dilimler bağlantı: bölümün herhangi bir yazısına buradan gidilir.
 *
 * OKUNDU SAYMA: panel görünüme girince (yazının sonuna inildi) yazı
 * okundu sayılır ve tarayıcıya yazılır (`guide-progress-store.ts`). Sayfayı
 * açıp kapatmak okumak değil; sonuna inmek en dürüst yaklaşık ölçü.
 * Gözlemci bir kez çalışıp kendini kapatıyor.
 *
 * BÖLÜMÜN TONUNDA (25 Ekim, ikinci tur): panel rehberdeki durak kartıyla
 * aynı rengi ve ikonu taşıyor (`chapter-tone.ts`). Okunan dilimler tonun
 * yarısı, bu yazı tonun tamamı ve kalın, kalanlar kulvar. Önceki tur bu
 * yazıyı metin renginde, okunanları sitenin mavisinde çiziyordu; rehber
 * sayfasında mor görünen bölüm burada mavi görünüyordu.
 */

type Labels = Dictionary["guideVisuals"];

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

export function GuideArticleProgress({
  slug,
  chapterKey,
  chapter,
  chapterNumber,
  articles,
  curriculumIndex,
  curriculumTotal,
  labels,
}: {
  slug: string;
  /** Bölümün anahtarı — ton ve ikon (`chapter-tone.ts`). */
  chapterKey: string;
  chapter: string;
  chapterNumber: number;
  articles: { slug: string; title: string }[];
  curriculumIndex: number;
  curriculumTotal: number;
  labels: Labels;
}) {
  const read = useGuideRead();
  const ref = useRef<HTMLElement>(null);
  const position = articles.findIndex((article) => article.slug === slug);
  const readCount = read ? articles.filter((article) => read.has(article.slug)).length : 0;
  const isRead = read?.has(slug) ?? false;

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        markRead(slug);
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [slug]);

  return (
    <section ref={ref} className={styles.progress} aria-labelledby="rehber-yerin" style={chapterToneStyle(chapterKey)}>
      <div className={styles.head}>
        <span className={styles.titleRow}>
          <span className={styles.icon} aria-hidden>
            <ChapterIcon chapter={chapterKey} size={18} weight="duotone" />
          </span>
          <h2 id="rehber-yerin" className={styles.title}>
            {labels.progressTitle}
          </h2>
        </span>
        <span className={`numeral ${styles.position}`}>
          {fill(labels.curriculumPosition, { index: curriculumIndex, total: curriculumTotal })}
        </span>
      </div>
      <p className={styles.chapter}>
        <span className="numeral">
          {fill(labels.chapterPosition, {
            chapter: `${fill(labels.chapter, { n: chapterNumber })} · ${chapter}`,
            index: position + 1,
            total: articles.length,
          })}
        </span>
        {isRead && (
          <span className={styles.readNote}>
            <CheckCircle size={14} weight="fill" aria-hidden />
            {labels.readMark}
          </span>
        )}
      </p>
      <ol
        className={styles.segments}
        aria-label={fill(labels.segmentsLabel, { chapter, index: position + 1 })}
        style={{ "--n": articles.length } as CSSProperties}
      >
        {articles.map((article, index) => {
          const current = article.slug === slug;
          const state = current ? "current" : read?.has(article.slug) ? "read" : "next";
          return (
            <li key={article.slug} style={{ "--i": index } as CSSProperties}>
              {current ? (
                <span className={styles.segment} data-state={state} aria-current="page" title={article.title}>
                  <span className="sr-only">{`${index + 1}. ${article.title}`}</span>
                </span>
              ) : (
                <Link href={`/rehber/${article.slug}`} prefetch={false} className={styles.segment} data-state={state} title={article.title}>
                  <span className="sr-only">{`${index + 1}. ${article.title}`}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <div className={styles.legend} aria-hidden>
        <span>
          <i data-state="read" />
          {labels.legendRead}
          {read && readCount > 0 && <b className="numeral">{` ${readCount}/${articles.length}`}</b>}
        </span>
        <span>
          <i data-state="current" />
          {labels.legendCurrent}
        </span>
        <span>
          <i data-state="next" />
          {labels.legendNext}
        </span>
      </div>
    </section>
  );
}
