"use client";

import { useEffect, useRef } from "react";
import type { SectionItem } from "@/components/article/ArticleBody";
import styles from "./ReadingRail.module.css";

/**
 * KENAR OKUMA RAYI (5 Kasım 2026, sahibinin "alanı doğru kullan" isteği).
 *
 * 1440'ta 1040'lık yazı kartının iki yanında 200'er piksel boş kenar vardı
 * ve 6–9 bin piksellik yazıda okuyucu nerede olduğunu yalnız tepedeki ince
 * ilerleme çizgisinden okuyordu. Ray o kenarı kullanıyor ama DÜZENE
 * dokunmuyor: 23 Eylül'de geri alınan iki kolonlu düzenin aksine metin
 * kapağın altında tek kolon, aynı genişlikte kalıyor (StoryDetail.module.css
 * → "Gövde"). Ray kartın DIŞINDA, kenarın içinde yüzüyor; 1360 pikselin
 * altında kenar 150 pikselin altına düştüğü için hiç basılmıyor ve
 * oradaki okur yerini gövdenin başındaki "Bu Yazıda" kutusundan buluyor.
 *
 * Her bölüm bir numara ve bir kulvar: kulvar bölümün OKUNAN payı kadar
 * dolar (çizgi, sayı değil — CLAUDE.md "veri bir çizimle okunur"), okunup
 * geçilmiş bölüm soluk dolu kalır, okunan bölümün adı rayın dibinde
 * yazılır. Numara metindeki `h2::before` sayacıyla aynı ("01"): okuyucu
 * raydaki 03'ü gövdede de görüyor.
 *
 * Kaydırma başına React durumu YOK: ilerleme CSS değişkeni olarak doğrudan
 * öğeye yazılıyor, etkin bölüm yalnız değişince `data-state`; dinleyici
 * pasif ve kare başına bir kez (rAF). Bağlantılar düz `#çapa`: JavaScript
 * olmadan da çalışır (ray yine de yalnız istemcide anlamlı, sunucu HTML'i
 * ilk durumuyla gelir).
 */
export function ReadingRail({
  items,
  label,
  navLabel,
  lang,
  containerId,
}: {
  items: SectionItem[];
  /** Rayın başlığı ("Bu Yazıda"). */
  label: string;
  /** `nav` için erişilebilir ad ("İçindekiler"). */
  navLabel: string;
  lang: string;
  /** Bölümlerin bittiği kap; son bölüm onun dibinde biter. */
  containerId: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const currentRef = useRef<HTMLParagraphElement>(null);
  const ids = items.map((item) => item.id).join("\n");

  useEffect(() => {
    const nav = ref.current;
    const container = document.getElementById(containerId);
    if (!nav || !container) return;
    const headings = ids
      .split("\n")
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    const rows = Array.from(nav.querySelectorAll<HTMLLIElement>("li[data-id]"));
    if (!headings.length || rows.length !== headings.length) return;

    let frame = 0;
    let active = -1;
    const update = () => {
      frame = 0;
      /* Okuma çizgisi ekranın üçte biri: bölüm başlığı oraya varınca
         bölüm "okunuyor" sayılır (SectionNav'ın %30 çizgisiyle aynı aile). */
      const line = window.innerHeight * 0.33;
      const end = container.getBoundingClientRect().bottom;
      let next = -1;
      headings.forEach((heading, index) => {
        const start = heading.getBoundingClientRect().top;
        const stop = index + 1 < headings.length ? headings[index + 1].getBoundingClientRect().top : end;
        const span = Math.max(1, stop - start);
        const progress = Math.min(1, Math.max(0, (line - start) / span));
        rows[index].style.setProperty("--read", progress.toFixed(3));
        if (progress > 0) next = index;
      });
      if (next !== active) {
        active = next;
        rows.forEach((row, index) => {
          row.dataset.state = index < next ? "read" : index === next ? "current" : "ahead";
          const link = row.querySelector("a");
          if (link) {
            if (index === next) link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
          }
        });
        if (currentRef.current) currentRef.current.textContent = next >= 0 ? rows[next].dataset.label ?? "" : "";
        nav.dataset.started = next >= 0 ? "true" : "false";
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(container);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resize.disconnect();
    };
  }, [ids, containerId]);

  return (
    <div className={styles.lane}>
      <nav ref={ref} aria-label={navLabel} className={styles.rail} data-started="false" lang={lang}>
        <p className={styles.label} aria-hidden>{label}</p>
        <ol className={styles.list}>
          {items.map((item) => (
            <li key={item.id} data-id={item.id} data-label={item.label} data-state="ahead">
              <a href={`#${item.id}`} aria-label={item.label} title={item.label}>
                <span className={styles.number}>{String(item.number).padStart(2, "0")}</span>
                <span className={styles.track} aria-hidden>
                  <span className={styles.fill} />
                </span>
              </a>
            </li>
          ))}
        </ol>
        {/* Okunan bölümün adı: ekran okuyucu bunu bağlantının
            `aria-current`ından zaten alıyor, burada yalnız göz için. */}
        <p ref={currentRef} className={styles.current} aria-hidden />
      </nav>
    </div>
  );
}
