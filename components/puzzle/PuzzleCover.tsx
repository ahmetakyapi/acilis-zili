import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDots, ShareNetwork, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { Button, ButtonLink, LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import { InkCanvas } from "@/components/ink/InkCanvas";
import { cn } from "@/lib/utils";
import { MAX_GUESSES, TILE_KINDS, isJoker, isPureWin, nextPuzzleAt, puzzleDayKey, shareText, type PuzzleState } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import { PuzzleChart } from "./PuzzleChart";
import { fill } from "./puzzle-format";
import styles from "./PuzzleCover.module.css";

/**
 * Bitmiş bulmacanın kapak kartı (25 Ekim) — siluet panelinin yerine,
 * ekranın ana görseli olarak açılır.
 *
 * Sıra (CLAUDE.md ekran düzeni): kimlik (logo, ad, skor) → ana görsel
 * (siluetin GERÇEK fiyat ve tarih ekseniyle yeniden çizimi; çizgi bir kez
 * daha çizilir) → ölçüler (son kapanış, zirve, dip) → tanıtım cümlesi →
 * paylaşım ızgarası → eylemler → sonraki bulmacanın geri sayımı.
 *
 * KUTLAMA ZİLLE: doğru tahminde kahraman zilinin `heroTap` sahnesi skorun
 * yanında bir kez çalar (gerekçe StockPuzzle.tsx başında). Konfeti yok.
 *
 * Paylaşım ızgarası ekranda renkli karolarla (tutuyor/yakın/uzak), panoya
 * emoji karelerle gider (`shareText`); cevap metne girmez.
 */
export function PuzzleCover({
  state,
  labels,
  locale,
  rang,
  shareUrl,
  archive = false,
  className,
}: {
  state: PuzzleState;
  labels: StockPuzzleLabels;
  locale: Locale;
  /** Bu oturumda, bu tıklamayla kazanıldı mı — zil yalnız o zaman. */
  rang: boolean;
  shareUrl: string;
  /** Arşiv oyunu: geri sayım yerine bugünün bulmacasına bağlantı. */
  archive?: boolean;
  className?: string;
}) {
  const [note, setNote] = useState<"copied" | "failed" | null>(null);
  const answer = state.answer;
  if (!answer) return null;
  const won = state.status === "won";
  const silhouette = state.clues.find((clue) => clue.kind === "silhouette");
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
    <Panel className={cn(styles.cover, className)}>
      <PanelHeader title={won ? labels.wonTitle : labels.lostTitle} meta={fill(labels.number, { n: state.number })} />
      <div className="px-4 pb-5 sm:px-5">
        <div className={styles.identity}>
          <LogoTile symbol={answer.symbol} logoUrl={answer.logoUrl} size="xl" />
          <div className={styles.names}>
            <p className={styles.name}>{answer.name}</p>
            <p className={styles.symbol}>{answer.symbol}</p>
          </div>
          <div className={styles.score} data-won={won ? "" : undefined}>
            {rang && <InkCanvas scene="heroTap" seed={13} className={styles.bell} />}
            <span className={cn(styles.scoreValue, "numeral")}>
              {won ? `${state.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`}
            </span>
            <span className={styles.scoreLabel}>{won ? labels.wonScore : labels.lostScore}</span>
          </div>
        </div>
        {isPureWin(state.guesses) && (
          <p className={styles.pure}>
            <span className={styles.pureBadge}>
              <Sparkle aria-hidden size={14} weight="fill" />
              {labels.pureBadge}
            </span>
            <span>{labels.pureNote}</span>
          </p>
        )}

        {silhouette?.kind === "silhouette" && (
          <div className={styles.chart}>
            <p className={styles.chartCaption}>{labels.chartCaption}</p>
            <PuzzleChart
              points={silhouette.points}
              axis={answer.chart ? { kind: "price", range: answer.chart } : { kind: "shape" }}
              labels={labels}
              locale={locale}
              label={`${answer.name}. ${labels.chartCaption}`}
            />
          </div>
        )}

        {answer.blurb && <p className={styles.blurb}>{answer.blurb}</p>}

        <div className={styles.share}>
          <div className={styles.gridBlock}>
            <p className={styles.gridTitle}>{labels.gridTitle}</p>
            <div role="img" aria-label={text.split("\n")[0]} className={styles.grid}>
              {state.guesses.map((row, index) => (
                <span key={`${row.symbol}-${index}`} className={styles.gridRow}>
                  {isJoker(row.symbol) ? (
                    <span className={styles.jokerSquare}>{labels.jokerRow}</span>
                  ) : (
                    TILE_KINDS.map((kind) => (
                      <span key={kind} className={styles.square} data-grade={row.tiles[kind] ? (row.tiles[kind]?.grade ?? "far") : "none"} />
                    ))
                  )}
                </span>
              ))}
            </div>
            <p className={styles.gridNote}>{labels.gridNote}</p>
          </div>
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
        </div>
        <p role="status" className={styles.shareNote}>
          {note === "copied" ? labels.copied : note === "failed" ? labels.shareFailed : ""}
        </p>
        {note === "failed" && <pre className={styles.sharePreview}>{text}</pre>}

        {archive ? (
          <div className={styles.next}>
            <ButtonLink href="/bulmaca" variant="ghost" prefetch={false}>
              <CalendarDots aria-hidden size={16} weight="bold" />
              {labels.backToToday}
            </ButtonLink>
          </div>
        ) : (
          <NextPuzzle labels={labels} day={state.day} />
        )}
      </div>
    </Panel>
  );
}

const DAY_MS = 86_400_000;

function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, []);
  return now;
}

function countdownText(left: number, labels: StockPuzzleLabels): string {
  const total = Math.floor(Math.max(0, left) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return fill(labels.countdown, {
    h: pad(Math.floor(total / 3600)),
    m: pad(Math.floor((total % 3600) / 60)),
    s: pad(total % 60),
  });
}

/**
 * Sonraki bulmacaya geri sayım. Hedef ŞİMDİDEN değil BULMACANIN GÜNÜNDEN
 * (o günün TR gece yarısı): şimdiden hesaplanınca gece yarısı geçtiğinde
 * hedef ertesi geceye kayıyor, sayaç bitmiş eski bulmacanın üstünde 24
 * saatten yeniden başlıyordu. Sıfıra varınca (ya da sekme gece yarısını
 * uykuda geçip döndüğünde) sayfa bir kez tazelenir; sunucu yeni günü basar
 * ve oyun `key={day}` ile baştan kurulur (`app/(app)/bulmaca/page.tsx`).
 *
 * Kulvar günün ne kadarının geçtiğini gösterir (25 Ekim): sayı kalan
 * süreyi, şerit yolun neresinde olunduğunu söylüyor. Sunucu çiziminde
 * boş (saat istemcide), yeri sabit: CLS yok.
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
      <p className={styles.nextLine}>
        <span>{labels.next}</span>
        <span className={cn(styles.nextTime, "numeral")}>{now === null ? "" : countdownText(target - now, labels)}</span>
      </p>
      <span aria-hidden className={styles.nextLane}>
        <span className={styles.nextFill} style={{ transform: `scaleX(${passed})` }} />
      </span>
    </div>
  );
}
