"use client";

import { useId, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowCounterClockwise, ArrowUpRight, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { ChatComposer, ChatThread, SuggestionChips, type ChatMessage } from "@/components/ai/chat/Chat";
import chat from "@/components/ai/chat/Chat.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ButtonLink } from "@/components/ui/primitives";
import base from "@/components/stock/StockInsightCard.module.css";
import type { AskStockLabels } from "@/lib/i18n/dictionaries/ask-stock";
import type { Locale } from "@/lib/i18n/config";
import type { AskAnswer } from "@/lib/stock-question";
import { pickFollowUps, STARTER_COUNT, type Suggestion, type SuggestTopic } from "@/lib/stock-question-suggest";
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
 *
 * SOHBET (11 Kasım, sahibinin isteği: "hem görsel olarak iyi seviyeye
 * getirelim dev starter componentleriyle hem de daha mantıklı sorular
 * olsun, oradan seçsin veya kendisi soru sorsun"). Bölüm tek soru-tek
 * yanıt kutusundan sohbete döndü; kalıp ortak sohbet bileşenleri
 * (components/ai/chat/Chat.tsx: `ChatThread`, `SuggestionChips`,
 * `ChatComposer`, portföy danışmanıyla aynı):
 * - Boşken o günün veriye bağlı öneri hapları (sunucuda seçilir,
 *   lib/stock-question-suggest.ts), altında kendi sorusunu yazacağı kutu.
 *   Öneri gelmezse sözlükteki üç sabit örnek.
 * - Soru sağda balon, yanıt solda Claude imiyle; yanıtın altında künye
 *   (Tavsiye Değil, Yararlanılan Veri, kaynak haberler, seans tarihi) kıl
 *   çizgiyle ayrık ve en sonda 2–3 TAKİP sorusu (`pickFollowUps`; son
 *   yanıtın konusuna komşu konular, sorulmuş olan tekrar önerilmez).
 * - Tur geçmişi yalnız bu sayfada (React durumu): yenileyince sıfırlanır.
 *   Önceki en çok iki tur sunucuya kısa hâliyle gider (gerekçe
 *   lib/stock-question-core.ts → "Sohbet geçmişi"); günlük hak sayacı aynen.
 * - Tek satırlık girdi büyüyen metin alanına döndü (Enter gönderir,
 *   Shift+Enter satır açar); 25 Ekim'in "uzun soru tek satırda yana kayar"
 *   kusuru bununla kalktı. Yanıt kartının kayarak girişi (`as-rise`) de
 *   kalktı: metin kaymaz (`.claude/rules/hareket.md`); bekleme tek döngüsel
 *   imle (`LoadingMark`).
 * Ölçüm (11 Kasım; sahte sağlayıcı + geçici önizleme ve `page.route`
 * sahte yanıtı, iki tema, `reducedMotion: reduce`): yatay taşma, kutudan
 * taşan ve kırpılan öğe her durumda 0. Bölüm boyu boş 1440'ta 368 / 390'da
 * 363 (oturumsuz 360 / 377; gerçek /hisse/NVDA oturumsuz 1440'ta 320 →
 * 316, panel 358 → 354), bekliyor 386 / 443, iki tur yanıt + takip 954 /
 * 1326, hata 340 / 418, yanıtlanamadı 558 / 672. Çalışan animasyon yalnız
 * beklerken 1 (`LoadingMark`); yanıt gelince 0.
 */

/* "Yanıtın Dayanabileceği Veri" künyesi (25 Ekim, iki kolonlu düzende yan
   kolonun boyunu dolduruyordu) 11 Kasım'da kalktı: öneri hapları aynı
   bilgiyi soru olarak veriyor ve sohbet kolonu artık yan kolondan uzun —
   doldurulacak boşluk kalmadı. Aynı nedenle oturumlu giriş cümlesi de
   (kural dipteki künyede yazılı). */
/** Dönüş adresindeki örnek soru parametresi. */
const PREFILL_PARAM = "soru";
const ANCHOR = "bu-hisseye-sor";

const MAX_CHARS = 300;
/** Sunucuya giden önceki tur sayısı ve yanıt kısaltması (core'daki sınırla aynı; sunucu yine keser). */
const HISTORY_TURNS = 2;
const HISTORY_ANSWER_CHARS = 320;
/* Sözlükteki sabit örneklerin konuları, sırasıyla (öneri listesi boşsa). */
const EXAMPLE_TOPICS: SuggestTopic[] = ["lastEarnings", "analysts", "dividend"];

type Turn = { id: string; question: string; topic: SuggestTopic | null; answer: AskAnswer };
type ErrorKey = keyof AskStockLabels["errors"];
type Failure = { key: ErrorKey; question: string | null; topic: SuggestTopic | null };
/* Yeniden denemenin anlamlı olduğu hatalar; kota, oturum ve soru biçiminde düğme yok. */
const RETRYABLE = new Set<ErrorKey>(["error", "busy", "rate", "budget"]);

export function AskStock({
  symbol,
  locale,
  labels,
  signedIn,
  remaining: initialRemaining,
  limit,
  suggestions,
}: {
  symbol: string;
  locale: Locale;
  labels: AskStockLabels;
  signedIn: boolean;
  remaining: number;
  limit: number;
  suggestions: Suggestion[];
}) {
  const titleId = useId();
  const searchParams = useSearchParams();
  const pool: Suggestion[] = suggestions.length
    ? suggestions
    : labels.examples.map((text, i) => ({ topic: EXAMPLE_TOPICS[i] ?? "session", text }));
  const starters = pool.slice(0, STARTER_COUNT);
  /* Girişten dönüş: adresteki öneri kutuya yazılır, GÖNDERİLMEZ. Yalnız
     sunucunun bu sayfa için seçtiği öneriler ya da sözlükteki örnekler kabul
     edilir — dışarıdan hazırlanmış bir bağlantı kutuya keyfî metin koyamasın.
     İlk durum adresten (sunucu da aynısını çizer, hidrasyon uyuşur). */
  const [prefill] = useState(() => {
    const wanted = searchParams.get(PREFILL_PARAM);
    return signedIn && wanted && pool.some((item) => item.text === wanted) ? wanted : "";
  });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState<{ question: string; topic: SuggestTopic | null } | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [composerKey, setComposerKey] = useState(0);

  const ask = async (raw: string, topic: SuggestTopic | null) => {
    const question = raw.replace(/\s+/g, " ").trim();
    if (pending) return;
    if (question.length < 3 || question.length > MAX_CHARS) {
      setFailure({ key: "question", question: null, topic: null });
      return;
    }
    setPending({ question, topic });
    setFailure(null);
    const history = turns
      .filter((turn) => turn.answer.text)
      .slice(-HISTORY_TURNS)
      .map((turn) => ({ question: turn.question, answer: turn.answer.text!.slice(0, HISTORY_ANSWER_CHARS) }));
    try {
      const response = await fetch("/api/ai/hisse-sor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, question, locale, ...(history.length ? { history } : {}) }),
      });
      const data = (await response.json()) as { ok: boolean; answer?: AskAnswer; reason?: string; remaining?: number };
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (data.ok && data.answer) {
        const answer = data.answer;
        setTurns((list) => [...list, { id: `${Date.now()}-${list.length}`, question, topic, answer }]);
      } else {
        const reason = data.reason as ErrorKey | undefined;
        setFailure({ key: reason && reason in labels.errors ? reason : "error", question, topic });
      }
    } catch {
      setFailure({ key: "error", question, topic });
    } finally {
      setPending(null);
    }
  };

  const reset = () => {
    setTurns([]);
    setFailure(null);
    setComposerKey((n) => n + 1);
  };

  const quota = labels.remaining.replace("{n}", String(remaining)).replace("{limit}", String(limit));
  const outOfQuota = remaining <= 0;
  const idle = turns.length === 0 && !pending && !failure?.question;
  const last = turns.at(-1) ?? null;
  const followUps =
    last && !pending && !failure && !outOfQuota
      ? pickFollowUps(pool, { topic: last.topic, sources: last.answer.sources }, { texts: turns.map((t) => t.question), topics: turns.flatMap((t) => (t.topic ? [t.topic] : [])) })
      : [];

  const messages: ChatMessage[] = [];
  for (const turn of turns) {
    messages.push({ id: `${turn.id}-q`, role: "user", content: turn.question });
    messages.push({
      id: `${turn.id}-a`,
      role: "assistant",
      content: (
        <AnswerBody
          answer={turn.answer}
          labels={labels}
          locale={locale}
          stamp={turn === last}
          followUps={
            turn === last && followUps.length > 0 ? (
              <div className={styles.followUps}>
                <p className={styles.followLabel}>{labels.followUpsLabel}</p>
                <SuggestionChips
                  items={followUps.map((item) => item.text)}
                  label={labels.followUpsLabel}
                  disabled={pending !== null}
                  onPick={(text) => void ask(text, followUps.find((item) => item.text === text)?.topic ?? null)}
                />
              </div>
            ) : null
          }
        />
      ),
    });
  }
  if (pending) messages.push({ id: "pending-q", role: "user", content: pending.question });
  if (failure?.question && !pending) {
    const { question, topic, key } = failure;
    messages.push({ id: "failed-q", role: "user", content: question });
    messages.push({
      id: "failed-a",
      role: "assistant",
      content: (
        <p className={styles.failure} role="alert">
          <WarningCircle size={16} weight="fill" aria-hidden className={styles.failureIcon} />
          <span className={styles.failureText}>{labels.errors[outOfQuota && key !== "auth" ? "quota" : key]}</span>
          {RETRYABLE.has(key) && !outOfQuota && (
            <button type="button" className={styles.retry} onClick={() => void ask(question, topic)}>
              <ArrowCounterClockwise size={13} weight="bold" aria-hidden />
              {labels.retry}
            </button>
          )}
        </p>
      ),
    });
  }

  return (
    <section id={ANCHOR} className={styles.ask} aria-labelledby={titleId}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          <Sparkle className={base.icon} size={17} weight="duotone" aria-hidden />
          {labels.title}
        </h2>
        {signedIn && <span className={cn("numeral", styles.quota)} data-empty={outOfQuota || undefined}>{quota}</span>}
      </div>
      {!signedIn ? (
        <>
          <p className={styles.intro}>{labels.signedOut}</p>
          {/* Oturumsuz öneriler giriş bağlantısı; görünüm ortak öneri hapı
              (Chat.module.css → `.suggestion`), bileşen düğme bastığı için
              sınıfıyla. */}
          <ul className={cn(chat.suggestions, styles.starters)} aria-label={labels.startersLabel}>
            {starters.map((item) => (
              <li key={item.text}>
                <Link href={signInHref(symbol, item.text)} className={chat.suggestion} rel="nofollow">
                  <Sparkle size={13} weight="fill" aria-hidden />
                  {item.text}
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
          {idle && (
            <SuggestionChips
              items={starters.map((item) => item.text)}
              label={labels.startersLabel}
              disabled={outOfQuota}
              className={styles.starters}
              onPick={(text) => void ask(text, starters.find((item) => item.text === text)?.topic ?? null)}
            />
          )}
          {messages.length > 0 && (
            <ChatThread
              messages={messages}
              thinking={pending !== null}
              thinkingLabel={labels.asking}
              label={labels.threadLabel}
              youLabel={labels.you}
              assistantLabel={labels.claude}
              className={styles.thread}
            />
          )}
          {failure && !failure.question && (
            <p className={styles.formError} role="alert">
              {labels.errors[failure.key]}
            </p>
          )}
          {outOfQuota && idle && <p className={styles.formError}>{labels.errors.quota}</p>}
          <ChatComposer
            key={composerKey}
            onSend={(text) => void ask(text, pool.find((item) => item.text === text)?.topic ?? null)}
            label={labels.composerLabel}
            placeholder={labels.chatPlaceholder}
            sendLabel={labels.send}
            disabled={outOfQuota}
            busy={pending !== null}
            maxLength={MAX_CHARS}
            defaultValue={composerKey === 0 ? prefill : ""}
            className={styles.composer}
            foot={
              turns.length > 0 && !pending ? (
                <button type="button" className={styles.reset} onClick={reset}>
                  {labels.reset}
                </button>
              ) : undefined
            }
          />
        </>
      )}
      <p className={styles.disclosure}>{labels.disclosure}</p>
    </section>
  );
}

/** Claude'un yanıtı: metin, altında kıl çizgiyle ayrık künye, en sonda takip soruları. */
function AnswerBody({
  answer,
  labels,
  locale,
  stamp,
  followUps,
}: {
  answer: AskAnswer;
  labels: AskStockLabels;
  locale: Locale;
  stamp: boolean;
  followUps: ReactNode;
}) {
  const unanswerable = answer.kind === "unanswerable";
  const date =
    stamp && answer.session
      ? new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${answer.session}T12:00:00Z`))
      : null;
  const hasMeta = answer.kind === "advice" || answer.sources.length > 0 || answer.news.length > 0 || date !== null;
  return (
    <div className={styles.answer}>
      <p className={cn(styles.text, unanswerable && styles.unanswerable)}>{unanswerable ? labels.unanswerable : answer.text}</p>
      {hasMeta && (
        <div className={styles.meta}>
          {(answer.kind === "advice" || answer.sources.length > 0) && (
            <p className={styles.sources}>
              {answer.kind === "advice" && <span className={styles.badge}>{labels.advice}</span>}
              {answer.sources.length > 0 && <span className={styles.sourcesLabel}>{labels.sourcesLabel}</span>}
              {answer.sources.map((source) => (
                <span key={source} className={styles.source}>
                  {labels.sources[source]}
                </span>
              ))}
            </p>
          )}
          {answer.news.length > 0 && (
            <div className={styles.news}>
              <p className={styles.sourcesLabel}>{labels.newsLabel}</p>
              <ul>
                {answer.news.map((item) => (
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
      )}
      {followUps}
    </div>
  );
}

/** Giriş bağlantısı: dönüş bu panele, örnek soru varsa adreste. */
function signInHref(symbol: string, example?: string) {
  const back = `/hisse/${symbol}${example ? `?${PREFILL_PARAM}=${encodeURIComponent(example)}` : ""}#${ANCHOR}`;
  return `/giris?devam=${encodeURIComponent(back)}`;
}
