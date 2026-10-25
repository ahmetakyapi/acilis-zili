"use client";

import { useId, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Sparkle } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Button, ButtonLink, Skeleton } from "@/components/ui/primitives";
import base from "@/components/stock/StockInsightCard.module.css";
import type { AskStockLabels } from "@/lib/i18n/dictionaries/page-claude";
import type { Locale } from "@/lib/i18n/config";
import type { AskAnswer } from "@/lib/stock-question";
import { cn } from "@/lib/utils";
import styles from "./AskStock.module.css";

/**
 * Bu Hisseye Sor (24 Ekim) — gerekçe ve doğruluk kuralları
 * lib/stock-question.ts. Panel sunucuda yalnız kabuğunu basar (oturum ve
 * kalan hak); soru ancak okur gönderince istenir, sayfa açılışında hiçbir
 * Claude çağrısı yok. Oturumsuz okur (ve bot) yalnız giriş çağrısını görür.
 *
 * Örnek çipler soruyu kutuya yazıp hemen gönderir; cümle düzeninde (soru
 * cümlesi, künye değil). Son yanıt kutunun altında: soru, yanıt, varsa
 * "Tavsiye Değil" rozeti, yararlanılan veri künyesi ve kaynak haberler.
 * Yanıt yoksa ya da sayı denetiminden düştüyse okura sabit ve dürüst cümle.
 *
 * OTURUMSUZ HÂL (24 Ekim düzeltmesi). Eskiden 158 piksellik kutuda tek cümle
 * ve düğme vardı: okur kutunun neye yaradığını göremiyordu. Şimdi örnek
 * sorular giriş bağlantısı olarak durur (basınca giriş, dönüşte soru kutuya
 * YAZILI gelir ama gönderilmez: hak okurun kendi eylemiyle düşer) ve altında
 * yanıtın YAPISINI anlatan önizleme: uydurma bir yanıt ya da sayı yok, kural
 * ve künye var. Giriş düğmesi sitenin birincil eylemi (dolu mavi, bilanço
 * oylamasının giriş düğmesiyle aynı kalıp).
 *
 * KOMPAKT (25 Ekim, sahibinin isteği: "böyle kocaman olmasına gerek var
 * mı"). Panel 1280'de 284 (oturumsuz 345), 390'da 453 (624) piksel
 * tutuyordu: iki satırlık metin kutusu, altında tam genişlikte çip satırı,
 * oturumsuzda da yanıtın yapısını anlatan ayrı bir kutu. Artık kendi
 * paneli yok, "Bu Hafta Neden Hareket Etti" ile tek panelin sol kolonu
 * (app/(app)/hisse/[symbol]/_panels/AskMovePanel.tsx): tek satır girdi ve
 * Sor yan yana, örnekler küçük çipler. Yanıtın yapısını anlatan kutu
 * kalktı; aynı kural (her sayı veride geçmeli) dipteki künyede zaten
 * yazılı, oturumsuzda da o künye basılıyor. Uzun soru tek satırda yana
 * kayar; sınır yine 300 karakter.
 */

/* Yanıtın gerçekten dayanabildiği bloklardan (lib/stock-question-core.ts →
   ASK_SOURCES) en tanıdık beşi, sayfa sırasıyla — henüz yanıt yokken
   kolonun dibinde künye olarak (25 Ekim; önce oturumsuz önizleme kutusundaydı). */
const PREVIEW_SOURCES = ["session", "valuation", "analysts", "earnings", "news"] as const;
/** Dönüş adresindeki örnek soru parametresi. */
const PREFILL_PARAM = "soru";
const ANCHOR = "bu-hisseye-sor";

const MAX_CHARS = 300;

type Exchange = { question: string; answer: AskAnswer };
type ErrorKey = keyof AskStockLabels["errors"];

export function AskStock({
  symbol,
  locale,
  labels,
  signedIn,
  remaining: initialRemaining,
  limit,
}: {
  symbol: string;
  locale: Locale;
  labels: AskStockLabels;
  signedIn: boolean;
  remaining: number;
  limit: number;
}) {
  const inputId = useId();
  const titleId = useId();
  const searchParams = useSearchParams();
  /* Girişten dönüş: adresteki örnek soru kutuya yazılır, GÖNDERİLMEZ. Yalnız
     sözlükteki örnekler kabul edilir — dışarıdan hazırlanmış bir bağlantı
     kutuya keyfî metin koyamasın. İlk durum adresten (sunucu da aynısını
     çizer, hidrasyon uyuşur). */
  const [text, setText] = useState(() => {
    const wanted = searchParams.get(PREFILL_PARAM);
    return signedIn && wanted && labels.examples.includes(wanted) ? wanted : "";
  });
  const [pending, setPending] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [last, setLast] = useState<Exchange | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);

  const ask = async (raw: string) => {
    const question = raw.replace(/\s+/g, " ").trim();
    if (pending) return;
    if (question.length < 3 || question.length > MAX_CHARS) {
      setError("question");
      return;
    }
    setPending(question);
    setError(null);
    try {
      const response = await fetch("/api/ai/hisse-sor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, question, locale }),
      });
      const data = (await response.json()) as { ok: boolean; answer?: AskAnswer; reason?: string; remaining?: number };
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (data.ok && data.answer) {
        setLast({ question, answer: data.answer });
        setText("");
      } else {
        const reason = data.reason as ErrorKey | undefined;
        setError(reason && reason in labels.errors ? reason : "error");
      }
    } catch {
      setError("error");
    } finally {
      setPending(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(text);
  };

  const quota = labels.remaining.replace("{n}", String(remaining)).replace("{limit}", String(limit));
  const date = last?.answer.session
    ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${last.answer.session}T12:00:00Z`))
    : null;

  return (
    <section id={ANCHOR} className={styles.ask} aria-labelledby={titleId} aria-busy={pending !== null}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          <Sparkle className={base.icon} size={17} weight="duotone" aria-hidden />
          {labels.title}
        </h2>
        {signedIn && <span className={cn("numeral", styles.quota)}>{quota}</span>}
      </div>
      <p className={styles.intro}>{signedIn ? labels.intro : labels.signedOut}</p>
      {!signedIn ? (
        <>
          <ul className={styles.chips} aria-label={labels.examplesLabel}>
            {labels.examples.map((example) => (
              <li key={example}>
                <Link href={signInHref(symbol, example)} className={styles.chip} rel="nofollow">
                  {example}
                </Link>
              </li>
            ))}
          </ul>
          <div className={styles.signIn}>
            <ButtonLink href={signInHref(symbol)} variant="primary" rel="nofollow">
              {labels.signIn}
            </ButtonLink>
            <span className={styles.memberQuota}>{labels.memberQuota.replace("{limit}", String(limit))}</span>
          </div>
        </>
      ) : (
        <>
          <form className={styles.form} onSubmit={submit}>
            <label htmlFor={inputId} className="sr-only">
              {labels.label}
            </label>
            {/* TEK SATIR (25 Ekim): Enter formu gönderir, ayrı tuş işleyicisi
                gerekmiyor; telefon klavyesinde tuş "Gönder" yazar. */}
            <input
              id={inputId}
              type="text"
              enterKeyHint="send"
              autoComplete="off"
              className={styles.input}
              value={text}
              maxLength={MAX_CHARS}
              placeholder={labels.placeholder}
              disabled={remaining <= 0}
              onChange={(event) => setText(event.target.value)}
            />
            <Button type="submit" className={styles.submit} disabled={pending !== null || remaining <= 0 || text.trim().length < 3}>
              {labels.submit}
            </Button>
          </form>
          <ul className={styles.chips} aria-label={labels.examplesLabel}>
            {labels.examples.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  className={styles.chip}
                  disabled={pending !== null || remaining <= 0}
                  onClick={() => {
                    setText(example);
                    void ask(example);
                  }}
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
          {error && (
            <p className={styles.error} role="alert">
              {labels.errors[remaining <= 0 && error !== "auth" ? "quota" : error]}
            </p>
          )}
          <div aria-live="polite">
            {pending ? (
              <div className={styles.exchange}>
                <p className={styles.askedLabel}>{labels.question}</p>
                <p className={styles.asked}>{pending}</p>
                <p className={base.loadingText}>
                  <Sparkle className={base.loadingIcon} size={15} weight="fill" aria-hidden />
                  {labels.asking}
                </p>
                <Skeleton className={cn(base.line, "w-[94%]")} />
                <Skeleton className={cn(base.line, "w-[86%]")} />
                <Skeleton className={cn(base.line, "w-[62%]")} />
              </div>
            ) : last ? (
              <div className={styles.exchange}>
                <p className={styles.askedLabel}>{labels.question}</p>
                <p className={styles.asked}>{last.question}</p>
                <div className={styles.answerHead}>
                  <p className={styles.askedLabel}>{labels.answer}</p>
                  {last.answer.kind === "advice" && <span className={styles.badge}>{labels.advice}</span>}
                </div>
                <p className={cn(base.summary, last.answer.kind === "unanswerable" && styles.unanswerable)}>
                  {last.answer.kind === "unanswerable" ? labels.unanswerable : last.answer.text}
                </p>
                {last.answer.sources.length > 0 && (
                  <p className={styles.sources}>
                    <span className={styles.sourcesLabel}>{labels.sourcesLabel}</span>
                    {last.answer.sources.map((source) => (
                      <span key={source} className={styles.source}>
                        {labels.sources[source]}
                      </span>
                    ))}
                  </p>
                )}
                {last.answer.news.length > 0 && (
                  <div className={styles.news}>
                    <p className={styles.sourcesLabel}>{labels.newsLabel}</p>
                    <ul>
                      {last.answer.news.map((item) => (
                        <li key={item.url}>
                          <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" className={base.source}>
                            {item.headline}
                            {item.source ? ` · ${item.source}` : ""}
                            <ArrowUpRight size={12} weight="bold" aria-hidden />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {date && <p className={styles.stamp}>{labels.session.replace("{date}", date)}</p>}
              </div>
            ) : null}
          </div>
        </>
      )}
      {!pending && !last && (
        <p className={cn(styles.sources, styles.hint)}>
          <span className={styles.sourcesLabel}>{labels.previewSources}</span>
          {PREVIEW_SOURCES.map((source) => (
            <span key={source} className={styles.source}>
              {labels.sources[source]}
            </span>
          ))}
        </p>
      )}
      <p className={styles.disclosure}>{labels.disclosure}</p>
    </section>
  );
}

/** Giriş bağlantısı: dönüş bu panele, örnek soru varsa adreste. */
function signInHref(symbol: string, example?: string) {
  const back = `/hisse/${symbol}${example ? `?${PREFILL_PARAM}=${encodeURIComponent(example)}` : ""}#${ANCHOR}`;
  return `/giris?devam=${encodeURIComponent(back)}`;
}
