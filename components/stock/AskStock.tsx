"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowCounterClockwise, ArrowRight, ArrowUpRight, NotePencil, Sparkle, WarningCircle } from "@phosphor-icons/react";
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
 *
 * SOHBET PENCERESİ (24 Kasım, sahibinin isteği: "tam AI sohbeti gibi
 * çalışsın; sol taraf çok uzuyor, scrollu olsun; en baştaki alttaki boşluk
 * düzelsin"). Liste sayfayı uzatmıyor, kendi kutusunda kayıyor
 * (`ChatThread contained`): beklerken dibe, yanıt gelince son sorunun
 * başına kayar. Kolon sohbette panelin tavanını verir (askmove.module.css),
 * yan kolon artık sohbetin boyuna gerilmiyor. Boşken karşılama (şirketin
 * adıyla) ve konu künyeli açılış kartları; "Sohbeti Temizle" başlığa
 * "Yeni Sohbet" olarak çıktı (telefonda yalnız ikon).
 * Ölçüm (geçici önizleme + `page.route` sahte yanıtı, açık tema,
 * `reducedMotion: reduce`; MU, iki not etkeni): yatay taşma her durumda 0.
 * Panel boş 1440 / 1280 / 1024 = 581 / 675 / 718, iki tur sonra 650 / 675 /
 * 718 (önce iki turda sol kolon ~1.130'a uzuyor, sağdaki gün satırları 160
 * piksel aralıklıydı; şimdi 34). Telefonda (390) iki tur sonra kolon 879,
 * liste kutusu en çok 620. Boşken başlık–sahne ve giriş–künye aralığı 12.
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
/* AÇILIŞ KARTLARI YAN KOLONU DOLDURUR (26 Kasım 2026, sahibinin sözü: "sağ
   sol dengesine dikkat ederek bu tasarımı iyileştirelim"). Sunucu dört
   kartın ardından havuzdaki en çok üç yedek soruyu `display:none` basar
   (AskStock.module.css → `.starters`); iki kolonlu düzende (≥ 1024) yan
   kolon uzunsa (Claude notu etkenleriyle geldi) sığan kadarı açılır. Önce
   1440'ta not gelince sol sahnede karşılamanın üstünde ve kartların altında
   ~110'ar piksel ölü zemin kalıyordu (geçici önizleme, MU). Kural
   `.claude/rules/arayuz.md` → "Boşluk esnetilmez, doldurulur";
   `components/today/FillColumn.tsx` ile aynı yöntem: hepsini kapat, yan
   kolonun bıraktığı payı ölç, sığanı aç. Yalnız pay içinde açıldığı için
   satırın boyu değişmez (geri besleme yok). JS kapalıyken dört kart. */
const FILL_EXTRA = 3;
/** Açılan karttan sonra sahnede kalması gereken en az boşluk (karşılama–kart aralığı kadar). */
const FILL_BREATH = 14;
/** Sunucuya giden önceki tur sayısı ve yanıt kısaltması (core'daki sınırla aynı; sunucu yine keser). */
const HISTORY_TURNS = 2;
const HISTORY_ANSWER_CHARS = 320;

type Turn = { id: string; question: string; topic: SuggestTopic | null; answer: AskAnswer };
type ErrorKey = keyof AskStockLabels["errors"];
type Failure = { key: ErrorKey; question: string | null; topic: SuggestTopic | null };
/* Yeniden denemenin anlamlı olduğu hatalar; kota, oturum ve soru biçiminde düğme yok. */
const RETRYABLE = new Set<ErrorKey>(["error", "busy", "rate", "budget"]);

export function AskStock({
  symbol,
  name,
  locale,
  labels,
  signedIn,
  remaining: initialRemaining,
  limit,
  suggestions,
}: {
  symbol: string;
  /** Karşılamadaki kısa şirket adı ("Micron Technology"); yoksa sembol. */
  name: string;
  locale: Locale;
  labels: AskStockLabels;
  signedIn: boolean;
  remaining: number;
  limit: number;
  suggestions: Suggestion[];
}) {
  const titleId = useId();
  const searchParams = useSearchParams();
  /* SABİT ÖRNEK YEDEĞİ YOK (14 Kasım). Liste boşsa eskiden sözlükteki üç
     sabit soru basılıyordu ("Son bilançoda beklentiyi aştı mı?", "Analistler
     ne diyor?", "Temettü ödüyor mu?"): listenin boş olması tam da o verilerin
     OLMADIĞI anlamına geliyor, üç hap da "cevaplayamıyorum"a çıkıyordu. Veri
     yoksa hap yok; okur kendi sorusunu yazar. */
  const pool: Suggestion[] = suggestions;
  const starters = pool.slice(0, STARTER_COUNT + FILL_EXTRA);
  const stageRef = useRef<HTMLDivElement>(null);
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

  const chatting = messages.length > 0;

  useEffect(() => {
    const stage = stageRef.current;
    const panel = stage?.closest("[data-askmove]");
    if (!stage || !panel) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const extras = () => [...stage.querySelectorAll<HTMLElement>(`ul > li:nth-child(n + ${STARTER_COUNT + 1})`)];
    if (extras().length === 0) return;
    /* Sahnenin içeriği (karşılama + kartlar) ile kutusu arasındaki pay. */
    const slack = () => {
      const kids = [...stage.children] as HTMLElement[];
      const first = kids[0]?.getBoundingClientRect();
      const last = kids.at(-1)?.getBoundingClientRect();
      return first && last ? stage.clientHeight - (last.bottom - first.top) : 0;
    };
    let frame = 0;
    const fit = () => {
      const rows = extras();
      rows.forEach((row) => row.removeAttribute("data-fill-open"));
      if (!wide.matches) return;
      for (const row of rows) {
        row.setAttribute("data-fill-open", "");
        if (slack() < FILL_BREATH) {
          row.removeAttribute("data-fill-open");
          break;
        }
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    /* Gözlemci yan kolonun İÇERİĞİNİ izler (not sonradan gelir, etkenler
       açılıp kapanır); kendi kolonunu izleseydi açtığı kart onu yeniden
       tetiklerdi. */
    const observer = new ResizeObserver(schedule);
    for (const col of panel.children) {
      if (!col.contains(stage) && col.firstElementChild) observer.observe(col.firstElementChild);
    }
    wide.addEventListener("change", schedule);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      wide.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [chatting, signedIn, starters.length]);
  const kickers = starters.map((item) => labels.topics[item.topic]);
  const welcome = (
    <div className={styles.welcome}>
      <span className={styles.welcomeMark} aria-hidden>
        <Sparkle size={18} weight="duotone" />
      </span>
      <p className={styles.welcomeTitle}>{labels.welcomeTitle.replace("{name}", name)}</p>
      <p className={styles.welcomeText}>{signedIn ? labels.welcome : labels.signedOut}</p>
    </div>
  );

  return (
    <section id={ANCHOR} className={styles.ask} aria-labelledby={titleId} data-chat-active={chatting || undefined}>
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          <Sparkle className={base.icon} size={17} weight="duotone" aria-hidden />
          {labels.title}
        </h2>
        <div className={styles.headSide}>
          {signedIn && <span className={cn("numeral", styles.quota)} data-empty={outOfQuota || undefined}>{quota}</span>}
          {signedIn && turns.length > 0 && !pending && (
            <button type="button" className={styles.newChat} onClick={reset} title={labels.newChat}>
              <NotePencil size={14} weight="bold" aria-hidden />
              <span className={styles.newChatText}>{labels.newChat}</span>
            </button>
          )}
        </div>
      </div>
      {!signedIn ? (
        <>
          <div ref={stageRef} className={styles.stage}>
            {welcome}
            {/* Oturumsuz öneriler giriş bağlantısı; görünüm ortak açılış
                kartı (Chat.module.css → `.card`), bileşen düğme bastığı için
                sınıfıyla. */}
            {starters.length > 0 && (
              <ul className={cn(chat.cards, styles.starters)} aria-label={labels.startersLabel}>
                {starters.map((item, index) => (
                  <li key={item.text}>
                    <Link href={signInHref(symbol, item.text)} className={chat.card} rel="nofollow">
                      <span className={chat.cardIcon} aria-hidden>
                        <Sparkle size={14} weight="fill" />
                      </span>
                      <span className={chat.cardText}>
                        <span className={chat.cardKicker}>{kickers[index]}</span>
                        <span className={chat.cardQuestion}>{item.text}</span>
                      </span>
                      <ArrowRight size={15} weight="bold" className={chat.cardArrow} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.signIn}>
            {/* İKİNCİL (28 Kasım 2026, Görsel Tur 4). Şirket sayfasında üç
                dolgulu mavi buton vardı (Claude kartı, bu buton, Şirket
                Analizi bandı); ekranda tek birincil kalır: teknik kartın
                dibindeki Claude butonu (sahibinin 11 Ekim isteğiyle düz
                mavi, `ClaudeAction`). Giriş yine bir tık: soru kartlarının
                her biri de giriş sayfasına gidiyor. */}
            <ButtonLink href={signInHref(symbol)} variant="ghost" rel="nofollow">
              {labels.signIn}
            </ButtonLink>
            <span className={styles.memberQuota}>{labels.memberQuota.replace("{limit}", String(limit))}</span>
          </div>
        </>
      ) : (
        <>
          {chatting ? (
            <ChatThread
              messages={messages}
              thinking={pending !== null}
              thinkingLabel={labels.asking}
              label={labels.threadLabel}
              youLabel={labels.you}
              assistantLabel={labels.claude}
              contained
              className={styles.thread}
            />
          ) : (
            <div ref={stageRef} className={styles.stage}>
              {welcome}
              <SuggestionChips
                items={starters.map((item) => item.text)}
                kickers={kickers}
                variant="card"
                label={labels.startersLabel}
                disabled={outOfQuota}
                className={styles.starters}
                onPick={(text) => void ask(text, starters.find((item) => item.text === text)?.topic ?? null)}
              />
            </div>
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
