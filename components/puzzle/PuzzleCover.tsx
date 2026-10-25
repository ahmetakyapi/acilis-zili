import { useEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDots, Fire, HourglassMedium, ShareNetwork, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { Button, ButtonLink, LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import { InkCanvas } from "@/components/ink/InkCanvas";
import { cn } from "@/lib/utils";
import { MAX_GUESSES, TILE_KINDS, isJoker, isPureWin, nextPuzzleAt, puzzleDayKey, shareText, type PuzzleState } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { PuzzleChart } from "./PuzzleChart";
import { fill } from "./puzzle-format";
import { DAY_MS, countdownText, useNow } from "./puzzle-clock";
import styles from "./PuzzleCover.module.css";

/**
 * Bitmiş bulmaca (25 Ekim; tek ekran için aynı gün ikiye bölündü).
 *
 * `PuzzleCover` siluet panelinin YERİNDE, aynı kutuda açılır: kimlik
 * satırı (logo, ad, sembol, skor; kazanınca skorun yanında zil), siluetin
 * GERÇEK fiyat ve tarih ekseniyle yeniden çizimi (zirve ve dip eksende,
 * son kapanış uç noktanın yanında; ayrı ölçü satırı yok) ve iki satırlık
 * tanıtım cümlesi.
 *
 * `PuzzleResult` tahmin kutusunun YERİNDE, tahminler panelinin başında:
 * solda 10 piksellik paylaşım ızgarası, sağında hisse sayfası ve paylaş
 * düğmeleri ile sonraki bulmacanın geri sayımı (ızgara altı satırda 75
 * piksel, sağ kolon iki satır; alt alta dizildiğinde blok 1280 kaybetmede
 * tahtayı 92 piksel taşırıyordu). Eskiden hepsi tek kartın altına diziliydi ve kart tek
 * başına 1500 genişlikte ekranın tamamını alıyordu; oyun bitince giriş
 * kutusu boşalan yer zaten tahminler panelindeydi.
 *
 * KUTLAMA ZİLLE: doğru tahminde kahraman zilinin `heroTap` sahnesi skorun
 * yanında bir kez çalar (gerekçe StockPuzzle.tsx başında). Konfeti yok.
 * Paylaşım ızgarası ekranda renkli karolarla, panoya emoji karelerle gider
 * (`shareText`); cevap metne girmez.
 *
 * OYUN MASASI (25 Ekim, üçüncü kurulum — "daha duygusal ama sade"):
 *   - Skor büyük (32 piksel): oyunun tek sayısı o.
 *   - Kazanınca siluet bir kez yeşile döner (PuzzleChart `won`) ve logo,
 *     çizgi bittiği anda yerine oturur (küçük öğe, `--ease-spring-soft`).
 *     Bir kez, kısa; kaybedilen oyunda logo kimlikle birlikte sakin girer.
 *   - Seri ikiyi bulduysa sembolün yanında küçük alev ("3 Günlük Seri"),
 *     pirinç: kazanmanın yeşilinden ayrı, "sıcak" bir işaret. Arşivde yok
 *     (arşiv oyunu seriye sayılmaz). Konfeti yok.
 *   - Sonuç bloğunda paylaşım ızgarası 13 piksellik karelerle (10'du) ve
 *     geri sayım halka: günün ne kadarının geçtiği çember olarak, kalan
 *     süre yanında yazıyla.
 */
export function PuzzleCover({
  state,
  labels,
  locale,
  rang,
  streak = 0,
  className,
  ref,
}: {
  ref?: Ref<HTMLElement>;
  /** Günlük seri (arşivde 0) — ikiyi bulunca alev. */
  streak?: number;
  state: PuzzleState;
  labels: StockPuzzleLabels;
  locale: Locale;
  /** Bu oturumda, bu tıklamayla kazanıldı mı — zil yalnız o zaman. */
  rang: boolean;
  className?: string;
}) {
  const answer = state.answer;
  if (!answer) return null;
  const won = state.status === "won";
  const silhouette = state.clues.find((clue) => clue.kind === "silhouette");

  return (
    <Panel ref={ref} className={cn(styles.cover, className)} data-cevap={answer.symbol}>
      <PanelHeader className="py-2.5" title={won ? labels.wonTitle : labels.lostTitle} meta={labels.chartCaption} />
      <div className={styles.body}>
        <div className={cn(styles.identity, won && styles.wonIdentity)} data-tahta="cevap">
          <span className={styles.logo}>
            <LogoTile symbol={answer.symbol} logoUrl={answer.logoUrl} size="lg" />
          </span>
          <div className={styles.names}>
            <p className={styles.name}>{answer.name}</p>
            <p className={styles.symbolLine}>
              <span className={styles.symbol}>{answer.symbol}</span>
              {isPureWin(state.guesses) && (
                <span className={styles.pureBadge} title={labels.pureNote}>
                  <Sparkle aria-hidden size={12} weight="fill" />
                  {labels.pureBadge}
                </span>
              )}
              {won && streak >= 2 && (
                <span className={styles.streakBadge}>
                  <Fire aria-hidden size={12} weight="fill" />
                  {fill(labels.streakChip, { n: streak })}
                </span>
              )}
            </p>
          </div>
          <div className={styles.score} data-won={won ? "" : undefined}>
            {rang && <InkCanvas scene="heroTap" seed={13} className={styles.bell} />}
            <span className={cn(styles.scoreValue, "numeral")}>
              {won ? `${state.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}
            </span>
            <span className={styles.scoreLabel}>{won ? labels.wonScore : labels.lostScore}</span>
          </div>
        </div>

        {silhouette?.kind === "silhouette" && (
          <PuzzleChart
            points={silhouette.points}
            axis={answer.chart ? { kind: "price", range: answer.chart } : { kind: "shape" }}
            labels={labels}
            locale={locale}
            label={`${answer.name}. ${labels.chartCaption}`}
            className={styles.chart}
            won={won}
          />
        )}

        {answer.blurb && (
          <p className={styles.blurb} title={answer.blurb} data-tahta="cevap">
            {answer.blurb}
          </p>
        )}
      </div>
    </Panel>
  );
}

export function PuzzleResult({
  state,
  labels,
  shareUrl,
  archive = false,
}: {
  state: PuzzleState;
  labels: StockPuzzleLabels;
  shareUrl: string;
  /** Arşiv oyunu: geri sayım yerine bugünün bulmacasına bağlantı. */
  archive?: boolean;
}) {
  const [note, setNote] = useState<"copied" | "failed" | null>(null);
  const answer = state.answer;
  if (!answer) return null;
  const text = shareText({ title: labels.shareTitle, number: state.number, feedback: state.guesses, url: shareUrl });

  const share = async () => {
    setNote(null);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setNote("copied");
    } catch {
      setNote("failed");
    }
  };

  return (
    <div className={styles.result} data-tahta="sonuc">
      <div role="img" aria-label={text.split("\n")[0]} className={styles.grid} title={labels.gridNote}>
        {state.guesses.map((row, index) => (
          <span key={`${row.symbol}-${index}`} className={styles.gridRow}>
            {isJoker(row.symbol) ? (
              <span className={styles.jokerSquare} />
            ) : (
              TILE_KINDS.map((kind, col) => (
                <span
                  key={kind}
                  className={styles.square}
                  style={{ "--d": index * 4 + col } as CSSProperties}
                  data-grade={row.tiles[kind] ? (row.tiles[kind]?.grade ?? "far") : "none"}
                />
              ))
            )}
          </span>
        ))}
      </div>
      <div className={styles.resultSide}>
        <div className={styles.actions}>
          <ButtonLink href={`/hisse/${answer.symbol}`} variant="primary" prefetch={false}>
            {labels.openStock}
            <ArrowRight aria-hidden size={15} weight="bold" />
          </ButtonLink>
          <Button type="button" variant="ghost" onClick={share}>
            <ShareNetwork aria-hidden size={16} weight="bold" />
            {labels.share}
          </Button>
        </div>
        {/* Not yalnız düğmeye basınca: boşta duran "kareler panoya gider"
            satırı 1280 kaybetmede tahtayı görünür alanın altına itiyordu;
            aynı açıklama ızgaranın `title`ında. Canlı bölge hep yerinde
            (boşken görünmez), duyuru kaçmasın. */}
        <p role="status" className={note ? styles.shareNote : "sr-only"}>
          {note === "copied" ? labels.copied : note === "failed" ? labels.shareFailed : ""}
        </p>
        {archive ? (
          <div className={styles.next}>
            <ButtonLink href="/bulmaca" variant="ghost" size="sm" prefetch={false}>
              <CalendarDots aria-hidden size={14} weight="bold" />
              {labels.backToToday}
            </ButtonLink>
          </div>
        ) : (
          <NextPuzzle labels={labels} day={state.day} />
        )}
      </div>
      {note === "failed" && <pre className={styles.sharePreview}>{text}</pre>}
    </div>
  );
}

/**
 * Sonraki bulmacaya geri sayım. Hedef ŞİMDİDEN değil BULMACANIN GÜNÜNDEN
 * (o günün TR gece yarısı): şimdiden hesaplanınca gece yarısı geçtiğinde
 * hedef ertesi geceye kayıyor, sayaç bitmiş eski bulmacanın üstünde 24
 * saatten yeniden başlıyordu. Sıfıra varınca (ya da sekme gece yarısını
 * uykuda geçip döndüğünde) sayfa bir kez tazelenir; sunucu yeni günü basar
 * ve oyun `key={day}` ile baştan kurulur (`app/(app)/bulmaca/page.tsx`).
 *
 * Halka günün ne kadarının geçtiğini gösterir (25 Ekim, üçüncü kurulum;
 * önceden düz kulvardı): sayı kalan süreyi, çember yolun neresinde
 * olunduğunu söylüyor; dolunca yeni bulmaca. Sunucu çiziminde boş (saat
 * istemcide), yeri sabit: CLS yok.
 */
const RING_R = 17;
function NextPuzzle({ labels, day }: { labels: StockPuzzleLabels; day: string }) {
  const router = useRouter();
  const now = useNow();
  const target = useMemo(() => nextPuzzleAt(Date.parse(`${day}T12:00:00Z`)).getTime(), [day]);
  const over = now !== null && (now >= target || puzzleDayKey(new Date(now)) !== day);
  const refreshed = useRef(false);
  useEffect(() => {
    if (!over || refreshed.current) return;
    refreshed.current = true;
    router.refresh();
  }, [over, router]);
  const passed = now === null ? 0 : Math.min(1, Math.max(0, 1 - (target - now) / DAY_MS));
  return (
    <div className={styles.next}>
      <span aria-hidden className={styles.ring}>
        <svg viewBox="0 0 40 40" className={styles.ringSvg}>
          <circle cx="20" cy="20" r={RING_R} className={styles.ringTrack} />
          <circle
            cx="20"
            cy="20"
            r={RING_R}
            pathLength={100}
            className={styles.ringFill}
            style={{ strokeDashoffset: 100 - passed * 100 }}
          />
        </svg>
        <HourglassMedium size={14} weight="bold" className={styles.ringIcon} />
      </span>
      <span className={styles.nextText}>
        <span className={styles.nextLabel}>{labels.next}</span>
        <span className={cn(styles.nextTime, "numeral")}>
          <span className="sr-only">{labels.nextLeft}: </span>
          {now === null ? "" : countdownText(target - now, labels)}
        </span>
      </span>
    </div>
  );
}
