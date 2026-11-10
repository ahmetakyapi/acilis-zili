import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import type { MoveSet } from "@/lib/theme-stats";
import type { ThemeRow } from "@/lib/themes-data";
import { cn, directionOf, directionText, formatPercent, formatPercentPlain, NO_VALUE } from "@/lib/utils";
import { RollingFigure } from "./RollingFigure";
import styles from "./ThemeDetail.module.css";

/**
 * Temanın ölçü ızgarası: yükselen/düşen, en güçlü, en zayıf ve en büyük üye.
 *
 * MEDYAN KAPAKTA (10 Kasım 2026). Izgaranın ilk hücresi günün medyanıydı;
 * yeniden tasarımda medyan sayfanın en büyük puntosuyla kapağa çıktı
 * (`ThemeReading`) ve burada ikinci kez yazılmıyor. Boşalan hücreye EN
 * BÜYÜK ÜYE geldi: haritanın en büyük karosunun sahibi, günlük hareketi ve
 * temadaki payı. "Sepetin ağırlığını kim taşıyor ve bugün ne yaptı" sorusu
 * medyanın (tipik üye) söylemediği şey; veri zaten satırda (`marketCap`).
 * En büyük üye medyan kümesine girmiyorsa (yüzdesi başka seansı anlatıyor)
 * hücre HİÇ basılmıyor ve ızgara üç sütuna iniyor: tire kutusu yok.
 *
 * MEDYAN, ORTALAMA DEĞİL. Sepette tek bir şirketin %20'lik bilanço günü
 * ortalamayı sürükleyip "tema bugün %2 yükseldi" dedirtir; medyan tipik
 * üyenin gününü söylüyor. Yükselen/düşen ve en iyi/en kötü de AYNI kümeden
 * (aynı seansı anlatan yüzdeler — `sameSessionMoves`): hücreler birbirini
 * tutuyor. Son kapanışa ait kümede sayılar yön rengi almıyor.
 *
 * KAÇ ÜYE MEDYANDA, KÜNYEDE (28 Eylül denetimi). Bu seansta işlem
 * görmeyen ya da kotasyonu gelmeyen üye medyana girmiyor; künye bunu
 * söylemiyordu ve Siber Güvenlik'te "0 / 10" yükselen/düşen, kapaktaki
 * "11 Şirket"in yanında bir üyeyi sessizce kaybediyordu. Eksik varsa
 * künye "10/11 Üye" diyor.
 *
 * Üye sayısı buradan çıktı: kapakta duruyor ve ızgarada ikinci kez yer
 * tutuyordu.
 */
export function ThemeStats({
  rows,
  moves,
  locale,
  labels,
}: {
  rows: ThemeRow[];
  moves: MoveSet | null;
  locale: string;
  labels: {
    title: string;
    medianSession: string;
    medianLastClose: string;
    medianMissing: string;
    coverage: string;
    breadth: string;
    best: string;
    worst: string;
    largest: string;
    share: string;
  };
}) {
  const neutral = moves?.basis !== "session";
  const tone = (value: number | null) =>
    value === null ? "text-muted" : neutral ? "text-body" : directionText(directionOf(value));

  const included = moves ? rows.filter((_, i) => moves.included[i]) : [];
  const ranked = [...included].sort((a, b) => b.changePct! - a.changePct!);
  const best = ranked[0] ?? null;
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const up = moves ? moves.values.filter((value) => value > 0).length : null;
  const down = moves ? moves.values.filter((value) => value < 0).length : null;
  const total = moves?.values.length ?? 0;
  const flat = total - (up ?? 0) - (down ?? 0);

  const sizedTotal = rows.reduce((sum, row) => sum + (row.marketCap !== null && row.marketCap > 0 ? row.marketCap : 0), 0);
  const giant = included.reduce<ThemeRow | null>(
    (top, row) => (row.marketCap !== null && row.marketCap > 0 && (top === null || row.marketCap > top.marketCap!) ? row : top),
    null,
  );
  /* En büyük üye yalnız TEMANIN en büyüğüyse: medyan kümesinin en büyüğü
     başka bir şirketse "en büyük" demek yanlış olurdu. */
  const largest =
    giant !== null && rows.every((row) => row.marketCap === null || row.marketCap <= giant.marketCap!) ? giant : null;

  const member = (row: ThemeRow | null, note?: string) =>
    row === null ? (
      <p className={cn("numeral", styles.metricValue, "text-muted")}>{NO_VALUE}</p>
    ) : (
      /* SAYI ÖNCE, KİMLİK ALTINDA (10 Kasım). Üye satırı sayının ÜSTÜNDEYDİ:
         dört hücrenin büyük rakamları iki ayrı hatta duruyordu (medyan ve
         yükselen/düşen y=1353, en güçlü/en zayıf y=1402 — 1440, canlı)
         ve ilk iki hücrenin altı boş kalıyordu. Ekran düzeni kuralı 4: yan
         yana ölçüler aynı hatta. Şimdi rakamlar tek hatta, ayrıntı (oran
         şeridi, üye) altında. */
      <>
        <p className={cn("numeral", styles.metricValue, tone(row.changePct))}>
          <RollingFigure value={formatPercent(row.changePct, locale)} />
        </p>
        <Link href={`/hisse/${row.symbol}`} prefetch={false} className={styles.member} data-cc={row.symbol}>
          <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="sm" />
          <span className={styles.memberText}>
            <b className="numeral">{row.symbol}</b>
            {/* Adı bilinmeyen üyede sembol ikinci kez yazılmaz. */}
            {(note ?? row.name) && <small>{note ?? row.name}</small>}
          </span>
        </Link>
      </>
    );

  return (
    <Panel>
      <PanelHeader
        title={labels.title}
        meta={
          moves === null
            ? undefined
            : [
                moves.basis === "session" ? labels.medianSession : labels.medianLastClose,
                ...(total < rows.length
                  ? [labels.coverage.replace("{count}", String(total)).replace("{total}", String(rows.length))]
                  : []),
              ].join(" · ")
        }
      />
      <div className={styles.metrics} data-cells={largest ? 4 : 3} data-draw>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>{labels.breadth}</p>
          <p className={cn("numeral", styles.metricValue)}>
            {up === null ? (
              <span className="text-muted">{NO_VALUE}</span>
            ) : (
              <>
                <span className={neutral ? "text-body" : "text-up"}>
                  <RollingFigure value={String(up)} />
                </span>
                <span className={styles.metricSlash}>/</span>
                <span className={neutral ? "text-body" : "text-down"}>
                  <RollingFigure value={String(down)} />
                </span>
              </>
            )}
          </p>
          {total > 0 && (
            /* Oranın çizgisi: yükselen, yatay ve düşen aynı kulvarda. Nötr
               kümede yön rengi yok ama iki parça iki tonda: oran son
               kapanışta da okunur (dizin kapağıyla aynı kural). Dolgu
               `flex-grow` ile orantılı, giriş `bar-fill` (globals; sınıf
               TSX'te — modülde animasyon adı çalışmaz). */
            <span className={styles.split} aria-hidden>
              {up! > 0 && <i className="bar-fill" data-tone={neutral ? "neutral-up" : "up"} style={{ flexGrow: up! }} />}
              {flat > 0 && <i data-tone="flat" style={{ flexGrow: flat }} />}
              {down! > 0 && (
                <i
                  className="bar-fill"
                  data-tone={neutral ? "neutral-down" : "down"}
                  style={{ flexGrow: down!, transformOrigin: "right center" }}
                />
              )}
            </span>
          )}
        </div>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>{labels.best}</p>
          {member(best)}
        </div>
        <div className={styles.metric}>
          <p className={styles.metricLabel}>{labels.worst}</p>
          {member(worst)}
        </div>
        {largest && (
          <div className={styles.metric}>
            <p className={styles.metricLabel}>{labels.largest}</p>
            {member(
              largest,
              sizedTotal > 0
                ? `${labels.share} ${formatPercentPlain((largest.marketCap! / sizedTotal) * 100, locale)}`
                : undefined,
            )}
          </div>
        )}
      </div>
      {moves === null && (
        <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
          {labels.medianMissing}
        </p>
      )}
    </Panel>
  );
}
