import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
  verdictPillClass,
} from "@/lib/analysis";
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
  className,
}: {
  badge: AnalysisBadgeData;
  t: Dictionary;
  size?: "sm" | "md";
  className?: string;
}) {
  const verdict = verdictOf(badge.verdict);
  return (
    <Link
      href={analysisHref(badge.symbol, badge.period)}
      prefetch={false}
      className={cn(
        "tap-44 z-10 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-bold ring-1 ring-current/25 ring-inset transition-opacity hover:opacity-80",
        verdictPillClass(verdict),
        size === "sm"
          ? "px-2.5 py-1 text-tiny sm:px-2 sm:py-[3px] sm:text-nano"
          : "px-3 py-1.5 text-tiny sm:px-2.5 sm:py-1",
        className,
      )}
    >
      <span>{verdictLabel(verdict, t)}</span>
      <span aria-hidden className="opacity-45">
        ·
      </span>
      <span className="figure">{badge.score}</span>
      <span aria-hidden className="opacity-45">
        ·
      </span>
      <span>{t.analysis.analysisLink}</span>
    </Link>
  );
}
