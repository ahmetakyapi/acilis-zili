import { useEffect, useMemo, useRef, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDots, ShareNetwork, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { Button, ButtonLink, LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import { InkCanvas } from "@/components/ink/InkCanvas";
import { cn } from "@/lib/utils";
import { MAX_GUESSES, TILE_KINDS, isJoker, isPureWin, nextPuzzleAt, puzzleDayKey, shareText, type PuzzleState } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { PuzzleChart } from "./PuzzleChart";
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
 */
export function PuzzleCover({
  state,
  labels,
  locale,
  rang,
  className,
  ref,
}: {
  ref?: Ref<HTMLElement>;
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
        <div className={styles.identity} data-tahta="cevap">
          <LogoTile symbol={answer.symbol} logoUrl={answer.logoUrl} size="lg" />
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
              TILE_KINDS.map((kind) => (
                <span key={kind} className={styles.square} data-grade={row.tiles[kind] ? (row.tiles[kind]?.grade ?? "far") : "none"} />
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
 * Kulvar günün ne kadarının geçtiğini gösterir: sayı kalan süreyi, şerit
 * yolun neresinde olunduğunu söylüyor. Sunucu çiziminde boş (saat
 * istemcide), yeri sabit: CLS yok. Tek satır: ad, kulvar, süre.
 */
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
      <span className={styles.nextLabel}>{labels.next}</span>
      <span aria-hidden className={styles.nextLane}>
        <span className={styles.nextFill} style={{ transform: `scaleX(${passed})` }} />
      </span>
      <span className={cn(styles.nextTime, "numeral")}>{now === null ? "" : countdownText(target - now, labels)}</span>
    </div>
  );
}
