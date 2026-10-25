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
 *
 * İKİNCİ TUR (25 Ekim, sahibinin sözü: "kadranlar küçük ve yarım halka
 * zayıf"). Halka kalınlaştı (10 → 14 birim) ve büyüdü (92 → 136 piksel);
 * büyük sayı halkanın İÇİNE, merkezine oturdu: göz sayıyı ve yayı tek
 * bakışta okuyor, kutunun sağında ayrı bir küçük yay kalmadı. 24 saatlik
 * değişim düz metinden rozete döndü (ton farkı, işaret okla; yön rengi
 * yok, bu sayfa fiyat yönü anlatmıyor). Kutu yüksekliği masaüstünde
 * kadranın boyu kadar (ölçüm Probabilities.module.css → ŞERİT).
 */

/** Yarım daire: merkez (50, 52), yarıçap 42; viewBox 100 × 59 (kalın halka payıyla). */
const ARC_PATH = "M 8 52 A 42 42 0 0 1 92 52";

type P = Dictionary["probabilities"];

export type StripTile = HeadlineOdds & { label: string; href: string };

function Gauge({ tile, majority }: { tile: HeadlineOdds; majority: boolean }) {
  const parts = arcSegments(tile.segments.map((s) => s.p));
  const mask = `odds-arc-${tile.kind}`;
  return (
    <svg className={styles.gaugeSvg} viewBox="0 0 100 59" aria-hidden>
      <defs>
        <mask id={mask} className={styles.gaugeMask} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="59">
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
      {majority && <line x1="50" x2="50" y1="1" y2="19" className={styles.gaugeMajority} />}
    </svg>
  );
}

function wordOf(tile: HeadlineOdds, p: P): string {
  if (tile.kind === "fed") return p.stripMove[tile.key as FedMove] ?? tile.key;
  if (tile.kind === "recession") return p.stripChance;
  return p.stripParty[tile.key as "dem" | "rep"] ?? tile.key;
}

function DeltaBadge({ delta, p, locale }: { delta: number | null; p: P; locale: Locale }) {
  if (delta === null) return null;
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  const text = delta === 0 ? p.stripNoChange : p.stripDelta.replace("{n}", p.points.replace("{n}", signedPoints(delta, locale)));
  return (
    <span className={styles.tileDelta} data-flat={delta === 0 || undefined}>
      <Icon size={11} weight="bold" aria-hidden />
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
                <span className={styles.gauge}>
                  <Gauge tile={tile} majority={tile.kind === "house" || tile.kind === "senate"} />
                  <b className={`${styles.gaugeFigure} numeral`} data-resolved={tile.resolved || undefined}>{figure}</b>
                </span>
                <span className={styles.tileLabel}>{tile.label}</span>
                <span className={styles.tileWord}>
                  <i data-tone={tile.key} aria-hidden />
                  {after}
                </span>
                <span className={styles.tileMeta}>
                  <DeltaBadge delta={tile.delta} p={p} locale={locale} />
                  {tile.thin && <span className={styles.tileThin}>{p.pathThin}</span>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
