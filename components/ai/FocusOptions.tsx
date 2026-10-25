/* YÖNERGESİZ (25 Ekim): hem sunucu sayfası (Rapor sekmesi) hem istemci
   masası (ClaudeWorkbench) aynı iki seçeneği basar; içinde kanca yok. */
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import type { AnalysisFocus } from "@/lib/ai-analysis-core";
import styles from "./Claude.module.css";

type Verdict = "buy" | "hold" | "sell" | "insufficient";

export type FocusOption = {
  focus: AnalysisFocus; href: string; name: string;
  /** Tek satır: vade ve ne verdiği ("1–2 Hafta · Yön, destek ve direnç, momentum") ya da son raporun zamanı. */
  line: string; current: boolean;
  latest?: { verdict: Verdict; label: string; score: number | null } | null;
};

/**
 * İKİ ODAK, İKİ NET SEÇENEK (25 Ekim; sahibinin isteği: "Analizi Başlat
 * kaydırmadan gözükmüyor"). Eskiden odak, sekmelerin ÜSTÜNDE mürekkep
 * çizimli iki büyük karttı (telefonda 379 piksel) ve Yeni Analiz sahnesi
 * aynı odağı rozetle bir kez daha söylüyordu; düğme 390×844'te 1.424.
 * pikselde kalıyordu. Şimdi seçenek eylemin kendi kartında: ad, tek satır
 * (vade · çıktı) ve seçili olan ton farkıyla (`aria-current`, sunken →
 * premium zemin + mavi kenar imi). Bağlantı, düğme değil: odak adreste
 * yaşar (`?odak=`), geri tuşu ve paylaşılan bağlantı aynı odağı açar;
 * `scroll={false}` ile yerinde değişir.
 */
export function FocusOptions({ items, label, className }: { items: FocusOption[]; label: string; className?: string }) {
  return <ul className={[styles.focusOptions, className].filter(Boolean).join(" ")} aria-label={label}>
    {items.map(o => <li key={o.focus}>
      <Link href={o.href} scroll={false} rel="nofollow" aria-current={o.current ? "true" : undefined} className={styles.focusOption} data-verdict={o.latest?.verdict}>
        <span className={styles.focusMark} aria-hidden />
        <span className={styles.focusText}>
          <b>{o.name}</b>
          <span>{o.line}</span>
        </span>
        {o.latest && <span className={styles.focusVerdict}>
          {o.latest.score !== null && <ScoreRing score={o.latest.score} verdict={o.latest.verdict === "insufficient" ? "hold" : o.latest.verdict} size={30} />}
          <b>{o.latest.label}</b>
        </span>}
      </Link>
    </li>)}
  </ul>;
}
