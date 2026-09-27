import { Reveal } from "@/components/motion/PremiumMotion";
import styles from "@/components/earnings/EarningsReport.module.css";
import type { Dictionary } from "@/lib/i18n";
import type { EarningsAnalysisRow } from "@/lib/schema";
import { cn, titleCaseLabel } from "@/lib/utils";
import { PLATE_LABEL } from "./shared";

/** CEO şeridi — sayfa dosyasından olduğu gibi taşındı. */
export function CeoStrip({ row, t }: { row: EarningsAnalysisRow; t: Dictionary }) {
  return (
    <>
          {row.ceoQuote && (
            /* CEO şeridi: solda kim, ortada ne dediği, sağda çağrıda
               vurguladığı başlıklar. Bir ara baş harflerden bir avatar
               halkası denendi ve kaldırıldı — kimsenin tanımadığı iki harf
               bir portre yerine geçmiyor, yalnızca yer kaplıyordu.

               Sağ üstteki dev tırnak kalktı (24 Eylül) — gerekçe modülde
               (`.ceoQuote`); yerini sol çizgi aldı. */
            <Reveal>
            <section className={cn(styles.ceoQuote, "relative p-4 sm:p-5")}>
              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                <div className="flex shrink-0 flex-col gap-px lg:w-44">
                  <span className={cn(PLATE_LABEL, "text-primary")}>
                    {t.analysis.ceoMessage}
                  </span>
                  <span className="text-read font-bold tracking-[-0.02em] text-strong">
                    {row.ceoQuote.name}
                  </span>
                  <span className="text-tiny text-muted">
                    {row.ceoQuote.title}
                  </span>
                </div>

                <span
                  aria-hidden
                  className="hidden w-px self-stretch bg-line lg:block"
                />

                <blockquote className="min-w-0 flex-1 border-t border-line pt-3.5 text-base italic leading-[22px] text-body [text-wrap:pretty] lg:border-t-0 lg:pt-0">
                  “{row.ceoQuote.quote}”
                </blockquote>

                {row.ceoQuote.topics && row.ceoQuote.topics.length > 0 && (
                  /* Rozetler karnedeki gibi: dar ekranda yan yana saran
                     hap, genis ekranda alt alta TAM GENISLIK seritler.
                     Yuvarlak haplar sag kolonda farkli genislikte kirpinti
                     gibi duruyordu; ayni genislikteki seritler bir liste
                     olarak okunuyor. */
                  <ul className="flex shrink-0 flex-wrap gap-1.5 lg:w-64 lg:flex-col lg:flex-nowrap lg:gap-2">
                    {/* Rozet metni kayıttan geliyor ve yazıldığı gibi
                        basılıyordu ("Aylık fırlatma temposu"); rozet bir
                        etiket, Title Case kapsamında. */}
                    {row.ceoQuote.topics.map((topic) => (
                      <li
                        key={topic}
                        className="rounded-md border border-primary-faint bg-primary-wash px-3 py-2 text-tiny font-semibold leading-[15px] text-primary-ink lg:text-center"
                      >
                        {titleCaseLabel(topic, row.locale)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
            </Reveal>
          )}
    </>
  );
}
