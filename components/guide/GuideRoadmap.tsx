"use client";

import type { CSSProperties } from "react";
import { ArrowRight, CheckCircle, Flag } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { nextUnread, topicProgress } from "@/lib/guide-progress";
import type { Dictionary } from "@/lib/i18n";
import { ChapterIcon, chapterToneStyle } from "./chapter-tone";
import { useGuideRead } from "./useGuideRead";
import styles from "./GuideRoadmap.module.css";

/**
 * REHBERİN YOL HARİTASI — kapağın içinde (25 Ekim, ikinci tur).
 *
 * İlk tur (aynı gün) dört bölümü gri ikonlu dairelerle ve gri bir çizgiyle
 * ayrı bir "Nereden Başlamalı" panelinde çiziyordu. Sahibinin sözü: "daha
 * görsel ve iyi olmalı"; genel şikâyeti: asıl içerik ilk ekranda görünsün.
 * Ölçüldü (1440×900): kapak 190, panel 450 piksel tutuyordu ve ilk bölümün
 * yazıları ilk ekrana hiç girmiyordu (bölüm başlığı y=759'da).
 *
 * Şimdi:
 * - Panel KAPAĞA KATLANDI: başlığı ve açıklaması tek cümle oldu
 *   (`heroLead`), "Baştan Başla" kapağın birincil eylemi (`GuideHeroAction`).
 * - Dört bölüm RENKLİ DURAK KARTI: her bölümün kendi tonu
 *   (`chapter-tone.ts`, `--chart-a..d`), ikon karosu, ilerleme halkası,
 *   kapsam, üç basamaklı seviye çubuğu ve yazı başına bir dilimli ilerleme
 *   şeridi. Eski 8 piksellik nokta sırası (20 yazılık bölümde iki satıra
 *   kırılıyordu) dilimli şeride döndü: tek satır, aynı bilgi.
 * - Kartların üstünden YOL geçiyor: durak başına bir düğüm ve bir sonraki
 *   durağa giden kulvar; kulvarın dolu kısmı o bölümün okunan oranı, renk
 *   bölümün rengi. Okudukça yol renkleniyor.
 *
 * Okunan yazılar YALNIZ tarayıcıda (`guide-progress-store.ts`, try/catch).
 * Sunucu çiziminde ilerleme yok; sayaçların yeri sunucuda da tutuluyor, ilk
 * istemci çiziminde dolması hiçbir şeyi kaydırmıyor (CLS ölçüldü: 0).
 *
 * Durak kartı bir sayfa içi çapa (#konu-...): içindekiler tablosu, süzgeç
 * değil.
 */

export type RoadmapChapter = {
  key: string;
  label: string;
  minutes: number;
  levelSpan: string;
  /** Seviye çubuğunun dolu basamakları (0 Temel · 1 Orta · 2 İleri). */
  levelRange: [number, number] | null;
  articles: { slug: string; title: string }[];
};

type Labels = Dictionary["guideVisuals"];

/** Seviye çubuğunun basamak sayısı — Temel, Orta, İleri. */
const LEVEL_STEPS = 3;

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

function flatten(chapters: RoadmapChapter[]) {
  return chapters.flatMap((chapter) => chapter.articles.map((article) => ({ ...article, topic: chapter.key })));
}

/**
 * Kapağın birincil eylemi. Sunucuda ve hiç okumamış okurda "Baştan Başla"
 * (ilk yazı); okumaya başlamış okurda "Kaldığın Yerden Devam Et" (müfredat
 * sırasında ilk okunmamış yazı); hepsini bitirene "Baştan Başla" ve bitiş
 * notu. Etiket değişince kutu büyümesin diye sütun sabit genişlikte
 * (GuideExperience.module.css → `.heroTop`).
 */
export function GuideHeroAction({
  chapters,
  totalMinutes,
  startLabel,
  labels,
}: {
  chapters: RoadmapChapter[];
  totalMinutes: number;
  startLabel: string;
  labels: Labels;
}) {
  const read = useGuideRead();
  const flat = flatten(chapters);
  const first = flat[0];
  if (!first) return null;
  const next = read ? nextUnread(flat, read) : null;
  const readTotal = read ? flat.filter((article) => read.has(article.slug)).length : 0;
  const done = readTotal === flat.length;
  const target = next ?? first;

  return (
    <div className={styles.action}>
      <Link href={`/rehber/${target.slug}`} className={styles.cta}>
        <span>{next ? labels.continueReading : startLabel}</span>
        <ArrowRight weight="bold" size={16} aria-hidden />
      </Link>
      <p className={styles.actionMeta}>
        {done ? (
          <span className={styles.allDone}>
            <CheckCircle weight="fill" size={14} aria-hidden />
            {labels.allDone}
          </span>
        ) : (
          <span className={styles.actionTitle}>{target.title}</span>
        )}
        <span className="numeral">
          {readTotal > 0
            ? fill(labels.totalRead, { read: readTotal, total: flat.length })
            : fill(labels.totalMeta, { count: flat.length, minutes: totalMinutes })}
        </span>
      </p>
    </div>
  );
}

export function GuideRoadmap({ chapters, labels }: { chapters: RoadmapChapter[]; labels: Labels }) {
  const read = useGuideRead();
  const flat = flatten(chapters);
  const progress = read ? topicProgress(flat, read) : null;
  const next = read ? nextUnread(flat, read) : null;

  return (
    <div className={styles.roadmap}>
      <ol className={styles.path} aria-label={labels.roadmapLabel}>
        {chapters.map((chapter, index) => {
          const entry = progress?.find((item) => item.topic === chapter.key);
          const readCount = entry?.read ?? 0;
          const total = chapter.articles.length;
          const ratio = total > 0 ? readCount / total : 0;
          const complete = total > 0 && readCount === total;
          const current = next?.topic === chapter.key;
          const last = index === chapters.length - 1;
          return (
            <li
              key={chapter.key}
              className={styles.station}
              data-complete={complete || undefined}
              data-current={current || undefined}
              style={{ ...chapterToneStyle(chapter.key), "--i": index, "--p": ratio } as CSSProperties}
            >
              {/* Yol: düğüm + bir sonraki durağa giden kulvar. Son durakta
                  kulvar bir bayrakta bitiyor. */}
              <span className={styles.road} aria-hidden>
                <span className={styles.node} />
                <span className={styles.lane}>
                  <span className={styles.laneFill} />
                </span>
                {last && (
                  <span className={styles.finish}>
                    <Flag weight="fill" size={12} />
                  </span>
                )}
              </span>
              <a href={`#konu-${chapter.key}`} className={styles.stop} data-guide-stop>
                <span className={styles.head}>
                  <span className={styles.icon} aria-hidden>
                    {/* Halka bölümün okunan oranı: kulvarla aynı sayı. */}
                    <svg className={styles.ring} viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="22.5" pathLength={100} className={styles.ringTrack} />
                      <circle
                        cx="24"
                        cy="24"
                        r="22.5"
                        pathLength={100}
                        className={styles.ringFill}
                        strokeDasharray={`${ratio * 100} 100`}
                      />
                    </svg>
                    <ChapterIcon chapter={chapter.key} size={22} weight="duotone" />
                    {complete && (
                      <span className={styles.check}>
                        <CheckCircle size={15} weight="fill" />
                      </span>
                    )}
                  </span>
                  <span className={styles.names}>
                    <span className={styles.chapterNo}>
                      {fill(labels.chapter, { n: index + 1 })}
                      {current && <span className={styles.now}>{labels.chapterNow}</span>}
                    </span>
                    <span className={styles.chapterName}>{chapter.label}</span>
                  </span>
                </span>
                <span className={styles.metaRow}>
                  <span className={`numeral ${styles.meta}`}>
                    {fill(labels.chapterMeta, { count: total, minutes: chapter.minutes })}
                  </span>
                  {chapter.levelRange && (
                    <span className={styles.level}>
                      <span
                        className={styles.levelBar}
                        role="img"
                        aria-label={fill(labels.levelBarLabel, { span: chapter.levelSpan })}
                      >
                        {Array.from({ length: LEVEL_STEPS }, (_, step) => (
                          <i
                            key={step}
                            data-on={
                              chapter.levelRange &&
                              step >= chapter.levelRange[0] &&
                              step <= chapter.levelRange[1]
                                ? ""
                                : undefined
                            }
                          />
                        ))}
                      </span>
                      <span aria-hidden>{chapter.levelSpan}</span>
                    </span>
                  )}
                </span>
                <span className={styles.stripRow}>
                  <span
                    className={styles.strip}
                    role="img"
                    aria-label={fill(labels.dotsLabel, { label: chapter.label, read: readCount, total })}
                    style={{ "--n": total } as CSSProperties}
                  >
                    {chapter.articles.map((article) => (
                      <i key={article.slug} data-read={read?.has(article.slug) || undefined} />
                    ))}
                  </span>
                  <span className={`numeral ${styles.count}`} aria-hidden>
                    {readCount}/{total}
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
 * çiziminde geliyor. Yeri sabit (kartın künye satırı), gelişi kaydırmıyor.
 * Rengi kabın bölüm tonu (`--ch`).
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
