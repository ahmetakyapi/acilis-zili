"use client";

import { useEffect, useRef } from "react";
import { useMotionPreference } from "@/components/motion/useMotionPreference";
import styles from "./Themes.module.css";

/** Basamak başına yuvarlanma süresi ve basamaklar arası gecikme, ms. */
const ROLL_MS = 900;
const ROLL_STAGGER_MS = 70;
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/**
 * Sayaç gibi yuvarlanarak gelen sayı — "+%1,97" gibi biçimlenmiş bir DİZE.
 *
 * SUNUCU SON HÂLİ BASAR. Her basamak 0-9 şeridi olarak çiziliyor ve şerit
 * satır içi stille zaten kendi rakamında duruyor: JS yoksa, hareket
 * azaltılmışsa ya da sayı ilk ekrandaysa okuyucu yalnızca sayının kendisini
 * görüyor. Yuvarlanma yalnızca ekranın ALTINDA bekleyen sayıya hazırlanıyor
 * ve görünüme girince bir kez oynuyor (`Reveal` ile aynı kural: ilk
 * ekrandaki veri kıpırdamaz; boyanmış bir sayıyı sıfıra çekip yeniden
 * saydırmak bir hata gibi okunur).
 *
 * Genişlik şeritten değil SON RAKAMDAN geliyor: Schibsted Grotesk'te
 * rakamlar eşit genişlikte değil (bkz. globals.css `.numeral`) ve şeridin
 * en geniş rakamı her sütunu "0" genişliğine açıp "1,19"u seyrek
 * gösterirdi. Görünmez bir yer tutucu rakam sütunun enini veriyor; şerit
 * onun üstünde ortalı kayıyor.
 *
 * Ekran okuyucu şeritleri değil düz metni okuyor (`sr-only`).
 *
 * İLK EKRANDAKİ KAHRAMAN SAYISI İÇİN `components/ui/RollingFigure` var:
 * JS'siz, yalnızca yüklemede dönüyor. Bu bileşen onun tamamlayıcısı,
 * kopyası değil (gerekçe o dosyada).
 */
export function RollingFigure({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useMotionPreference();

  useEffect(() => {
    const root = ref.current;
    if (!root || reduced || !("IntersectionObserver" in window) || !("animate" in root)) return;
    const rect = root.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) return;

    const strips = Array.from(root.querySelectorAll<HTMLElement>("[data-roll-strip]"));
    /* Kırpma ve şerit yalnızca dönüş boyunca (Themes.module.css →
       `[data-rolling]`); son animasyon bitince durağan kopya geri geliyor. */
    root.dataset.rolling = "";
    let pending = strips.length;
    const settle = () => {
      pending -= 1;
      if (pending <= 0) delete root.dataset.rolling;
    };
    const animations = strips.map((strip, index) => {
      const animation = strip.animate(
        [{ transform: "translateY(0)" }, { transform: strip.style.transform }],
        {
          duration: ROLL_MS + index * ROLL_STAGGER_MS,
          easing: "cubic-bezier(.22,1,.36,1)",
          fill: "both",
        },
      );
      animation.pause();
      animation.currentTime = 0;
      animation.onfinish = () => {
        animation.cancel();
        settle();
      };
      return animation;
    });
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        animations.forEach((animation) => animation.play());
      },
      { rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      delete root.dataset.rolling;
    };
  }, [reduced, value]);

  return (
    <span ref={ref} className={[styles.roll, className].filter(Boolean).join(" ")}>
      <span className="sr-only">{value}</span>
      <span aria-hidden className={styles.rollTrack}>
        {Array.from(value).map((char, index) => {
          const digit = DIGITS.indexOf(char as (typeof DIGITS)[number]);
          if (digit === -1) {
            return (
              <span key={index} className={styles.rollGlyph}>
                {char}
              </span>
            );
          }
          return (
            <span key={index} className={styles.rollColumn}>
              <span className={styles.rollSizer}>{char}</span>
              <span
                data-roll-strip
                className={styles.rollStrip}
                style={{ transform: `translateY(-${digit * 10}%)` }}
              >
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
