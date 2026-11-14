import { verdictLabel, verdictOf, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { SLOT_RANK, TECHNICAL_SLOTS, slotLabel, type PlanHistoryEntry } from "@/lib/technical";
import { formatEtDateCompact } from "@/lib/utils";
import { PlanHistory } from "./PlanHistory";
import styles from "./StanceHistory.module.css";

type Day = { date: string; slots: (VerdictKey | null)[]; last: VerdictKey };

/**
 * GÖRÜŞ GEÇMİŞİ: ÖNCE ŞERİT, TABLO AYRINTIDA (14 Kasım 2026, görsel tur).
 *
 * Tablo (`PlanHistory`, 29 Eylül) görüşü satır satır yazıyordu ve canlıda
 * NVDA'nın dört satırı birbirinin aynısıydı: "Açılış Öncesi – Kapanış Öncesi
 * · 3 Yayın · SAT · Bu yayında alım planı yok", sütunların yarısı boş.
 * Okurun sorusu ("görüş NE ZAMAN değişti, ne kadardır böyle") dört satırın
 * karşılaştırılmasıyla cevaplanıyordu. Artık bir şerit: gün başına bir dilim,
 * dilimin içinde o günün üç nöbeti (açılış öncesi, seans içi, kapanış
 * öncesi), rengi görüşün tonu (AL/TUT/SAT; `--verdict-*`, kartların tepe
 * şeridiyle aynı token). Görüşün DEĞİŞTİĞİ günün üstünde yeni görüşün adı
 * yazılı; başlık cümlesi sürenin kendisi ("12 Kas Tarihinden Beri SAT").
 * Renk tek başına taşımıyor: ad yazılı, şeridin metin karşılığı `sr-only`.
 *
 * TABLO KALKMADI, AYRINTIYA İNDİ: bölge ve stopun yayın yayın seyri hâlâ
 * orada, ama katlı (`<details>`; `ExpandInPlace` bastığın yerde açar). Hiçbir
 * yayında bölge ya da stop yoksa (baştan sona SAT) tabloda şeridin
 * söylemediği bir şey kalmaz ve ayrıntı HİÇ basılmaz.
 *
 * Veri aynı: `getTechnicalDetail().history` (son 12 yayın, yeniden eskiye).
 * Ölçüm (NVDA, 12 yayın / 4 gün; önce canlı): bölüm 1440'ta 287 → 194
 * piksel, 390'da 390 → 182 piksel; dilim boyu 14 piksel, gün etiketi 12
 * piksel. Ayrıntısı olan kayıtta (AAPL) kapalı hâli 253 / 241 piksel.
 */
export function StanceHistory({
  history,
  locale,
  t,
}: {
  history: readonly PlanHistoryEntry[];
  locale: Locale;
  t: Dictionary;
}) {
  const byDate = new Map<string, PlanHistoryEntry[]>();
  for (const entry of history) byDate.set(entry.sessionDate, [...(byDate.get(entry.sessionDate) ?? []), entry]);
  const days: Day[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => {
      const slots = TECHNICAL_SLOTS.map((slot) => {
        const entry = entries.find((item) => item.slot === slot);
        return entry ? verdictOf(entry.stance) : null;
      });
      const newest = [...entries].sort((a, b) => (SLOT_RANK[b.slot as keyof typeof SLOT_RANK] ?? 0) - (SLOT_RANK[a.slot as keyof typeof SLOT_RANK] ?? 0))[0]!;
      return { date, slots, last: verdictOf(newest.stance) };
    });
  if (days.length === 0) return null;
  const current = days[days.length - 1]!.last;
  /* Bugünkü görüşün kesintisiz sürdüğü ilk gün (şeritte, eskiye doğru). */
  let since = days.length - 1;
  while (since > 0 && days[since - 1]!.slots.every((slot) => slot === null || slot === current)) since--;
  const sinceWhole = days[since]!.slots.every((slot) => slot === null || slot === current);
  const steady = since === 0 && sinceWhole;
  const v = t.technicalVisuals;
  const headline = steady
    ? v.stanceStripSteady.replace("{n}", String(days.length)).replace("{stance}", verdictLabel(current, t))
    : v.stanceStripSince.replace("{date}", formatEtDateCompact(days[since]!.date, locale)).replace("{stance}", verdictLabel(current, t));
  const hasPlan = history.some((entry) => entry.stop !== null || (entry.entryLow !== null && entry.entryHigh !== null));

  return (
    <div className={styles.root}>
      <p className={styles.headline} data-verdict={current}>{headline}</p>
      <div className={styles.strip} role="img" aria-label={v.stanceStripLabel.replace("{n}", String(days.length))} data-draw>
        {days.map((day, index) => {
          const previous = index > 0 ? days[index - 1]!.last : null;
          /* Günün İÇİNDE dönen görüş de bir değişimdir (sabah TUT, akşam SAT). */
          const turned = previous === null || previous !== day.last || day.slots.some((slot) => slot !== null && slot !== day.last);
          return (
            <div key={day.date} className={styles.day}>
              <span className={styles.turn} data-verdict={day.last} aria-hidden>
                {turned ? verdictLabel(day.last, t) : ""}
              </span>
              <span className={styles.cells} aria-hidden>
                {day.slots.map((slot, slotIndex) => (
                  <i key={TECHNICAL_SLOTS[slotIndex]} className={slot ? "bar-fill" : undefined} data-verdict={slot ?? undefined} />
                ))}
              </span>
              <span className={styles.date}>{formatEtDateCompact(day.date, locale)}</span>
            </div>
          );
        })}
      </div>
      <ul className="sr-only">
        {days.map((day) => (
          <li key={day.date}>
            {formatEtDateCompact(day.date, locale)}:{" "}
            {day.slots
              .map((slot, index) => (slot ? `${slotLabel(TECHNICAL_SLOTS[index]!, t)} ${verdictLabel(slot, t)}` : null))
              .filter(Boolean)
              .join(", ")}
          </li>
        ))}
      </ul>
      {hasPlan && (
        <details className={styles.detail}>
          <summary>{v.historyDetail}</summary>
          <div className={styles.detailBody}>
            <PlanHistory history={history} locale={locale} t={t} />
          </div>
        </details>
      )}
    </div>
  );
}
