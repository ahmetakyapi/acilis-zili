import { ArrowDownRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import css from "./CompanyEarnings.module.css";

/**
 * OYUN EŞİĞİ — `/bilancolar/[symbol]`, "Beklentiyi Geçer mi?" panelinin sağ
 * hücresi, KARNE YOKKEN (10 Kasım 2026, ikinci tur).
 *
 * NEDEN: sağlayıcı beklenti karnesini vermediğinde (yeni halka arz, eksik
 * geçmiş, sağlayıcı düştü) panel tek sütuna düşüyor, iki oy kartı 580
 * piksel tavanla solda duruyor ve 1440'ta sağda ~700 piksel boş kalıyordu
 * (ölçüm `CompanyEarnings.module.css` → "EŞİK HÜCRESİ"). Boşluk esnetilmedi
 * (kartları 1280 piksele yaymak onları şeride çevirirdi), eldeki veriyle
 * dolduruldu: oyun sorusunun EŞİĞİ. "Geçer mi" neyi geçer? Sıradaki
 * çeyreğin EPS beklentisini. Sayı takvimdeki beklentinin kendisi
 * (`data.next.epsEstimate`, üst paneldeki hücreyle aynı kaynak); çizim iki
 * yanı adlandırılmış tek ray: eşiğin solu "Kaçırır", sağı "Geçer". Altında
 * puanlama kuralı (yarım sent) — önce yalnız panelin dip künyesindeydi.
 *
 * Beklenti de yoksa hücre basılmaz, panel tek sütun kalır (uydurma eşik yok).
 */
export function VoteThreshold({
  title,
  value,
  note,
  labels,
}: {
  title: string;
  /** Biçimlenmiş EPS beklentisi. */
  value: string;
  note: string;
  labels: { beat: string; miss: string };
}) {
  return (
    <section className={css.karne} aria-label={title}>
      <div className={css.karneHead}>
        <p className={css.karneLabel}>{title}</p>
        <p className={cn("figure", css.karneValue)}>{value}</p>
      </div>
      <div className={css.threshold} aria-hidden>
        <span className={css.thresholdSide} data-side="miss">
          <ArrowDownRight size={13} weight="bold" />
          {labels.miss}
        </span>
        <span className={css.thresholdLane}>
          <span data-side="miss" />
          <i />
          <span data-side="beat" />
        </span>
        <span className={css.thresholdSide} data-side="beat">
          {labels.beat}
          <ArrowUpRight size={13} weight="bold" />
        </span>
      </div>
      <p className={css.karneNote}>{note}</p>
    </section>
  );
}
