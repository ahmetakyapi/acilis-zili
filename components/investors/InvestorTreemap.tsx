import type { CSSProperties } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import themeStyles from "@/components/themes/Themes.module.css";
import { TreemapStage, type PeekData } from "@/components/themes/TreemapStage";
import type { Dictionary } from "@/lib/i18n";
import type { PositionView } from "@/lib/investor-view";
import { splitSmall, squarify } from "@/lib/theme-view";
import { cn, formatMoneyCompact, formatPercent } from "@/lib/utils";
import { formatShares, formatWeight, moveHeat, moveLabel, moveTone } from "./format";
import styles from "./Investors.module.css";

/**
 * Portföy haritası — her pozisyon DEĞERİYLE orantılı bir karo, rengi bu
 * çeyrekteki hareketi (28 Eylül).
 *
 * `/tema` haritasının dili, kendi anlamıyla: orada renk günün fiyat
 * hareketi, burada yöneticinin ADET kararı. Yeni pozisyon en koyu yeşil,
 * artırılan ve azaltılan adet değişiminin büyüklüğüyle kademeli, aynı
 * kalan nötr (eşikler `moveHeat`). Karonun büyük sayısı portföydeki PAY:
 * alanın hangi sayıdan geldiğini söylüyor.
 *
 * Yerleşim ve gruplama tema haritasının saf hesapları (`squarify`,
 * `splitSmall`); iki yerleşim (geniş ve telefon), künye kartı ve giriş
 * koreografisi `TreemapStage`ten. Künye kartı `/hisse/{sembol}`e gidiyor;
 * o yüzden yalnızca SEMBOLÜ BİLİNEN ve sitede sayfası olan karo kart
 * taşıyor. Sembolü bilinmeyen pozisyon (tahvil, yurt dışı hisse) yine
 * alanıyla çiziliyor ama bağlantısız, adıyla.
 */

/** Geniş yerleşimin oranı — Investors.module.css → `.mapBody .map` ile aynı
    sayı. Tema haritası bu sayıyı genişliğe göre değiştiriyor (1,9 / 2,1 /
    2,6); burada tek oran, çünkü yerleşim yüzde ve oranı tutmayan kap
    karoları geriyor. */
const WIDE_ASPECT = 2.2;

const LAYOUTS = [
  { key: "wide", aspect: WIDE_ASPECT, box: { w: 550, h: 290 }, max: { w: 1300, h: 620 }, min: { w: 36, h: 30 } },
  { key: "narrow", aspect: 0.8, box: { w: 294, h: 368 }, max: { w: 640, h: 800 }, min: { w: 48, h: 40 } },
] as const;
const REACH = {
  logo: { w: 88, h: 66 },
  name: { w: 122, h: 84 },
  foot: { w: 234, h: 132 },
} as const;
const GROUP_LOGOS = 4;
const CARD_EDGE = { start: 32, end: 68 } as const;
/** Haritada en fazla kaç karo — Bridgewater bin pozisyon taşıyor. Karonun
    yazdığı pay yine PORTFÖYDEKİ pay; harita en büyükleri gösteriyor. */
export const MAP_MAX = 60;

export type MapPosition = PositionView & { ticker: string | null; linkable: boolean; logoUrl: string | null };

export function InvestorTreemap({
  positions,
  locale,
  t,
}: {
  positions: MapPosition[];
  locale: string;
  t: Dictionary["investors"];
}) {
  const shown = positions.filter((position) => position.value > 0).slice(0, MAP_MAX);
  const label = (position: MapPosition) => position.ticker ?? position.issuer;

  return (
    <TreemapStage
      className={themeStyles.stage}
      labels={{ cap: t.sharesLabel, share: t.share, open: t.openStock }}
    >
      {LAYOUTS.map((layout) => {
        const weights = shown.map((position) => position.value);
        const minShare = (layout.min.w * layout.min.h) / (layout.box.w * layout.box.h);
        const { kept, grouped } = splitSmall(weights, minShare);
        const groupWeight = grouped.reduce((sum, i) => sum + weights[i], 0);
        const rects = squarify(
          [...kept.map((i) => weights[i]), ...(grouped.length > 0 ? [groupWeight] : [])],
          layout.aspect,
        );
        const rosterId = `investor-small-${layout.key}`;
        return (
          <div key={layout.key} className={themeStyles.mapLayout} data-layout={layout.key}>
            <div className={cn(themeStyles.map, styles.map)}>
              {rects.map((rect, rank) => {
                const center = rect.x + rect.w / 2;
                const place = {
                  left: `${rect.x}%`,
                  top: `${rect.y}%`,
                  width: `${rect.w}%`,
                  height: `${rect.h}%`,
                  "--i": rank,
                } as CSSProperties;
                const reach = (step: { w: number; h: number }) =>
                  (rect.w / 100) * layout.max.w >= step.w && (rect.h / 100) * layout.max.h >= step.h;

                if (rect.index >= kept.length) {
                  const members = grouped.map((i) => shown[i]);
                  const text = t.mapSmall.replace("{count}", String(members.length));
                  return (
                    <a
                      key="group"
                      href={`#${rosterId}`}
                      className={cn(themeStyles.tile, themeStyles.groupTile)}
                      style={place}
                      aria-label={`${text}: ${members.map(label).join(", ")}`}
                    >
                      <span className={themeStyles.tileFace}>
                        <span className={themeStyles.groupLogos} aria-hidden>
                          {members
                            .filter((member) => member.ticker)
                            .slice(0, GROUP_LOGOS)
                            .map((member) => (
                              <LogoTile key={member.cusip} symbol={member.ticker!} logoUrl={member.logoUrl} size="xs" />
                            ))}
                        </span>
                        <span className={themeStyles.groupLabel}>{text}</span>
                        <span className={themeStyles.groupCount} aria-hidden>
                          +{members.length}
                        </span>
                      </span>
                    </a>
                  );
                }

                const position = shown[kept[rect.index]];
                const heat = moveHeat(position.move, position.changePct);
                const weight = formatWeight(position.weight, locale);
                const move =
                  position.changePct !== null && position.move !== "unchanged"
                    ? `${moveLabel(position.move, t)} ${formatPercent(position.changePct, locale, 0)}`
                    : moveLabel(position.move, t);
                const face = (
                  <span
                    className={cn(themeStyles.heat, themeStyles.tileFace)}
                    data-heat-tone={heat.tone}
                    data-heat-level={heat.level}
                  >
                    <span className={themeStyles.tileHead}>
                      {position.ticker && reach(REACH.logo) && (
                        <LogoTile symbol={position.ticker} logoUrl={position.logoUrl} size="md" className={themeStyles.tileLogo} />
                      )}
                      <span className={themeStyles.tileId}>
                        <span className={cn("numeral", themeStyles.tileSymbol)}>{position.ticker ?? position.issuer}</span>
                        {reach(REACH.name) && <span className={themeStyles.tileName}>{position.issuer}</span>}
                      </span>
                    </span>
                    <span className={cn("numeral", themeStyles.tilePct)}>{weight}</span>
                    {reach(REACH.foot) && (
                      <span className={themeStyles.tileFoot}>
                        <span>{move}</span>
                        <b className="numeral">{formatMoneyCompact(position.value, locale)}</b>
                      </span>
                    )}
                  </span>
                );
                const aria = [label(position), position.issuer, weight, move, formatMoneyCompact(position.value, locale)].join(" · ");
                if (!position.linkable || !position.ticker) {
                  return (
                    <span key={position.cusip} className={themeStyles.tile} style={place} role="img" aria-label={aria}>
                      {face}
                    </span>
                  );
                }
                const peek: PeekData = {
                  symbol: position.ticker,
                  name: position.issuer,
                  price: formatMoneyCompact(position.value, locale),
                  pct: move,
                  tone: moveTone(position.move),
                  cap: formatShares(position.amount, locale),
                  share: weight,
                  note: "",
                };
                return (
                  <Link
                    key={position.cusip}
                    href={`/hisse/${position.ticker}`}
                    prefetch={false}
                    className={themeStyles.tile}
                    style={place}
                    data-card-x={center < CARD_EDGE.start ? "start" : center > CARD_EDGE.end ? "end" : "center"}
                    data-peek={JSON.stringify(peek)}
                    aria-label={aria}
                  >
                    {face}
                  </Link>
                );
              })}
            </div>
            {grouped.length > 0 && (
              <div id={rosterId} className={themeStyles.roster}>
                <h3 className={themeStyles.rosterTitle}>
                  {t.mapSmallTitle} <span className="numeral">{grouped.length}</span>
                </h3>
                <ul className={themeStyles.rosterList}>
                  {grouped.map((i) => {
                    const position = shown[i];
                    const heat = moveHeat(position.move, position.changePct);
                    const body = (
                      <>
                        {position.ticker ? (
                          <LogoTile symbol={position.ticker} logoUrl={position.logoUrl} size="sm" />
                        ) : (
                          <span className={styles.noLogo} aria-hidden />
                        )}
                        <span className={themeStyles.rosterText}>
                          <b className="numeral">{position.ticker ?? position.issuer}</b>
                          <small>{position.issuer}</small>
                        </span>
                        <span
                          className={cn("numeral", themeStyles.heat, themeStyles.rosterPct)}
                          data-heat-tone={heat.tone}
                          data-heat-level={heat.level}
                        >
                          {formatWeight(position.weight, locale)}
                        </span>
                      </>
                    );
                    return (
                      <li key={position.cusip} className="min-w-0">
                        {position.linkable && position.ticker ? (
                          <Link href={`/hisse/${position.ticker}`} prefetch={false} className={themeStyles.rosterItem}>
                            {body}
                          </Link>
                        ) : (
                          <span className={themeStyles.rosterItem}>{body}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </TreemapStage>
  );
}
