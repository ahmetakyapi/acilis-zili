import { Panel } from "@/components/ui/primitives";
import styles from "./Answers.module.css";

export type AnswerFact = {
  label: string;
  value: string;
  /** Değerin altındaki sessiz künye: öteki saat, gün adı, uzaklık. */
  sub?: string;
};

/**
 * Soru sayfasının ölçü ızgarası — ilk cümlenin sayıları, tek bakışta.
 *
 * Ekran düzeninde 4. sıra (`.claude/rules/arayuz.md`): yan yana ölçüler aynı
 * hatta biter (alt ızgara), telefonda alt alta iner. Panelin `h2`si görünmez
 * değil GÖRSEL OLARAK gizli: üç ölçünün etiketleri zaten başlık işi görüyor,
 * ama belge taslağında panel adsız kalmasın.
 */
export function AnswerFacts({ label, facts }: { label: string; facts: AnswerFact[] }) {
  if (facts.length === 0) return null;
  return (
    <Panel aria-label={label}>
      <h2 className="sr-only">{label}</h2>
      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.label} className={styles.fact}>
            <dt className={`plate ${styles.factLabel}`}>{fact.label}</dt>
            <dd className={`numeral ${styles.factValue}`}>{fact.value}</dd>
            <dd className={styles.factSub}>{fact.sub ?? " "}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
