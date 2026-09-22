"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./StoryDetail.module.css";

export type StoryTocItem = { id: string; label: string; number: number };

/**
 * Mercek yazısının yan rayı — içindekiler ve yazıda geçen şirketler.
 *
 * Liste sunucuda düz `#çapa` bağlantıları olarak basılıyor; JavaScript
 * gelmeden de çalışıyor. İstemcinin tek işi o an okunan bölümü
 * `aria-current="location"` ile işaretlemek.
 *
 * NEDEN `SectionNav` DEĞİL: o bileşen kendi çubuğunun yüksekliğini her
 * başlığa `scroll-margin` olarak ekliyor — yatay, sayfanın üstüne yapışan bir
 * çubuk için doğru. Bu ray yanda duruyor; aynı ofset her `##` atlamasını
 * ray boyu kadar (~500 piksel) aşağıda bırakırdı.
 *
 * İlerleme dolgusu ve "N Dk Kaldı" sayacı BİLEREK YOK: üstteki
 * `ScrollProgress` ilerlemeyi zaten gösteriyor ve saniyede birkaç kez
 * değişen bir sayaç okumanın kenarında titreşen bir dikkat çekici oluyordu.
 * Künyede yalnızca yazının toplam okuma süresi duruyor.
 *
 * Etkin bölüm her kaydırma karesinde değil, başlık okuma çizgisini
 * GEÇTİĞİNDE hesaplanıyor (IntersectionObserver + `scrollend`); durum ancak
 * bölüm değişince güncelleniyor.
 */
export function StoryRail({
  items,
  lang,
  minutesLabel,
  labels,
  children,
}: {
  items: StoryTocItem[];
  /** Başlıklar yazının dilinde — site dilinde değil. */
  lang: string;
  minutesLabel: string;
  labels: { inThisArticle: string; tocLabel: string; railLabel: string };
  /** Sunucuda çizilen şirket bloğu. */
  children?: ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const itemIds = items.map((item) => item.id).join("\n");

  useEffect(() => {
    if (!itemIds || !("IntersectionObserver" in window)) return;
    const sections = itemIds
      .split("\n")
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0) return;

    let observer: IntersectionObserver | undefined;
    /* OKUMA ÇİZGİSİ görünüm alanının %30'u — SectionNav ile aynı eşik:
       başlık ekranın üst üçte birine girdiğinde o bölüm okunuyor sayılır.
       İlk başlıktan önce (özet ve giriş) hiçbir satır işaretli değil. */
    const update = () => {
      const line = window.innerHeight * 0.3;
      const passed = sections.filter(
        (section) => section.getBoundingClientRect().top <= line + 2,
      );
      const last = sections[sections.length - 1];
      const atBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 3;
      const current =
        atBottom && last.getBoundingClientRect().top < window.innerHeight
          ? last
          : passed[passed.length - 1];
      setActiveId(current?.id ?? null);
    };
    const observe = () => {
      observer?.disconnect();
      const line = Math.round(window.innerHeight * 0.3);
      /* Piksel kenar payı: yüzde değerleri GENİŞLİĞE göre çözülüyor. */
      observer = new IntersectionObserver(update, {
        rootMargin: `-${line}px 0px -${Math.max(0, window.innerHeight - line - 2)}px 0px`,
        threshold: 0,
      });
      sections.forEach((section) => observer?.observe(section));
      update();
    };
    observe();
    window.addEventListener("scrollend", update);
    window.addEventListener("resize", observe);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scrollend", update);
      window.removeEventListener("resize", observe);
    };
  }, [itemIds]);

  return (
    <aside className={styles.rail} aria-label={labels.railLabel}>
      {items.length > 0 && (
        <nav aria-label={labels.tocLabel}>
          <div className={styles.railHead}>
            <p className={styles.railTitle}>{labels.inThisArticle}</p>
            <span className={styles.railMeta}>{minutesLabel}</span>
          </div>
          <ol className={styles.toc} lang={lang}>
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={styles.tocLink}
                  aria-current={activeId === item.id ? "location" : undefined}
                >
                  <span aria-hidden>{String(item.number).padStart(2, "0")}</span>
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {children}
    </aside>
  );
}
