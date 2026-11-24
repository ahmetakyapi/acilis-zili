"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, ArrowUp, Sparkle } from "@phosphor-icons/react";
import { LoadingMark } from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";
import styles from "./Chat.module.css";

/**
 * ORTAK SOHBET BİLEŞENLERİ (11 Kasım) — dev-starter `snippets/ui/chat-thread`
 * + `chat-composer`ın uyarlaması (farklar Chat.module.css başında). Portföy
 * danışmanı (/portfoy/analiz) ve "Bu Hisseye Sor" (şirket detayı) aynı
 * kalıbı kullanır.
 *
 * `ChatThread`: mesaj listesi (`role="log"`, yanıt beklerken `aria-busy`),
 * kullanıcı balonu sağda, asistan metni balonsuz ve Claude imiyle; her
 * mesajın başında gizli "Sen:" / "Claude:" etiketi (konum tek işaret değil).
 * Yeni mesajda liste yalnız kullanıcı zaten sondaysa kayar.
 * `SuggestionChips`: öneri ve takip soruları; metin olduğu gibi gönderilir.
 * `ChatComposer`: görünür etiketli, büyüyen metin alanı; Enter gönderir,
 * Shift+Enter satır açar, IME bileşimi sırasında göndermez.
 */

export type ChatMessage = { id: string; role: "user" | "assistant"; content: ReactNode };

export function ChatThread({
  messages,
  thinking = false,
  thinkingLabel,
  label,
  youLabel,
  assistantLabel,
  contained = false,
  className,
}: {
  messages: readonly ChatMessage[];
  thinking?: boolean;
  thinkingLabel: string;
  label: string;
  youLabel: string;
  assistantLabel: string;
  /** Liste kendi kutusunda kayar (24 Kasım, Bu Hisseye Sor: "sol taraf çok
      uzuyor, scrollu olsun"). Yükseklik sınırı çağıranın CSS'inde; burada
      yalnız kaydırma kabı ve kendi içinde kaydırma. */
  contained?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const count = messages.length;
  useEffect(() => {
    if (count === 0) return;
    if (contained) {
      /* Kutunun içinde kayar, sayfa yerinde kalır. Beklerken dibe (soru ve
         bekleme imi görünsün); yanıt gelince SON SORUNUN başına: yanıt
         baştan okunur, dibine atlanmaz (sohbet uygulamalarının davranışı). */
      const el = box.current;
      if (!el) return;
      const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      if (thinking) {
        el.scrollTo({ top: el.scrollHeight, behavior });
        return;
      }
      const asked = el.querySelectorAll<HTMLElement>("[data-chat-user]");
      const last = asked[asked.length - 1];
      el.scrollTo({ top: last ? Math.max(0, last.offsetTop - 4) : el.scrollHeight, behavior });
      return;
    }
    const el = end.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    /* Yalnız son mesaj görünür alanın hemen altına düşüyorsa kaydır. */
    if (rect.top > window.innerHeight - 40 && rect.top < window.innerHeight + 600) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [count, thinking, contained]);
  return (
    <div ref={box} className={cn(styles.thread, contained && styles.contained, className)} role="log" aria-label={label} aria-busy={thinking || undefined}>
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className={styles.user} data-chat-user="">
            <div className={styles.userBubble}>
              <span className="sr-only">{youLabel}: </span>
              {m.content}
            </div>
          </div>
        ) : (
          <div key={m.id} className={styles.assistant}>
            <span className={styles.avatar} aria-hidden>
              <Sparkle size={15} weight="duotone" />
            </span>
            <div className={styles.assistantBody}>
              <span className="sr-only">{assistantLabel}: </span>
              {m.content}
            </div>
          </div>
        ),
      )}
      {thinking && (
        <div className={styles.thinking}>
          <LoadingMark label={thinkingLabel} compact />
        </div>
      )}
      <div ref={end} aria-hidden />
    </div>
  );
}

export function SuggestionChips({
  items,
  onPick,
  disabled,
  label,
  variant = "pill",
  kickers,
  className,
}: {
  items: readonly string[];
  onPick: (text: string) => void;
  disabled?: boolean;
  label: string;
  /** "card": boş sohbetin açılış kartları — konu künyesi + soru + ok, tam
      genişlik satır (24 Kasım). "pill": yanıt altındaki takip hapları. */
  variant?: "pill" | "card";
  /** Kart başına konu künyesi (Title Case), `items` ile aynı sırada. */
  kickers?: readonly (string | undefined)[];
  className?: string;
}) {
  if (items.length === 0) return null;
  if (variant === "card") {
    return (
      <ul className={cn(styles.cards, className)} aria-label={label}>
        {items.map((item, index) => (
          <li key={item}>
            <button type="button" className={styles.card} onClick={() => onPick(item)} disabled={disabled}>
              <span className={styles.cardIcon} aria-hidden>
                <Sparkle size={14} weight="fill" />
              </span>
              <span className={styles.cardText}>
                {kickers?.[index] && <span className={styles.cardKicker}>{kickers[index]}</span>}
                <span className={styles.cardQuestion}>{item}</span>
              </span>
              <ArrowRight size={15} weight="bold" className={styles.cardArrow} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={cn(styles.suggestions, className)} aria-label={label}>
      {items.map((item) => (
        <li key={item}>
          <button type="button" className={styles.suggestion} onClick={() => onPick(item)} disabled={disabled}>
            <Sparkle size={13} weight="fill" aria-hidden />
            {item}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ChatComposer({
  onSend,
  label,
  placeholder,
  sendLabel,
  disabled = false,
  busy = false,
  maxLength = 500,
  foot,
  className,
  defaultValue = "",
}: {
  onSend: (text: string) => void;
  label: string;
  placeholder: string;
  sendLabel: string;
  disabled?: boolean;
  busy?: boolean;
  maxLength?: number;
  foot?: ReactNode;
  className?: string;
  /** Kutuya YAZILI gelen ilk metin, gönderilmez (11 Kasım, Bu Hisseye Sor:
      girişten dönen okurun seçtiği öneri). Yalnız ilk çizimde okunur. */
  defaultValue?: string;
}) {
  const id = useId();
  const [text, setText] = useState(defaultValue);
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && !busy && text.trim().length > 0;
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };
  /* `field-sizing` desteklemeyen tarayıcıda yükseklik içerikten. */
  useEffect(() => {
    const el = ref.current;
    if (!el || CSS.supports?.("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  }, [text]);
  return (
    <form className={cn(styles.composer, className)} onSubmit={submit}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.row}>
        <textarea
          ref={ref}
          id={id}
          rows={1}
          className={styles.field}
          value={text}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className={styles.send} disabled={!canSend} aria-label={sendLabel}>
          <ArrowUp size={18} weight="bold" aria-hidden />
        </button>
      </div>
      {foot && <div className={styles.foot}>{foot}</div>}
    </form>
  );
}
