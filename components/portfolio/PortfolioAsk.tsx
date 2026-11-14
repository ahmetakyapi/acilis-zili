"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { Button, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import type { PortfolioAskLabels } from "@/lib/i18n/dictionaries/portfolio-ask";
import type { Locale } from "@/lib/i18n/config";
import type { PortfolioAskAnswer } from "@/lib/portfolio-question";
import { cn } from "@/lib/utils";
import styles from "./PortfolioAsk.module.css";

/**
 * PORTFÖYÜNE SOR (11 Kasım) — arayüz. Gerekçe ve doğruluk kuralları
 * lib/portfolio-question.ts; kalıp "Bu Hisseye Sor" (components/stock/
 * AskStock.tsx). Panel yalnız kabuğunu basar: soru ancak okur gönderince
 * istenir, açılışta Claude çağrısı yok. Yalnız oturumlu okurun /portfoy
 * ekranında basılır (sunucu `remaining`i ve `owner`ı verir).
 *
 * Sıra (ekran düzeni): başlık + kalan hak → tek cümle tanıtım → etiketi
 * ÜSTTE metin alanı ve Sor → hazır soru çipleri → yanıt kartı (soru,
 * yanıt paragrafları, dayandığı ölçü kartları, seans künyesi) → panelin
 * dibinde hairline'lı künye. Ölçü kartları sunucunun biçimlediği değerler:
 * modelin yazdığı sayı değil (lib/portfolio-question-core.ts →
 * `measureCatalog`), yön rengi yalnız işaretli yüzdelerde.
 *
 * Metin alanı iki satır: portföy sorusu hisse sorusundan uzun ("SNDK'yi
 * satsam yoğunlaşmam ne olur, sektör payım ne kadar düşer"). Enter gönderir,
 * Shift+Enter satır açar.
 *
 * Ölçüm (11 Kasım; geçici önizleme, uca sahte yanıt `page.route`, iki tema,
 * hareket azaltılmış): panel boşken 390'da 520, 946'da 439 piksel;
 * beklerken 695 / 600; altı kartlı senaryo yanıtında 1.108 / 849. Yatay
 * taşma, kutusundan taşan öğe ve kırpılan metin 0; aynı satırdaki ölçü
 * kartlarının dibi aynı hatta (sapan satır 0); etiket metin alanının
 * üstünde; çip telefonda 44, geniş ekranda 32 piksel; panelde animasyon 0.
 */

const MAX_CHARS = 300;

type Exchange = { question: string; answer: PortfolioAskAnswer };
type ErrorKey = keyof PortfolioAskLabels["errors"];

export function PortfolioAsk({
  locale,
  labels,
  remaining: initialRemaining,
  limit,
  owner = false,
  starters,
}: {
  locale: Locale;
  labels: PortfolioAskLabels;
  remaining: number;
  limit: number;
  owner?: boolean;
  /** Portföyün durumuna göre sunucuda seçilmiş hazır sorular (lib/portfolio-question-suggest.ts); boşsa çip basılmaz. */
  starters: string[];
}) {
  const inputId = useId();
  const [text, setText] = useState("");
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
      const response = await fetch("/api/ai/portfoy-sor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, locale }),
      });
      const data = (await response.json()) as { ok: boolean; answer?: PortfolioAskAnswer; reason?: string; remaining?: number };
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
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void ask(text);
    }
  };

  const out = remaining <= 0;
  const quota = labels.remaining.replace("{n}", String(remaining)).replace("{limit}", String(limit));
  const date = last?.answer.session
    ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${last.answer.session}T12:00:00Z`))
    : null;
  const answer = last?.answer;
  const fallback = answer?.kind === "unanswerable" ? labels.unanswerable : answer?.kind === "scenario-unavailable" ? labels.scenarioUnavailable : null;

  return (
    <Panel id="portfoyune-sor" className={styles.panel} aria-busy={pending !== null}>
      <PanelHeader title={labels.title} meta={<span className="numeral">{quota}</span>} />
      <div className={styles.body}>
        <p className={styles.intro}>{labels.intro}</p>

        <form className={styles.form} onSubmit={submit}>
          <label htmlFor={inputId} className={styles.label}>
            {labels.label}
          </label>
          <div className={styles.field}>
            <textarea
              id={inputId}
              rows={2}
              enterKeyHint="send"
              autoComplete="off"
              className={styles.input}
              value={text}
              maxLength={MAX_CHARS}
              placeholder={labels.placeholder}
              disabled={out}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <Button type="submit" className={styles.submit} disabled={pending !== null || out || text.trim().length < 3}>
              {labels.submit}
            </Button>
          </div>
        </form>

        <ul className={styles.chips} aria-label={labels.examplesLabel} style={starters.length === 0 ? { display: "none" } : undefined}>
          {starters.map((example) => (
            <li key={example}>
              <button
                type="button"
                className={styles.chip}
                disabled={pending !== null || out}
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
            {labels.errors[out && error !== "auth" ? "quota" : error]}
          </p>
        )}

        <div aria-live="polite">
          {pending ? (
            <div className={styles.exchange} data-state="loading">
              <p className={styles.kicker}>{labels.question}</p>
              <p className={styles.asked}>{pending}</p>
              <p className={styles.loading}>
                <Sparkle className={styles.loadingIcon} size={15} weight="fill" aria-hidden />
                {labels.asking}
              </p>
              <Skeleton className={cn(styles.line, "w-[94%]")} />
              <Skeleton className={cn(styles.line, "w-[86%]")} />
              <Skeleton className={cn(styles.line, "w-[58%]")} />
              <div className={styles.measures} aria-hidden>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className={styles.measureSkeleton} />
                ))}
              </div>
            </div>
          ) : last && answer ? (
            <article className={styles.exchange} data-state="answer">
              <p className={styles.kicker}>{labels.question}</p>
              <p className={styles.asked}>{last.question}</p>
              <div className={styles.answerHead}>
                <p className={styles.kicker}>
                  <Sparkle className={styles.mark} size={14} weight="duotone" aria-hidden />
                  {labels.answer}
                </p>
                {answer.owner && !fallback ? (
                  <span className={styles.badge}>{labels.owner}</span>
                ) : answer.kind === "advice" ? (
                  <span className={styles.badge}>{labels.advice}</span>
                ) : null}
              </div>
              {fallback ? (
                <p className={cn(styles.paragraph, styles.fallback)}>{fallback}</p>
              ) : (
                answer.paragraphs.map((paragraph, i) => (
                  <p key={i} className={styles.paragraph}>
                    {paragraph}
                  </p>
                ))
              )}
              {answer.partial && !fallback && <p className={styles.partial}>{labels.partial}</p>}
              {answer.measures.length > 0 && (
                <div className={styles.measureBlock}>
                  <p className={styles.kicker}>{labels.measuresLabel}</p>
                  <ul className={styles.measures}>
                    {answer.measures.map((card) => (
                      <li key={card.id} className={styles.measure}>
                        <span className={styles.measureScope}>{card.scope}</span>
                        <span className={styles.measureLabel}>{card.label}</span>
                        <span className={cn("numeral", styles.measureValue, card.tone === "up" && styles.up, card.tone === "down" && styles.down)}>
                          {card.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {date && <p className={styles.stamp}>{labels.session.replace("{date}", date)}</p>}
            </article>
          ) : (
            <div className={styles.preview}>
              <p className={styles.kicker}>{labels.previewLabel}</p>
              <ul className={styles.previewList}>
                {labels.preview.map((item) => (
                  <li key={item} className={styles.previewItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <p className={styles.disclosure}>{owner ? labels.ownerDisclosure : labels.disclosure}</p>
    </Panel>
  );
}
