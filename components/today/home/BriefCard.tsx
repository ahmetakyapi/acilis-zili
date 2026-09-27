import { BriefBody } from "@/components/today/BriefBody";
import { BriefSwitch, type BriefView } from "@/components/today/BriefSwitch";
import { BRIEF_PUBLISH_TR, getLatestBrief, getEarningsBetween, weekAnchor } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { type Dictionary, type Locale } from "@/lib/i18n";
import { formatEtDateLong, formatEtDateCompact } from "@/lib/utils";

/**
 * Günün özeti — düz beyaz belge ve accent çerçeve (degradesi bir dönem
 * kalktı, gerekçe BriefSwitch'te). Bu kartın öne çıkması bilinçli: günü tek
 * paragrafta okumak ürünün vaadi.
 *
 * Kart iki metin taşıyor: günlük ve haftalık bülten. İkisi de burada
 * çekiliyor, sekme geçişi istemcide oluyor (BriefSwitch).
 *
 * "Bugünün kaydı" yerine "en son kayıt" okunuyor. Günlük bülten 16:00'da
 * yazıldığı için gün içinde saatlerce boş duran bir kutu vardı; artık dünkü
 * metin duruyor ve üstünde tarihini söyleyen bir uyarı var.
 */
/* ÖZET, BİLANÇO LİSTESİ KISAYSA UZUYOR. Sol kolonun boyu büyük ölçüde iki
   panele bağlı: günün özeti ve bugün bilanço açıklayanlar. İkincisi o günün
   takvimine bakıyor ve boş bir günde 113 piksele düşüyor (ölçüldü, iki
   satır) — o gün sol kolon sağdan 197 piksel kısa kalıyor ve `FillColumn`
   kapatacak yalnızca bir gizli satır buluyor.

   Kısa günde özetin katlanma noktası iki paragraf aşağı iniyor. Sayı
   ölçümden: açık dört paragraf 308 piksel tutuyor, yani paragraf başına
   ortalama 77 — iki paragraf açığın çoğunu kapatıyor, kalanı doldurma
   mekanizmasına kalıyor. Paragraf boyları 44 ile 132 piksel arasında
   değiştiği için hedef tam tutturulmuyor; amaç eşitlemek değil, uçurumu
   kapatmak.

   SAYIM BEDAVA: `getEarningsBetween` `cache()` sarmalı ve aynı istek içinde
   `EarningsToday` de aynı sorguyu soruyor — sağlayıcıya bir kez gidiliyor. */
const KISA_BILANCO_ESIGI = 3;
const OZET_TABAN_SATIR = 4;
const OZET_EK_SATIR = 4;

export async function BriefCard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const today = todayEt();
  const [daily, weekly, bugunBilanco] = await Promise.all([
    getLatestBrief(locale, "daily"),
    getLatestBrief(locale, "weekly"),
    getEarningsBetween(today, today),
  ]);
  const acikSatir =
    bugunBilanco.length < KISA_BILANCO_ESIGI
      ? OZET_TABAN_SATIR + OZET_EK_SATIR
      : OZET_TABAN_SATIR;

  const thisWeek = weekAnchor(today);

  const stampOf = (row: NonNullable<typeof daily>) => {
    const time = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(row.generatedAt));
    return `${row.generatedBy === "claude" ? "Claude · " : ""}${time}`;
  };

  const weekRange = (anchor: string) =>
    t.brief.weeklyRange
      .replace("{start}", formatEtDateCompact(anchor, locale))
      .replace("{end}", formatEtDateCompact(addEtDays(anchor, 4), locale));

  const dailyView: BriefView | null = daily && {
    headline: daily.headline,
    stamp: stampOf(daily),
    dateLabel: formatEtDateLong(daily.briefDate, locale),
    current: daily.briefDate === today,
    staleNote:
      daily.briefDate === today
        ? null
        : t.today.briefStaleNote
            .replace("{date}", formatEtDateLong(daily.briefDate, locale))
            .replace("{time}", BRIEF_PUBLISH_TR.daily),
    langNote: daily.locale === locale ? null : t.brief.fallbackNote,
    archiveHref: "/bulten",
  };

  const weeklyView: BriefView | null = weekly && {
    headline: weekly.headline,
    stamp: stampOf(weekly),
    dateLabel: weekRange(weekly.briefDate),
    current: weekly.briefDate === thisWeek,
    staleNote:
      weekly.briefDate === thisWeek
        ? null
        : t.today.briefWeeklyStaleNote
            .replace("{range}", weekRange(weekly.briefDate))
            .replace("{time}", BRIEF_PUBLISH_TR.weekly),
    langNote: weekly.locale === locale ? null : t.brief.fallbackNote,
    archiveHref: "/bulten?tur=haftalik",
  };

  return (
    <BriefSwitch
      daily={dailyView}
      weekly={weeklyView}
      /* Gövdeler BURADA çiziliyor: `BriefBody` ve iki bültenin ham metni
         sunucuda kalıyor, istemciye yalnızca çizilmiş ağaç gidiyor. */
      dailyBody={
        daily && (
          <BriefBody
            size="card-wide"
            markdown={daily.bodyMd}
            moreLabel={t.common.showAll}
            lessLabel={t.common.less}
            openLines={acikSatir}
          />
        )
      }
      weeklyBody={
        weekly && (
          <BriefBody
            size="card-wide"
            openLines={acikSatir}
            markdown={weekly.bodyMd}
            moreLabel={t.common.showAll}
            lessLabel={t.common.less}
          />
        )
      }
      labels={{
        tabs: { daily: t.brief.periodDaily, weekly: t.brief.periodWeekly },
        titles: {
          daily: t.today.briefTitle,
          weekly: t.today.briefWeeklyTitle,
        },
        empty: {
          daily: t.today.briefEmpty,
          weekly: t.today.briefWeeklyEmpty,
        },
        currentBadge: { daily: t.brief.today, weekly: t.brief.thisWeek },
        periodLabel: t.today.briefPeriod,
        more: t.common.showAll,
        archive: t.brief.archiveLink,
      }}
    />
  );
}
