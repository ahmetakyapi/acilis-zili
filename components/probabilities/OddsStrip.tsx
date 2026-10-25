import type { CSSProperties } from "react";
import { ArrowDown, ArrowUp, Minus } from "@phosphor-icons/react/dist/ssr";
import type { Dictionary, Locale } from "@/lib/i18n";
import { arcSegments, type FedMove, type HeadlineOdds } from "@/lib/probabilities";
import { shareText, signedPoints } from "./ProbabilityParts";
import styles from "./Probabilities.module.css";

/**
 * Tepe şeridi (25 Ekim, görsel tur). Sahibinin sözü: "üstteki yazı ve
 * alttaki kartlar daha iyi hissettirmeli, daha görsel olmalı ve kompakt
 * hissettirmeli." Üç satırlık kalın tepe cümlesi dört KADRANA dönüştü:
 * Fed, Temsilciler Meclisi, Senato, resesyon. Her biri büyük sayı + yarım
 * daire kadran + 24 saatlik değişim; telefonda 2×2, masaüstünde tek sıra.
 * Cümle kalkmadı: ekran okuyucuya şeridin özeti olarak okunuyor (page.tsx).
 *
 * KADRAN = YIĞININ BÜKÜLMÜŞ HÂLİ. Yay olayın tamamı (%100), dilimler
 * aşağıdaki kartın yığın çubuğuyla aynı sırada ve aynı renkte (Fed beş
 * sonuç, meclislerde iki parti, resesyonda Evet/Hayır). Meclislerde tepede
 * çoğunluk (%50) çentiği: hangi partinin çizgiyi geçtiğini yay kendisi
 * söylüyor. Sayı metin mürekkebinde; renk yalnız işarette.
 *
 * HAREKET: yay soldan sağa bir kez dolar (maske, `--ease-brand`); hareketi
 * azaltana son kare. CSS animasyonu ilk boyamadan başlıyor: sayfa önce
 * dolu sonra boş görünmüyor (PremiumMotion'ın "ilk ekran kımıldamaz"
 * kaydının korktuğu şey buydu).
 *
 * Kadran bir bağlantı: dokununca aşağıdaki kartına iner (telefonda kartlar
 * şeridin altında, ilk ekranın dışında).
 */

/** Yarım daire: merkez (50, 50), yarıçap 40; viewBox 100 × 56. */
const ARC_PATH = "M 10 50 A 40 40 0 0 1 90 50";

type P = Dictionary["probabilities"];

export type StripTile = HeadlineOdds & { label: string; href: string };

function Gauge({ tile, majority }: { tile: HeadlineOdds; majority: boolean }) {
  const parts = arcSegments(tile.segments.map((s) => s.p));
  const mask = `odds-arc-${tile.kind}`;
  return (
    <svg className={styles.gauge} viewBox="0 0 100 56" aria-hidden>
      <defs>
        <mask id={mask} className={styles.gaugeMask} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="56">
          <path d={ARC_PATH} pathLength={100} className={styles.gaugeSweep} />
        </mask>
      </defs>
      <path d={ARC_PATH} pathLength={100} className={styles.gaugeTrack} />
      <g mask={`url(#${mask})`}>
        {tile.segments.map((segment, i) => {
          const part = parts[i];
          const length = (part.end - part.start) * 100;
          if (length <= 0) return null;
          return (
            <path
              key={segment.key}
              d={ARC_PATH}
              pathLength={100}
              data-tone={segment.key}
              className={styles.gaugeArc}
              strokeDasharray={`${length.toFixed(2)} 200`}
              strokeDashoffset={(-part.start * 100).toFixed(2)}
            />
          );
        })}
      </g>
      {majority && <line x1="50" x2="50" y1="2" y2="18" className={styles.gaugeMajority} />}
    </svg>
  );
}

function wordOf(tile: HeadlineOdds, p: P): string {
  if (tile.kind === "fed") return p.stripMove[tile.key as FedMove] ?? tile.key;
  if (tile.kind === "recession") return p.stripChance;
  return p.stripParty[tile.key as "dem" | "rep"] ?? tile.key;
}

function DeltaLine({ delta, p, locale }: { delta: number | null; p: P; locale: Locale }) {
  if (delta === null) return null;
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const text = delta === 0 ? p.stripNoChange : p.stripDelta.replace("{n}", p.points.replace("{n}", signedPoints(delta, locale)));
  return (
    <span className={styles.tileDelta}>
      <Icon size={12} weight="bold" aria-hidden />
      <span className="numeral">{text}</span>
    </span>
  );
}

export function OddsStrip({ tiles, summary, locale, t }: { tiles: StripTile[]; summary: string | null; locale: Locale; t: Dictionary }) {
  const p = t.probabilities;
  if (tiles.length === 0) return null;
  return (
    <section className={styles.strip} data-probe="strip" aria-label={p.stripAria} style={{ "--tiles": tiles.length } as CSSProperties}>
      {summary && <p className="sr-only">{summary}</p>}
      <ul className={styles.stripList}>
        {tiles.map((tile, i) => {
          const word = wordOf(tile, p);
          const figure = tile.resolved ? p.stripParty[tile.key as "dem" | "rep"] ?? tile.key : shareText(tile.share, locale);
          const after = tile.resolved ? p.stripWon : word;
          return (
            <li key={tile.kind} style={{ "--i": i } as CSSProperties}>
              <a
                href={tile.href}
                className={styles.tile}
                data-kind={tile.kind}
                aria-label={`${tile.label}: ${figure} ${after}. ${p.stripJump.replace("{label}", tile.label)}`}
              >
                <span className={styles.tileLabel}>{tile.label}</span>
                <span className={styles.tileFigure} data-resolved={tile.resolved || undefined}>
                  <b className="numeral">{figure}</b>
                  <span className={styles.tileWord}>
                    <i data-tone={tile.key} aria-hidden />
                    {after}
                  </span>
                </span>
                <span className={styles.tileMeta}>
                  <DeltaLine delta={tile.delta} p={p} locale={locale} />
                  {tile.thin && <span className={styles.tileThin}>{p.pathThin}</span>}
                </span>
                <Gauge tile={tile} majority={tile.kind === "house" || tile.kind === "senate"} />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
