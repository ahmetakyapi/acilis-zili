import type { CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { themeDek, themeTitle } from "@/content/themes";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { ThemeBoard as ThemeBoardData, ThemeCard } from "@/lib/theme-board";
import { cn, directionOf, directionText, formatPercent, NO_VALUE } from "@/lib/utils";
import { RollingFigure } from "./RollingFigure";
import styles from "./ThemeBoard.module.css";
import { ThemeStrip } from "./ThemeStrip";

/**
 * Temalar panosu — `/tema` dizininin gövdesi (10 Kasım 2026, yeniden tasarım).
 *
 * ÖNCE: kapakta on satırlık sıralama, altında on kartlık asimetrik galeri.
 * Aynı medyan İKİ KEZ yazılıyordu (sıralamada 14 punto, kartta 54 punto) ve
 * on dev renkli rakam on ayrı kutuda duruyordu: her kartın dağılım şeridi
 * kendi kutusunda, kendi "−%3 · 0 · +%3" etiketiyle (10 × 3 = 30 etiket) ve
 * kartlar editoryal sırada olduğu için "hangisi önde" sorusu ancak kapağa
 * geri dönülerek cevaplanıyordu. Dar kartın yanındaki geniş kartta 81
 * piksele varan ölü boşluk (1440, canlı), telefonda sayfa 5.787 piksel.
 *
 * ŞİMDİ: tek pano. Her tema bir SATIR, satırlar günün medyanına göre sıralı
 * ve bütün şeritler AYNI eksende alt alta: sıfır çizgisi satırlardan
 * kesintisiz geçiyor, medyan düğmelerinin yatay konumu temalar arasındaki
 * farkı uzunluk olarak okutuyor (ortak ölçek `board.scale`, yüzde 90'lık
 * dilim — lib/theme-view.ts). Ölçek etiketi başlıkta BİR KEZ. Satırın
 * çizimi temanın kendi dağılımı: her üye bir çentik, medyan düğme, ölçüt
 * fonu (varsa ve aynı seansı anlatıyorsa) içi boş halka. Sağda medyanın
 * sayısı ve yükselen/düşen oranı. Kart sayısı ne olursa olsun pano dolu
 * biter: ızgara yok, yarım satır yok.
 *
 * SIRA VERİYE BAĞLI AMA KUTU OYNAMIYOR. Eski galeri sırayı veriye
 * bağlamıyordu ("yedek ile canlı ızgara farklı olur, akışla gelen veri
 * kartları yerinden oynatırdı" — 28 Eylül). O kaygı eş boylu satırlarda
 * yok: yedek aynı sayıda satırı editoryal sırayla ve sayısız basıyor, veri
 * inince satırların İÇİ değişiyor, panonun boyu değil (`ThemeRanking` aynı
 * kuralla çalışıyor).
 *
 * Ortak kümenin DIŞINDA kalan tema (yüzdesi başka seansı anlatan) dipte,
 * sayısız ve şeritsiz: bir önceki günün medyanını bugünün ekseninde
 * göstermek onu bugünün en zayıfı gibi okuturdu (28 Eylül denetimi,
 * `ThemeRanking` ile aynı kural).
 *
 * ÖLÇÜM (gerçek sayfa + sahte sağlayıcı, iki tema; önce = canlı 78ad602):
 * ThemeBoard.module.css başında.
 */

/** Satırda gösterilen logo sayısı; fazlası "+N". */
const ROW_LOGOS = 5;

export function ThemeBoard({
  board,
  basis,
  benches,
  locale,
  t,
}: {
  board: ThemeBoardData;
  /** Ortak ölçeğin seansı; yedekte yok. */
  basis: "session" | "lastClose" | null;
  /** Tema → ölçüt fonunun günlük yüzdesi; yalnız temayla AYNI seansı
      anlatıyorsa (kural detaydaki ölçüt kıyasıyla aynı). */
  benches: Readonly<Record<string, number>>;
  locale: Locale;
  t: Dictionary;
}) {
  const inScale = (card: ThemeCard) => basis !== null && card.basis === basis && card.median !== null;
  const sorted = basis
    ? [...board.cards].sort((a, b) => {
        if (inScale(a) !== inScale(b)) return inScale(a) ? -1 : 1;
        return (b.median ?? 0) - (a.median ?? 0);
      })
    : board.cards;
  const scale = board.scale;
  const pre = board.phase === "pre-market";
  const closed = board.phase === "lastClose";
  const clippedLow = scale !== null && sorted.some((card) => inScale(card) && card.points.some((p) => p.change < -scale));
  const clippedHigh = scale !== null && sorted.some((card) => inScale(card) && card.points.some((p) => p.change > scale));
  const anyBench = sorted.some((card) => inScale(card) && benches[card.theme.slug] !== undefined);

  return (
    <Panel className={styles.panel}>
      <PanelHeader
        title={pre ? t.themes.rankTitlePre : closed ? t.themes.rankTitleClose : t.themes.rankTitle}
        meta={t.themes.rankMeta}
      />
      <div className={styles.board}>
        <div className={styles.head} aria-hidden>
          <span className={styles.headTheme}>{t.themes.boardTheme}</span>
          <span className={cn("numeral", styles.axis)}>
            <span>{scale === null ? "" : `${clippedLow ? "≤ " : ""}${formatPercent(-scale, locale, 0)}`}</span>
            <span>{scale === null ? "" : "0"}</span>
            <span>{scale === null ? "" : `${clippedHigh ? "≥ " : ""}${formatPercent(scale, locale, 0)}`}</span>
          </span>
          <span className={styles.headFig}>{t.themes.boardMedian}</span>
          <span className={styles.headSplit}>{t.themes.breadth}</span>
        </div>
        <ol className={styles.rows}>
          {sorted.map((card, index) => {
            const live = inScale(card);
            const flag =
              card.theme.slug === board.leader
                ? pre ? t.themes.strongestPre : closed ? t.themes.strongestClose : t.themes.strongest
                : card.theme.slug === board.laggard
                  ? pre ? t.themes.weakestPre : closed ? t.themes.weakestClose : t.themes.weakest
                  : null;
            const bench = live ? benches[card.theme.slug] : undefined;
            const total = card.points.length;
            const flat = total - (card.up ?? 0) - (card.down ?? 0);
            const extra = card.members.length - ROW_LOGOS;
            const title = themeTitle(card.theme, locale);
            return (
              <li key={card.theme.slug} className={styles.item} data-draw style={{ "--i": index } as CSSProperties}>
                <Link href={`/tema/${card.theme.slug}`} prefetch={false} className={styles.row}>
                  <span className={cn("numeral", styles.pos)} aria-hidden>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.id}>
                    <b className={styles.name}>{title}</b>
                    <span className={styles.sub} data-flag={flag ? "" : undefined}>
                      {flag && <span className={styles.flag}>{flag}</span>}
                      <span className={styles.dek}>{themeDek(card.theme, locale)}</span>
                    </span>
                  </span>
                  <span className={styles.logos} aria-hidden>
                    {card.members.length === 0
                      ? Array.from({ length: ROW_LOGOS }, (_, i) => <Skeleton key={i} className={styles.logoGhost} />)
                      : card.members.slice(0, extra === 1 ? ROW_LOGOS + 1 : ROW_LOGOS).map((member) => (
                          <LogoTile key={member.symbol} symbol={member.symbol} logoUrl={member.logoUrl} size="xs" card />
                        ))}
                    {extra > 1 && <span className={cn("numeral", styles.more)}>+{extra}</span>}
                  </span>
                  <ThemeStrip
                    className={styles.strip}
                    points={live ? card.points : []}
                    median={live ? card.median : null}
                    bench={bench}
                    scale={live ? scale : null}
                    label={
                      card.up === null || !live
                        ? t.themes.spreadMissing
                        : t.themes.spreadLabel
                            .replace("{count}", String(total))
                            .replace("{up}", String(card.up))
                            .replace("{down}", String(card.down))
                    }
                  />
                  <span
                    className={cn(
                      "numeral",
                      styles.fig,
                      !live || card.median === null ? "text-muted" : directionText(directionOf(card.median)),
                    )}
                  >
                    {!live || card.median === null ? NO_VALUE : <RollingFigure value={formatPercent(card.median, locale)} />}
                  </span>
                  <span className={styles.split}>
                    {card.up === null || !live ? (
                      /* Yedekte ve ölçek dışı temada sayı yok; kulvar yerinde. */
                      <>
                        <b className="numeral text-muted">{NO_VALUE}</b>
                        <span className={styles.ratio} aria-hidden />
                        <b className="numeral text-muted">{NO_VALUE}</b>
                      </>
                    ) : (
                      <>
                        <b className="numeral text-up">
                          {card.up}
                          <span className="sr-only"> {t.themes.up}</span>
                        </b>
                        <span className={styles.ratio} aria-hidden>
                          {card.up > 0 && <i data-tone="up" style={{ flexGrow: card.up }} />}
                          {flat > 0 && <i data-tone="flat" style={{ flexGrow: flat }} />}
                          {card.down! > 0 && <i data-tone="down" style={{ flexGrow: card.down! }} />}
                        </span>
                        <b className="numeral text-down">
                          {card.down}
                          <span className="sr-only"> {t.themes.down}</span>
                        </b>
                      </>
                    )}
                  </span>
                  <ArrowUpRight weight="bold" size={15} className={styles.arrow} aria-hidden />
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
      {/* Künye panelin İÇİNDE, hairline ile (ekran düzeni 6): şeridin üç imi. */}
      <p className={styles.legend}>
        <span><i className={styles.keyTick} aria-hidden />{t.themes.boardKeyMember}</span>
        <span><i className={styles.keyKnob} aria-hidden />{t.themes.benchMedian}</span>
        {anyBench && <span><i className={styles.keyBench} aria-hidden />{t.themes.boardKeyBench}</span>}
        <span className={styles.legendNote}>{t.themes.boardNote}</span>
      </p>
    </Panel>
  );
}
