import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { cn } from "@/lib/utils";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
  verdictPillClass,
} from "@/lib/analysis";
import { ScoreMeter } from "@/components/ui/VerdictPill";
import type { AnalysisBadge as AnalysisBadgeData } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";

/**
 * Takvim satırındaki "AL · 77 · Analiz →" rozeti.
 *
 * Analizler sekmesi aranmasın diye var: bilançosu okunmuş bir şirketi
 * takvimde gören okuyucu, listeye dönüp aramadan doğrudan analize geçer.
 *
 * Rozet KENDİ bağlantısını taşıyor ve içinde bulunduğu kart başka bir yere
 * (şirket sayfasına) gidiyor. İç içe `<a>` geçersiz HTML olduğu için kart,
 * yüzeyi kaplayan ayrı bir bağlantı katmanıyla kuruluyor; rozet o katmanın
 * üstünde duruyor (`relative z-10`).
 *
 * ---- Telefonda ıskalanıyordu ----
 *
 * Rozet yirmi piksel yüksekliğindeydi ve ALTINDA kartın tamamını kaplayan
 * başka bir bağlantı var. Iskalayan dokunuş boşa gitmiyor, YANLIŞ YERE
 * gidiyordu: okuyucu analize basıyor, kendini şirket sayfasında buluyordu.
 * Bir hedefin ıskalanınca sessiz kalması kusurdur; başka bir ekrana götürmesi
 * hatadır — geri gelip yeniden nişan almak gerekiyor.
 *
 * İki ayrı düzeltme, çünkü sorun da iki tane:
 *
 * 1. GÖRÜNÜR ÖLÇÜ. Hap bir kademe büyüdü (nano → tiny, dolgu 3px → 6px) ve
 *    iç bir halka aldı. Sınırı olmayan renkli bir yazı, tıklanabilir bir
 *    düğme gibi okunmuyordu; artık kendi kenarı var.
 * 2. DOKUNMA ALANI. Görünür ölçüyü 44 piksele çıkarmak takvim satırını
 *    şişirirdi; `.tap-44` (app/globals.css) hedefi düzene dokunmadan
 *    büyütüyor. Sözde öğe bağlantının kendi boyama katmanında olduğu için
 *    `z-10` onu da kapsıyor, yani kart katmanının üstünde kalıyor.
 *
 * Geniş ekranda ikisi de kapalı: imleç hassas, orada eski ölçü ve hedef
 * genişletmesi komşu satırların üstüne taşardı.
 */
export function AnalysisBadge({
  badge,
  t,
  size = "md",
  compact = false,
  className,
}: {
  badge: AnalysisBadgeData;
  t: Dictionary;
  size?: "sm" | "md";
  /**
   * Yoğun tablolarda (Haftanın Programı) "Analiz" sözcüğü düşer, ok kalır:
   * sütun 6,75rem ve tam hap ~8,3rem — sığmayınca komşu sütunun sayısının
   * üstüne biniyordu (30 Ekim, 1280'de ölçüldü). Erişilebilir ad değişmez.
   */
  compact?: boolean;
  className?: string;
}) {
  const verdict = verdictOf(badge.verdict);
  const label = verdictLabel(verdict, t);
  return (
    <Link
      href={analysisHref(badge.symbol, badge.period)}
      prefetch={false}
      aria-label={t.analysis.analysisOpenLabel
        .replace("{symbol}", badge.symbol)
        .replace("{verdict}", label)
        .replace("{score}", String(badge.score))}
      className={cn(
        /* GÖRÜŞ HAPI (30 Ekim). Tek renkli "AL · 81 · Analiz →" üç bilgiyi
           aynı tonda, ara noktalarla diziyordu: ana sayfada 7,5rem'lik sabit
           sütuna sığmayınca ok kenara yapışıyor, "Analiz→" tek kelime gibi
           okunuyordu; sahibinin itirazı "çok kötü duruyor, daha görsel".
           Şimdi skor bir ÇİZİM: mini halka (ScoreRing'in dili, aynı
           `--verdict-*` tonu, aynı kendini çizme animasyonu) + görüş + sayı.
           Renk anlama göre bölünüyor (CLAUDE.md "renk anlam taşır"): sol
           parça görüşün tonu (yargı), sağ parça mavi (etkileşim). Ok metin
           glifi değil ikon ve hover'da 2px ilerliyor.
           Ölçü TimingChip'le aynı (sm'de h-7): aynı sütunda hat tutuyor.
           Genişlik İÇERİKTEN gelir, sabit sütuna sıkıştırılmaz (gerekçe
           EarningsToday → subgrid; denetim scripts/smoke.mjs "sıkışan"). */
        "group tap-44 z-10 inline-flex shrink-0 items-stretch overflow-hidden whitespace-nowrap rounded-full text-tiny font-bold ring-1 ring-line ring-inset transition-[box-shadow] hover:ring-line-strong",
        size === "sm" ? "h-8 sm:h-7" : "h-8",
        className,
      )}
    >
      <span
        className={cn(
          /* `flex-1`: hap sütuna gerildiğinde (EarningsToday) fazlayı yargı
             parçası alır, bağlantı parçası sabit kalır. */
          "inline-flex flex-1 items-center justify-center gap-1.5",
          size === "sm" ? "pr-2.5 pl-1.5" : "pr-3 pl-2",
          verdictPillClass(verdict),
        )}
      >
        <ScoreMeter score={badge.score} verdict={verdict} className="size-[18px]" />
        <span className="tracking-[0.02em]">{label}</span>
        <span className="figure font-semibold opacity-75">{badge.score}</span>
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 border-l border-line bg-surface font-semibold text-primary-ink transition-colors group-hover:bg-primary-tint",
          compact ? "px-1.5" : size === "sm" ? "pr-2 pl-2.5" : "pr-2.5 pl-3",
        )}
      >
        {!compact && <span>{t.analysis.analysisOpen}</span>}
        <CaretRight
          aria-hidden
          weight="bold"
          className="size-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      </span>
    </Link>
  );
}
