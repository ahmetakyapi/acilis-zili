import { Fragment, type CSSProperties } from "react";
import styles from "./KineticText.module.css";

/**
 * Kinetik başlık: harfler kelimenin maskesinden sırayla yükselir — filmdeki
 * dev yazının (`lib/ink/analysis-film.ts` → `kinetic`) DOM karşılığı; açılış
 * ekranı ile rapor kapağı aynı dili konuşsun.
 *
 * Ekran okuyucu metni bir kez, düz okur (`sr-only`); harf kutuları
 * `aria-hidden`. Kelime bölünmez (`nowrap`), satır kelime arasında kırılır.
 * Giriş `--ease-brand`: yazı hedefini aşıp geri oturmaz (CLAUDE.md → Eğri).
 */
export function KineticText({ text, className, delay = 0, stagger = 32 }: {
  text: string; className?: string; /** ms */ delay?: number; /** harf başına ms */ stagger?: number;
}) {
  const words = text.split(" ");
  // Her kelimenin ilk harfinin sırası: gecikme kelimeler boyunca kesintisiz artar.
  const starts = words.map((_, w) => words.slice(0, w).reduce((sum, word) => sum + Array.from(word).length, 0));
  return <span className={`${styles.kinetic} ${className ?? ""}`}>
    <span className="sr-only">{text}</span>
    {words.map((word, w) => <Fragment key={w}>
      <span className={styles.word} aria-hidden>
        {Array.from(word).map((ch, c) => <span key={c} style={{ "--d": `${delay + (starts[w] + c) * stagger}ms` } as CSSProperties}>{ch}</span>)}
      </span>
      {w < words.length - 1 && " "}
    </Fragment>)}
  </span>;
}
