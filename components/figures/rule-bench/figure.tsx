import type { Dictionary } from "@/lib/i18n";
import type { ScreenData } from "@/lib/screening-data";
import { SCREEN_CATEGORIES, type CheckStatus } from "@/lib/screening";
import { RuleBenchArt } from "./art";
import type { BenchData } from "./model";
import "./bench.css";

type T = Dictionary["screening"];

/**
 * KURAL TEZGÂHI — hisse seçimi raporunun açıklayıcı figürü (anatomy skill'i,
 * kit components/iso). Raporun motoru (lib/screening.ts) bir sayı tablosu
 * üretiyor; bu bölüm aynı sonucu bir ölçü tezgâhı olarak gösterir. Her
 * sayı `data.result`tan: figür hesaplamaz.
 *
 * İKİNCİ SÜRÜM (12 Ekim, sahibinin Seans Zili'ne itirazıyla aynı: "yazılar
 * okunmuyor, dil kötü, renk az"): figür kartının monospace köşe yazıları,
 * lejant ve dört satırlık altyazı kalktı. Üstte büyük puan rozeti (rengi
 * BANTTAN, rapordaki puan halkasıyla aynı kural) ve renkli sayaçlar;
 * altta yedi istasyon kartı (puan + kural başına renkli nokta); bir
 * istasyon seçilince o kategorinin kuralları adlarıyla. Metin tek satır.
 */
export function RuleBenchFigure({ data, t }: { data: ScreenData; locale: string; t: T }) {
  const B = t.bench;
  const stations = SCREEN_CATEGORIES.map((category) => {
    const checks = data.result.checks.filter((check) => check.category === category);
    const score = category === "gate" ? null : (data.result.categories.find((entry) => entry.category === category)?.score ?? null);
    return {
      id: category,
      name: t.categories[category],
      score,
      statuses: checks.map((check) => check.status),
      names: checks.map((check) => t.checks[check.id].name),
    };
  });
  const bench: BenchData = { symbol: data.symbol, stations, score: data.result.score, eliminated: data.result.eliminated };
  const counts = { pass: 0, warn: 0, fail: 0, na: 0 } as Record<CheckStatus, number>;
  for (const check of data.result.checks) counts[check.status]++;
  const band = data.result.band ?? "none";

  return (
    <RuleBenchArt
      data={bench}
      summary={{ score: data.result.score, band, bandLabel: data.result.band ? t.bands[data.result.band] : B.noScore, counts }}
      labels={{
        score: B.score,
        counts: B.counts,
        stationsLabel: B.stationsLabel,
        note: B.note,
        gatePass: B.gatePass,
        gateFail: B.gateFail,
        blocked: B.blocked,
      }}
      label={B.label.replace("{symbol}", data.symbol)}
    />
  );
}
