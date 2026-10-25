import { verdictLabel, verdictOf, verdictPillClass, type VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { Quote } from "@/lib/providers/types";
import type { TechnicalAnalysisRow } from "@/lib/schema";
import { formatRange, planPosition, riskReward, technicalHref } from "@/lib/technical";
import { atlasGeometry, atlasSentence, domainFraction, type AtlasSummary } from "@/lib/technical-visuals";
import { formatPercent, formatPercentPlain, formatPrice } from "@/lib/utils";
import { planPositionLabel } from "./TechnicalCard";
import { PlanAtlasView, type AtlasGroup, type AtlasRowView } from "./PlanAtlasView";

export type PlanAtlasItem = {
  row: TechnicalAnalysisRow;
  quote: Quote | null;
  company: string | null;
  /** Kotasyon varken etiket (`livePriceLabel`, kartla aynı). */
  priceLabel: string;
};

const GROUP_ORDER: readonly VerdictKey[] = ["buy", "hold", "sell"];

/**
 * İMZA GÖRSELİ: "16 Hisse, Tek Harita" (25 Ekim, görsel zirve turu).
 *
 * Pano on altı kartı alt alta diziyordu ve "hangisi alım bölgesine yakın"
 * sorusu on altı rozetin tek tek okunmasıydı (telefonda ~9.000 piksel). Bu
 * panel aynı soruyu tek ekranda cevaplıyor: her hisse bir satır, ölçek
 * ortak (stop = 0, ilk hedef = 1; gerekçe `lib/technical-visuals.ts`),
 * satırlar fiyatın plandaki yerine göre sıralı — noktalar bir köşegen
 * çiziyor ve köşegenden kopan satır kendini gösteriyor.
 *
 * VERİ KARTLA AYNI KAYNAKTAN. Fiyat kartın fiyatı (canlı kotasyon, yoksa
 * analiz anı), konum kartın `planPosition`ı, tepedeki cümle pano araç
 * çubuğunun sayılarıyla aynı `atlasSummary`den. Kotasyonu olmayan satırın
 * noktası içi boş halka ve künyesi "Analiz Anında": eski bir fiyat seans
 * içi gibi basılmıyor (CLAUDE.md, veri dürüstlüğü 4).
 *
 * Sunucu bileşeni: bütün sayılar burada biçimleniyor; istemci adası
 * (`PlanAtlasView`) yalnız hangi satırın açık olduğunu tutuyor.
 */
export function PlanAtlas({
  items,
  summary,
  locale,
  t,
}: {
  items: readonly PlanAtlasItem[];
  summary: AtlasSummary;
  locale: Locale;
  t: Dictionary;
}) {
  const v = t.technicalVisuals;
  const money = (value: number) => formatPrice(value, locale, { currency: true });

  const rows: (AtlasRowView & { sortKey: number })[] = items.map(
    ({ row, quote, company, priceLabel }) => {
      const verdict = verdictOf(row.stance);
      const price = quote?.price ?? row.snapshot.price;
      const fromSnapshot = !quote;
      const drawn = atlasGeometry({
        verdict,
        price,
        entryLow: row.entryLow,
        entryHigh: row.entryHigh,
        stop: row.stop,
        targets: row.targets,
        supports: row.supports,
        resistances: row.resistances,
      });
      /* Plansız TUT satırı grubun ekseninde (stop → hedef) çizilemez; seviye
         ölçeğiyle çizmek aynı eksende başka bir şey göstermek olurdu. */
      const geometry = verdict !== "sell" && drawn?.scale === "levels" ? null : drawn;
      const position = planPosition(price, row.entryLow, row.entryHigh, row.stop);

      /* Sağ sütun: fiyatın ölçeğin referansına göre yeri, işaretli. Plan
         ölçeğinde referans alım bölgesi (kart rozetinin sayısı), seviye
         ölçeğinde 1'deki seviye. */
      let distance = "";
      let distanceTone: AtlasRowView["distanceTone"];
      if (geometry?.scale === "plan" && position) {
        if (position.kind === "inZone") {
          distance = v.inZone;
          distanceTone = "up";
        } else if (position.kind === "belowStop") {
          distance = v.belowStop;
          distanceTone = "down";
        } else {
          distance = formatPercent(position.kind === "above" ? position.pct : -position.pct, locale, 1);
        }
      } else if (geometry && price !== null) {
        distance = formatPercent(((price - geometry.unit) / geometry.unit) * 100, locale, 1);
      }

      /* Ayrıntı satırları — kartın üç hücresinin sayıları, aynı biçimle. */
      const facts: AtlasRowView["facts"] = [];
      if (geometry?.scale === "plan" && row.entryLow !== null && row.entryHigh !== null) {
        facts.push({ label: t.technical.entryZone, value: formatRange(row.entryLow, row.entryHigh, locale) });
        const targets = [...row.targets].sort((a, b) => a - b);
        targets.forEach((target, index) =>
          facts.push({ label: t.technical.target.replace("{n}", String(index + 1)), value: money(target), tone: "up" }),
        );
        if (row.stop !== null) {
          facts.push({ label: t.technical.stop, value: money(row.stop), tone: "down" });
          if (price !== null && price > row.stop) {
            facts.push({ label: v.distanceStop, value: formatPercentPlain(((price - row.stop) / price) * 100, locale, 1) });
          }
        }
        const rr = riskReward(row.entryHigh, row.stop, row.targets);
        if (rr) {
          facts.push({
            label: t.technical.riskReward,
            value: t.technical.riskRewardValue.replace("{n}", formatPrice(rr.ratio, locale, { digits: 1 })),
          });
        }
      } else if (geometry && price !== null) {
        facts.push({
          label: verdict === "sell" ? v.axisSell : t.technical.planNearestResistance,
          value: money(geometry.unit),
          tone: verdict === "sell" ? "down" : undefined,
        });
        facts.push({ label: t.technical.planNearestSupport, value: money(geometry.base) });
        facts.push({
          label: verdict === "sell" ? v.distanceSell : t.technical.planToResistance,
          value: formatPercentPlain(((geometry.unit - price) / price) * 100, locale, 1),
        });
        facts.push({ label: v.distanceSupport, value: formatPercentPlain(((price - geometry.base) / price) * 100, locale, 1) });
      }

      return {
        symbol: row.symbol,
        company,
        verdict,
        stance: verdictLabel(verdict, t),
        pillClass: verdictPillClass(verdict),
        href: technicalHref(row.symbol),
        geometry,
        fromSnapshot,
        priceText: formatPrice(price, locale, { currency: true }),
        priceLabel: fromSnapshot ? t.technical.atAnalysis : priceLabel,
        positionText: position ? planPositionLabel(position, locale, t) : null,
        distance,
        distanceTone,
        facts,
        /* Plansız ya da çizilemeyen satır grubun sonunda. */
        sortKey: geometry ? geometry.norm : Number.POSITIVE_INFINITY,
      };
    },
  );

  const groups: AtlasGroup[] = GROUP_ORDER.flatMap((verdict) => {
    const members = rows.filter((row) => row.verdict === verdict).sort((a, b) => a.sortKey - b.sortKey);
    if (members.length === 0) return [];
    /* Grubun ekseni: AL/TUT plan ölçeğinde, SAT seviye ölçeğinde. Alım
       planı olmayan TUT satırı seviye ölçeğine düşmüyor (`atlasGeometry`
       çağrısının yanı) — iki ölçek aynı grupta karışmasın. */
    const planScale = verdict !== "sell";
    return [
      {
        verdict,
        label: verdictLabel(verdict, t),
        count: members.length,
        axisStart: planScale ? v.axisStop : v.axisSupport,
        axisEnd: planScale ? v.axisTarget : v.axisSell,
        column: planScale ? v.columnPlan : v.columnLevels,
        note: planScale ? null : v.sellScaleNote,
        rows: members,
      },
    ];
  });

  /* Fiyat künyesi: satırların hepsi aynı etiketi taşıyorsa o; karışıksa
     en temkinlisi ("Son Fiyat") — hiçbir satırı olduğundan taze göstermez. */
  const quoted = rows.filter((row) => !row.fromSnapshot).map((row) => row.priceLabel);
  const basis = quoted.length === 0
    ? t.technical.atAnalysis
    : quoted.every((label) => label === quoted[0])
      ? quoted[0]
      : t.market.lastPrice;

  const sentence = atlasSentence(summary, {
    zoneSome: v.sentenceZoneSome,
    zoneNone: v.sentenceZoneNone,
    nearOne: v.sentenceNearOne,
    nearMany: v.sentenceNearMany,
    stopOne: v.sentenceStopOne,
    stopMany: v.sentenceStopMany,
    stopNone: v.sentenceStopNone,
    belowOne: v.sentenceBelowOne,
    belowMany: v.sentenceBelowMany,
  });

  return (
    <PlanAtlasView
      title={v.atlasTitle.replace("{n}", String(items.length))}
      sentence={sentence}
      basis={`${v.priceBasis}: ${basis}`}
      groups={groups}
      anySnapshot={rows.some((row) => row.fromSnapshot)}
      /* 0 ve 1'in eksendeki yeri — her satırda kılavuz çizgisi. */
      axis={{ zero: domainFraction(0), one: domainFraction(1) }}
      copy={{
        label: v.atlasLabel,
        scaleNote: v.scaleNote,
        legendZone: v.legendZone,
        legendPrice: v.legendPrice,
        legendSnapshot: v.legendSnapshot,
        legendStop: v.legendStop,
        legendTarget: v.legendTarget,
        legendLevel: v.legendLevel,
        noLevels: v.noLevels,
        noPlan: v.noPlan,
        details: v.details,
        openPlan: v.openPlan,
        hint: v.hint,
      }}
    />
  );
}
