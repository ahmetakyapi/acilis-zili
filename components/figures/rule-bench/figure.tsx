import { Plate } from "@/components/iso/react/draw";
import type { Dictionary } from "@/lib/i18n";
import type { ScreenData } from "@/lib/screening-data";
import { SCREEN_CATEGORIES, type CheckStatus } from "@/lib/screening";
import { RuleBenchArt } from "./art";
import { readoutOf, type BenchData } from "./model";
import "./bench.css";

type T = Dictionary["screening"];

const KEYS: CheckStatus[] = ["pass", "warn", "fail", "na"];

/**
 * KURAL TEZGÂHI — hisse seçimi raporunun açıklayıcı figürü (12 Ekim; anatomy
 * skill'i, kit components/iso). Raporun motoru (lib/screening.ts) bir sayı
 * tablosu üretiyor; bu figür aynı sonucu bir ölçü tezgâhı olarak gösterir.
 * Her sayı `data.result`tan: figür hesaplamaz.
 *
 * Kart: sol üstte şekil numarası, sağ üstte başlık, sol altta etkileşim
 * ipucu, sağ altta canlı künye (sunucuda son pozun künyesi basılır).
 * Lejant ve doğru bir altyazı kartın altında; çizimde yazı yok, tek istisna
 * parçanın üstüne kazınmış sembol.
 */
export function RuleBenchFigure({ data, locale, t }: { data: ScreenData; locale: string; t: T }) {
  const B = t.bench;
  const stations = SCREEN_CATEGORIES.map((category) => {
    const checks = data.result.checks.filter((check) => check.category === category);
    const score = category === "gate" ? null : (data.result.categories.find((entry) => entry.category === category)?.score ?? null);
    return { id: category, name: t.categories[category], score, statuses: checks.map((check) => check.status) };
  });
  const bench: BenchData = { symbol: data.symbol, stations, score: data.result.score, eliminated: data.result.eliminated };
  const text = { passed: B.passed, warned: B.warned, failed: B.failed, missing: B.missing, score: B.score, gatePass: B.gatePass, gateFail: B.gateFail };
  const rest = stations.slice(1).map((station) => station.name.toLocaleLowerCase(locale === "tr" ? "tr-TR" : "en-US"));
  const list = rest.length > 1 ? `${rest.slice(0, -1).join(", ")} ${B.and} ${rest.at(-1)}` : rest.join("");

  return (
    <div className="rb-wrap">
      <Plate fig={B.fig} title={B.plateTitle} hint={B.hint} readout={readoutOf(bench, null, text)}>
        <RuleBenchArt data={bench} text={text} label={B.label.replace("{symbol}", data.symbol)} />
      </Plate>
      <ul className="rb-keys" aria-hidden="true">
        {KEYS.map((status) => (
          <li key={status} data-status={status}>
            <i />
            {B.keys[status]}
          </li>
        ))}
      </ul>
      <p className="rb-caption">{B.caption.replace("{symbol}", data.symbol).replace("{rest}", list)}</p>
    </div>
  );
}
