"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import styles from "./Themes.module.css";

/**
 * Tema haritasının istemci katmanı — karolar sunucuda çiziliyor; burada
 * giriş koreografisinin tetiği ve TEK bir künye kartı var.
 *
 * 1. GİRİŞ KOREOGRAFİSİ görünüme girince. Karolar CSS animasyonuyla
 *    büyükten küçüğe açılıyor (Themes.module.css → `tile-in`). Harita akışla
 *    ekrana indiğinde animasyon zaten oynuyor; ama harita ilk ekranın
 *    altındaysa okuyucu oraya indiğinde çoktan bitmiş oluyor. O durumda
 *    karolar görünmezken `data-armed` ile gizleniyor ve görüş alanına
 *    girince `data-play` ile yeniden oynuyor. Görünürken gizlenmiyor:
 *    ekrandaki haritayı söndürüp yeniden yakmak bir titreme olurdu.
 *    JavaScript yoksa ya da hareket azaltılmışsa karolar yerinde durur.
 * 2. KÜNYE KARTI TEK VE PAYLAŞILAN (28 Eylül, ölçüldü). İlk hâlde her karo
 *    kendi kartını sunucuda taşıyordu (`/piyasalar`daki gibi); iki yerleşim
 *    × yirmi üye ≈ 420 fazladan DOM düğümü demekti; 4x yavaş CPU'da
 *    Katılım sayfasının TBT'si tek kartla 78'den 65 ms'ye indi. Artık karo
 *    künyesini `data-peek` özniteliğinde taşıyor ve kart üzerine gelinen,
 *    odaklanılan ya da dokunulan karonun yanında bir kez çiziliyor.
 *    Ekran okuyucu kartı beklemiyor: aynı bilgiler karonun `aria-label`ında.
 * 3. DOKUNMATİKTE İLK DOKUNUŞ KARTI AÇAR, ikincisi şirkete gider. Parmakta
 *    "üzerine gelme" yok ve karo bir bağlantı olduğu için ilk dokunuş
 *    sayfayı değiştiriyordu. Escape ve dışarıya dokunmak kartı kapatır.
 */

/** Haritanın bu kadarı görününce koreografi başlar. */
const PLAY_THRESHOLD = 0.2;
/** Kartın karodan uzaklığı, ekran kenarından en az payı, alt gezinme
    çubuğunun ve üst başlığın payı (piksel). */
const CARD_GAP = 8;
const EDGE_GAP = 8;
const BOTTOM_BAR = 80;
const HEADER_GAP = 12;
/** İmleç karodan karta geçerken 8 piksellik aralıkta kart kapanmasın. */
const HIDE_DELAY = 120;

export type PeekData = {
  symbol: string;
  name: string;
  price: string;
  pct: string;
  /** Yön rengi yalnızca bu seansta; "flat" nötr yazar. */
  tone: "up" | "down" | "flat";
  cap: string;
  share: string;
  /** Seans kanıtı yoksa "Son Kapanış", varsa boş. */
  note: string;
};

type Peek = { data: PeekData; cell: HTMLElement };

export function TreemapStage({
  children,
  className,
  labels,
}: {
  children: ReactNode;
  className: string;
  labels: { cap: string; share: string; open: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const pointer = useRef<string>("mouse");
  const hideTimer = useRef<number | null>(null);
  const [armed, setArmed] = useState(false);
  const [play, setPlay] = useState(false);
  const [peek, setPeek] = useState<Peek | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    /* İlk görünürlük kararını gözlemcinin İLK bildirimi veriyor, bir
       `getBoundingClientRect` değil: hidrasyonun ortasında konum okumak
       yerleşimi zorla hesaplatırdı. */
    let first = true;
    const observer = new IntersectionObserver(
      (entries) => {
        const inView = entries.some((entry) => entry.isIntersecting);
        if (first) {
          first = false;
          if (inView) observer.disconnect();
          else setArmed(true);
          return;
        }
        if (!inView) return;
        setPlay(true);
        observer.disconnect();
      },
      { threshold: PLAY_THRESHOLD },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const cancelHide = () => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  const hide = (delay = 0) => {
    cancelHide();
    if (delay === 0) {
      setOpen(false);
      return;
    }
    hideTimer.current = window.setTimeout(() => setOpen(false), delay);
  };

  useEffect(() => {
    const close = () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onOutside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, []);

  /* Kartın yeri: yatayda karonun haritadaki yerine göre (`data-card-x`,
     sunucudan), dikeyde görüş alanında hangi tarafta yer varsa. Kart
     içeriğiyle çizildikten SONRA ölçülüyor; yazma doğrudan stile, ikinci
     bir çizim yok. */
  useLayoutEffect(() => {
    const stage = ref.current;
    const card = cardRef.current;
    if (!peek || !stage || !card) return;
    const box = stage.getBoundingClientRect();
    const rect = peek.cell.getBoundingClientRect();
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const align = peek.cell.dataset.cardX;
    const left =
      align === "start" ? rect.left : align === "end" ? rect.right - width : rect.left + rect.width / 2 - width / 2;
    const clamped = Math.min(Math.max(left, EDGE_GAP), window.innerWidth - width - EDGE_GAP);
    const top = Math.max(
      HEADER_GAP,
      ...Array.from(document.querySelectorAll("header.chrome"), (header) => header.getBoundingClientRect().bottom + HEADER_GAP),
    );
    const roomAbove = rect.top - top;
    const roomBelow = window.innerHeight - BOTTOM_BAR - rect.bottom;
    const below = roomAbove < height + CARD_GAP && roomBelow > roomAbove;
    card.style.left = `${clamped - box.left}px`;
    card.style.top = `${(below ? rect.bottom + CARD_GAP : rect.top - height - CARD_GAP) - box.top}px`;
    card.dataset.side = below ? "below" : "above";
  }, [peek]);

  const cellOf = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const cell = target.closest<HTMLElement>("[data-peek]");
    return cell && ref.current?.contains(cell) ? cell : null;
  };
  const inCard = (target: EventTarget | null) => target instanceof Node && !!cardRef.current?.contains(target);

  const show = (cell: HTMLElement) => {
    cancelHide();
    const raw = cell.dataset.peek;
    if (!raw) return;
    setPeek((current) => (current?.cell === cell ? current : { cell, data: JSON.parse(raw) as PeekData }));
    setOpen(true);
  };

  const onOver = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    if (inCard(event.target)) {
      cancelHide();
      return;
    }
    const cell = cellOf(event.target);
    if (cell) show(cell);
  };
  const onOut = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const next = event.relatedTarget;
    if (inCard(next) || (next instanceof Node && peek?.cell.contains(next))) return;
    hide(HIDE_DELAY);
  };
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const cell = cellOf(event.target);
    if (cell?.matches(":focus-visible")) show(cell);
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (inCard(event.relatedTarget) || cellOf(event.relatedTarget)) return;
    hide();
  };
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (pointer.current !== "touch" || inCard(event.target)) return;
    const cell = cellOf(event.target);
    if (!cell || (open && peek?.cell === cell)) return;
    event.preventDefault();
    show(cell);
  };

  return (
    <div
      ref={ref}
      className={className}
      data-armed={armed ? "" : undefined}
      data-play={play ? "" : undefined}
      onPointerDown={(event) => {
        pointer.current = event.pointerType;
      }}
      onPointerOver={onOver}
      onPointerOut={onOut}
      onFocus={onFocus}
      onBlur={onBlur}
      onClickCapture={onClick}
    >
      {children}
      {peek && (
        <Link
          ref={cardRef}
          href={`/hisse/${peek.data.symbol}`}
          prefetch={false}
          className={styles.peek}
          data-open={open ? "" : undefined}
          aria-hidden
          tabIndex={-1}
        >
          <span className={styles.peekHead}>
            <b className="numeral">{peek.data.symbol}</b>
            <small>{peek.data.name}</small>
          </span>
          <span className={styles.peekRow}>
            <span className="numeral">{peek.data.price}</span>
            <span className={`numeral ${styles.peekPct}`} data-tone={peek.data.tone}>
              {peek.data.tone === "up" ? "▲ " : peek.data.tone === "down" ? "▼ " : ""}
              {peek.data.pct}
            </span>
          </span>
          <span className={styles.peekMetrics}>
            <span>
              {labels.cap}
              <b className="numeral">{peek.data.cap}</b>
            </span>
            <span>
              {labels.share}
              <b className="numeral">{peek.data.share}</b>
            </span>
          </span>
          <span className={styles.peekFoot}>
            <span>{peek.data.note}</span>
            <span className={styles.peekOpen}>
              {labels.open}
              <ArrowUpRight size={12} weight="bold" aria-hidden />
            </span>
          </span>
        </Link>
      )}
    </div>
  );
}
