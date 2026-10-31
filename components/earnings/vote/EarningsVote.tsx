"use client";

import { useState, useTransition } from "react";
import { ArrowDownRight, ArrowUpRight, CaretDown, CaretUp, Check, CheckCircle, XCircle } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { castEarningsVote, type VoteActionResult } from "@/app/actions/earnings-vote";
import type { EarningsVoteLabels } from "@/lib/i18n/dictionaries/earnings-season";
import {
  tallyShares,
  tallyTotal,
  voteHit,
  type VoteChoice,
  type VoteTally,
  type VoteView,
} from "@/lib/earnings-vote";
import type { Locale } from "@/lib/i18n/config";
import { cn, formatPercentPlain } from "@/lib/utils";
import styles from "./EarningsVote.module.css";

/**
 * "Beklentiyi Geçer mi?" — tek tık oy (mantık `lib/earnings-vote.ts`).
 *
 * İKİ BOY. `panel` şirketin bilanço sayfasında: iki düğme, dağılım, sonuç
 * ve künye. Soru panelin h2'sinde ("Beklentiyi Geçer mi?"); bileşen onu
 * İKİNCİ KEZ yazmıyor (24 Ekim denetimi: "NVDA EPS beklentisini geçer mi?"
 * h2'nin hemen altında aynı soruyu tekrar soruyordu). Uzun soru yalnız
 * düğme grubunun `aria-label`ında — ekran okuyucu sembolü duysun. `card` takvim kartının dibinde: yalnız iki düğme ve oy
 * sonrası tek satırlık dağılım — kartın taşıdığı asıl bilgi (sembol,
 * tarih, beklenti) önde kalmalı.
 *
 * DAĞILIM SUNUCUDAN SÜZÜLÜ GELİYOR (`buildVoteView`): oy vermemiş okur
 * açık bir oylamada `tally` almıyor. Oy verildiğinde eylem güncel dağılımı
 * döndürüyor ve bileşen onu çiziyor; sayfa tazelenmiyor.
 *
 * Bekleme anında düğmeler `aria-disabled` (FavoriteToggle'ın gerekçesi:
 * `disabled` odağı `<body>`ye düşürüyor). İyimser seçim yok: oy reddedilirse
 * (kilit, oran) ekranda olmayan bir oy görünmesin; düğme basılı hâle ancak
 * sunucu yazınca geçiyor. Bekleme kısa, tek bir Neon turu.
 */
export function EarningsVote({
  view,
  signedIn,
  labels,
  lock,
  variant,
  signInHref,
  outcomeLine,
  locale,
}: {
  view: VoteView;
  locale: Locale;
  signedIn: boolean;
  labels: EarningsVoteLabels;
  /** "20 Kas 00:00 TR" — sunucuda biçimlenmiş (gerekçe `lockLabel`). */
  lock: string;
  variant: "panel" | "card";
  signInHref: string;
  /** Sonuçlanmış oylamada "EPS 1,08 $ · Beklenti 1,00 $". */
  outcomeLine?: string | null;
}) {
  const [mine, setMine] = useState<VoteChoice | null>(view.mine);
  const [tally, setTally] = useState<VoteTally | null>(view.tally);
  const [error, setError] = useState<Extract<VoteActionResult, { ok: false }>["error"] | null>(null);
  const [locked, setLocked] = useState(false);
  const [pending, startTransition] = useTransition();

  /* PROP TAZELENİNCE DURUM DA TAZELENİR. `useState(view.mine)` yalnız ilk
     çizimde okunuyordu: `router.refresh()` (giriş sonrası, başka sekmede
     verilen oy, kilidin geçmesi) yeni `view` getirdiğinde bileşen eski oyu
     ve eski dağılımı göstermeye devam ediyordu. React'in "önceki prop'u
     sakla" kalıbı (efekt yok, ek çizim yok): imza değişince yerel durum
     sunucunun söylediğine döner. İmza değer, kimlik değil — aynı veri
     yeniden gelince okurun az önce verdiği oy silinmesin. */
  const signature = `${view.symbol}:${view.period}:${view.phase}:${view.mine}:${view.tally?.beat}:${view.tally?.miss}`;
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setMine(view.mine);
    setTally(view.tally);
    setLocked(false);
    setError(null);
  }

  const phase = locked && view.phase === "open" ? "locked" : view.phase;
  const canVote = phase === "open" && signedIn;

  const vote = (choice: VoteChoice) => {
    if (pending || !canVote) return;
    setError(null);
    startTransition(async () => {
      const result = await castEarningsVote({ symbol: view.symbol, period: view.period, choice });
      if (result.ok) {
        setMine(result.choice);
        setTally(result.tally);
      } else {
        setError(result.error);
        if (result.error === "locked") setLocked(true);
      }
    });
  };

  const card = variant === "card";
  const hit = mine ? voteHit(mine, view.outcome) : null;

  return (
    <div
      className={cn(styles.vote, card ? styles.card : styles.panel)}
      data-phase={phase}
      /* Kart yüzeyini kaplayan bağlantının üstünde (AddToCalendar'ın
         `relative z-10` gerekçesi): katman olmadan dokunuş bağlantıya düşer. */
    >
      {/* OY KARTLARI (panel, 31 Ekim). İki gri düğme "çok eksik" duruyordu
          (sahibinin itirazı): her seçenek artık ikonlu bir kart — yön
          dairesi (↗ geçer `--up`, ↘ kaçırır `--down`; renk tek taşıyıcı
          değil, ok şekli de söylüyor), etiket, ne demek olduğunu söyleyen
          alt satır ve sağda seçim halkası. Seçili kart etkileşimin
          renginde (`--primary`), halka onay işaretiyle dolar. Hedef 64 px.
          Kart boyu (`card`) eski kompakt düğmede kalıyor. */}
      {phase === "open" && signedIn && (
        <div className={styles.choices} role="group" aria-label={labels.question.replace("{symbol}", view.symbol)}>
          {(["beat", "miss"] as const).map((choice) =>
            card ? (
              <button
                key={choice}
                type="button"
                className={styles.choice}
                data-choice={choice}
                aria-pressed={mine === choice}
                aria-disabled={pending}
                onClick={() => vote(choice)}
              >
                {choice === "beat" ? (
                  <CaretUp aria-hidden size={14} weight="bold" className={styles.up} />
                ) : (
                  <CaretDown aria-hidden size={14} weight="bold" className={styles.down} />
                )}
                {choice === "beat" ? labels.beat : labels.miss}
              </button>
            ) : (
              <button
                key={choice}
                type="button"
                className={styles.option}
                data-choice={choice}
                aria-pressed={mine === choice}
                aria-disabled={pending}
                onClick={() => vote(choice)}
              >
                <OptionBody choice={choice} labels={labels} />
              </button>
            ),
          )}
        </div>
      )}

      {/* GİRİŞ YAPMAMIŞ OKUR AYNI KARTLARI GÖRÜR (31 Ekim): kartlar giriş
          sayfasına bağlantı. Önce yalnız sitenin birincil düğmesi vardı
          ("Giriş Yap ve Oy Ver", 24 Ekim denetimi: ikinci bir düğme dili
          açılmasın); okur neye oy vereceğini görmeden giriş istiyordu.
          Kartlar oy kartlarının kendisi — yeni bir düğme dili değil. */}
      {phase === "open" && !signedIn && !card && (
        <div className={styles.choices}>
          {(["beat", "miss"] as const).map((choice) => (
            <Link key={choice} href={signInHref} className={styles.option} data-choice={choice}>
              <OptionBody choice={choice} labels={labels} />
            </Link>
          ))}
        </div>
      )}
      {phase === "open" && !signedIn && !card && <p className={styles.meta}>{labels.signInHint}</p>}

      {phase !== "open" && (
        <p className={styles.status}>
          {phase === "resolved" && view.outcome ? (
            <>
              <span className={styles.statusLabel}>{labels.outcomeLabel}</span>
              <span
                className={cn(
                  styles.outcome,
                  view.outcome === "beat" ? styles.up : view.outcome === "miss" ? styles.down : null,
                )}
              >
                {view.outcome === "beat"
                  ? labels.outcomeBeat
                  : view.outcome === "miss"
                    ? labels.outcomeMiss
                    : labels.outcomeInline}
              </span>
            </>
          ) : (
            <>
              <span className={styles.statusLabel}>{labels.closed}</span>
              <span>{labels.pending}</span>
            </>
          )}
        </p>
      )}

      {!card && phase === "resolved" && outcomeLine && <p className={styles.meta}>{outcomeLine}</p>}

      {mine && (phase !== "open" || !card) && (
        <p className={styles.mine}>
          <span className={styles.statusLabel}>{labels.yourVote}</span>
          <span>{mine === "beat" ? labels.beat : labels.miss}</span>
          {phase === "resolved" && (
            <span className={cn(styles.hit, hit === true ? styles.up : hit === false ? styles.down : null)}>
              {hit === true ? (
                <CheckCircle aria-hidden size={14} weight="fill" />
              ) : hit === false ? (
                <XCircle aria-hidden size={14} weight="fill" />
              ) : null}
              {hit === true ? labels.hit : hit === false ? labels.missed : labels.unscored}
            </span>
          )}
        </p>
      )}

      {tally && <Distribution tally={tally} labels={labels} compact={card} locale={locale} />}

      {!card && phase === "open" && (
        <p className={styles.meta}>
          {labels.closesAt.replace("{time}", lock)}
          {signedIn && <> · {mine ? labels.changeHint : labels.hiddenHint}</>}
        </p>
      )}

      {error && (
        <p role="status" className={styles.error}>
          {labels.errors[error]}
        </p>
      )}
    </div>
  );
}

/** Oy kartının içi: yön dairesi, etiket + alt satır, seçim halkası. */
function OptionBody({ choice, labels }: { choice: VoteChoice; labels: EarningsVoteLabels }) {
  const Icon = choice === "beat" ? ArrowUpRight : ArrowDownRight;
  return (
    <>
      <span aria-hidden className={styles.optionIcon}>
        <Icon size={18} weight="bold" />
      </span>
      <span className={styles.optionText}>
        <span className={styles.optionLabel}>{choice === "beat" ? labels.beat : labels.miss}</span>
        <span className={styles.optionHint}>{choice === "beat" ? labels.beatHint : labels.missHint}</span>
      </span>
      <span aria-hidden className={styles.optionCheck}>
        <Check size={12} weight="bold" />
      </span>
    </>
  );
}

/**
 * Dağılım — TEK İKİ YÖNLÜ ÇİZGİ (CompareScale'in işaretli rayı,
 * `components/markets/CompareScale.tsx` → `ScaleBar signed`). Sıfır
 * ortada: "geçer" payı sağa, "kaçırır" payı sola açılıyor; hangi tarafın
 * ağır bastığı uzunluktan okunuyor. Önceki iki parçalı şerit iki oranı
 * uç uca ekliyordu ve %50'nin nerede olduğu görünmüyordu — 55/45 ile
 * 45/55 aynı çizgi gibi duruyordu. Renk YÖNDEN (yukarı/aşağı), büyüklük
 * uzunlukta. Sayılar şeridin uçlarında yazılı; şerit onların kopyası,
 * `aria-hidden`.
 */
function Distribution({
  tally,
  labels,
  compact,
  locale,
}: {
  tally: VoteTally;
  labels: EarningsVoteLabels;
  compact: boolean;
  locale: Locale;
}) {
  const total = tallyTotal(tally);
  const shares = tallyShares(tally);
  if (!shares) {
    return compact ? null : <p className={styles.meta}>{labels.noVotes}</p>;
  }
  return (
    <div className={styles.distribution}>
      <p className={styles.legend}>
        <span>
          <span className={styles.down}>{labels.miss}</span>{" "}
          <span className="figure">{formatPercentPlain(shares.miss, locale, 0)}</span>
        </span>
        <span className={styles.count}>{labels.votes.replace("{n}", String(total))}</span>
        <span>
          <span className="figure">{formatPercentPlain(shares.beat, locale, 0)}</span>{" "}
          <span className={styles.up}>{labels.beat}</span>
        </span>
      </p>
      <span aria-hidden className={styles.lane} data-motion-track>
        <span
          className={styles.missBar}
          data-motion-draw="line"
          style={{ width: `${shares.miss / 2}%`, transformOrigin: "right center" }}
        />
        <span
          className={styles.beatBar}
          data-motion-draw="line"
          style={{ width: `${shares.beat / 2}%`, transformOrigin: "left center" }}
        />
        <span className={styles.zero} />
      </span>
    </div>
  );
}
