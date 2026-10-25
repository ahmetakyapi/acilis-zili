"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowDown,
  Broadcast,
  ChartLineUp,
  ChartPieSlice,
  Check,
  CheckCircle,
  CircleDashed,
  Coins,
  FileText,
  GlobeHemisphereWest,
  Info,
  Plus,
  Receipt,
  ShieldCheck,
  Vault,
  X,
  XCircle,
} from "@phosphor-icons/react";
import type { BrokerColumn } from "@/content/brokers";
import type { CostLine } from "@/lib/broker-line";
import {
  COMPARE_MAX,
  COMPARE_PARAM,
  DEFAULT_CARD_SORT,
  isCardSort,
  parseCompare,
  pctDigits,
  SORT_PARAM,
  sortCardIds,
  toggleCompare,
  type BrokerCardView,
  type CardRef,
  type CardRow,
  type CardSort,
} from "@/lib/broker-cards";
import type { brokerCardsTr } from "@/lib/i18n/dictionaries/broker-cards";
import { EASE_BRAND_POINTS } from "@/lib/motion";
import { cn, formatPercentPlain, formatPrice } from "@/lib/utils";
import { useRouteNavigating } from "@/components/layout/RouteProgress";
import { ChipStrip } from "@/components/ui/ChipStrip";
import { FoldToggle } from "@/components/ui/FoldToggle";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { Segment, SegmentItem } from "@/components/ui/primitives";
import { useAmountIndex, useSearchString, writeSearch } from "./broker-view-state";
import styles from "./BrokerCards.module.css";

/**
 * KURUM KURUM KARTLAR ve YAN YANA KARŞILAŞTIRMA (25 Ekim görsel turu).
 *
 * Sahibinin isteği: "Aracı kurum karşılaştırması ekranı çok daha görsel
 * olsun, kartlar falan kullanalım; table gibi şeylerde listelenen yazılar
 * görsel olarak eksik ve çok okunamıyor." 8×8 metin matrisi kartlara
 * döndü; matris kaynak katmanı olarak "Tüm Tarife Ayrıntıları" altında
 * katlı duruyor (BrokerTable).
 *
 * KART: baş harf rozeti (kurum logoları depoda ve lisans kaydında yok),
 * lisans rozeti, kaydırıcının tutarında komisyon (büyük rakam) ve altında
 * küçük ölçek — nokta bu kurum, gri çentikler ötekiler, ölçek maliyet
 * çizgisiyle AYNI (sıfırdan bu tutardaki en yüksek komisyona; aynı sayı aynı
 * kaynaktan: `costLine`). Sonra kalem başına ikon + etiket satırı, her
 * değerin yanında kaynak numarası, dipte okunduğu gün.
 *
 * SIRA ÖNERİ DEĞİL: varsayılan ad sırası; komisyon sırası okuyucunun seçimi
 * ve panelin dibindeki künye hangi tutarın komisyonu olduğunu söylüyor.
 * Kart hiçbir yere yönlendirmiyor: kurum adı bağlantı değil, hesap açma
 * sayfası yok, yalnız kaynak listesine çapa.
 *
 * SEÇİM VE SIRA ADRESTE (`?karsilastir=midas,gedik`, `?sira=komisyon`) —
 * sığ güncelleme, gezinme sürerken denetimler kapalı. Gerekçe
 * `broker-view-state.ts`.
 */

const CARD_MOTION = { type: "tween", duration: 0.42, ease: EASE_BRAND_POINTS } as const;

type IconComponent = typeof Coins;

/** Kalemin ikonu — anlamı söyleyen tek glif, süs değil. */
const FEATURE_ICON: Record<BrokerColumn, IconComponent> = {
  commission: Receipt,
  minimum: Coins,
  custody: Vault,
  fractional: ChartPieSlice,
  data: Broadcast,
  w8ben: FileText,
  options: ChartLineUp,
  license: ShieldCheck,
};

export type BrokerCardsLabels = typeof brokerCardsTr & {
  columns: Record<BrokerColumn, string>;
  unspecified: string;
  counterparty: string;
};

export function BrokerCards({
  cards,
  lines,
  locale,
  path,
  labels,
}: {
  cards: BrokerCardView[];
  /** Kaydırıcının her durağı için hazır çizgi — maliyet çizgisiyle aynı dizi. */
  lines: CostLine[];
  locale: "tr" | "en";
  /** Sayfanın yolu — sıra bağlantılarının JS'siz düşüşü. */
  path: string;
  labels: BrokerCardsLabels;
}) {
  const line = lines[useAmountIndex()];
  const search = useSearchString();
  const navigating = useRouteNavigating();
  const [spoken, setSpoken] = useState("");

  const ids = useMemo(() => cards.map((card) => card.id), [cards]);
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const sortParam = params.get(SORT_PARAM);
  const sort: CardSort = isCardSort(sortParam) ? sortParam : DEFAULT_CARD_SORT;
  const selected = useMemo(() => parseCompare(params.get(COMPARE_PARAM), ids), [params, ids]);
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const order = sortCardIds(cards, sort, line, locale);
  /* Seçim şeridi hep ad sırasında: kart sırası değişince çipler yer değiştirmesin. */
  const nameOrder = useMemo(() => sortCardIds(cards, "ad", lines[0], locale), [cards, lines, locale]);

  const usd = (value: number, digits = 2) => formatPrice(value, locale, { currency: true, digits });
  const amount = usd(line.amount, 0);

  const choose = useCallback(
    (id: string) => {
      if (navigating) return;
      const next = toggleCompare(selected, id);
      if (next.length === selected.length && !selected.includes(id)) return; // dolu
      writeSearch({ [COMPARE_PARAM]: next.length > 0 ? next.join(",") : null });
      setSpoken(
        next.length > 0
          ? labels.compare.announce.replace(
              "{names}",
              next.map((item) => byId.get(item)?.name ?? item).join(", "),
            )
          : labels.compare.announceEmpty,
      );
    },
    [byId, labels.compare.announce, labels.compare.announceEmpty, navigating, selected],
  );

  const clear = useCallback(() => {
    if (navigating) return;
    writeSearch({ [COMPARE_PARAM]: null });
    setSpoken(labels.compare.announceEmpty);
  }, [labels.compare.announceEmpty, navigating]);

  const seeCompare = useCallback(() => {
    document.getElementById("yan-yana")?.scrollIntoView({ block: "start" });
  }, []);

  const full = selected.length >= COMPARE_MAX;
  const fees = new Map(line.priced.map((entry) => [entry.id, entry]));
  const reasons = new Map(line.unpriced.map((entry) => [entry.id, entry.reason]));
  const max = line.max ?? 0;
  const ratioOf = (fee: number) => (max > 0 ? fee / max : 0);

  /** Kartın ve yan yana sütunun ortak ücret bloğu. */
  const feeBlock = (card: BrokerCardView, compact: boolean) => {
    const entry = fees.get(card.id);
    if (!entry) {
      const reason = reasons.get(card.id);
      return (
        <>
          <span className={styles.feeNone}>{labels.notPriced}</span>
          {!compact && (
            <div data-fold>
              <p className={styles.feeReason}>{reason ? reason[locale] : labels.notPricedFallback}</p>
            </div>
          )}
        </>
      );
    }
    const pct = labels.ofTrade.replace("{pct}", formatPercentPlain(entry.pct, locale, pctDigits(entry.pct)));
    const others = line.priced.filter((other) => other.id !== card.id);
    return (
      <>
        <span className={compact ? styles.cmpFee : styles.feeLine}>
          {compact ? <b className="numeral">{usd(entry.fee)}</b> : <span className={cn("numeral", styles.feeValue)}>{usd(entry.fee)}</span>}
          <span className={cn("numeral", styles.feePct)}>{pct}</span>
        </span>
        <span
          role="img"
          aria-label={labels.scaleLabel
            .replace("{name}", card.name)
            .replace("{fee}", usd(entry.fee))
            .replace("{max}", usd(max))}
          className={styles.scale}
        >
          <span className={styles.scaleTrack}>
          {others.map((other) => (
            <span key={other.id} className={styles.tickRail} style={{ "--x": ratioOf(other.fee) } as React.CSSProperties}>
              <span className={styles.tick} />
            </span>
          ))}
          <span className={styles.dotRail} style={{ "--x": ratioOf(entry.fee) } as React.CSSProperties}>
            <span className={styles.dot} />
          </span>
          </span>
        </span>
        <span aria-hidden className={cn("numeral", styles.scaleEnds)}>
          <span>{usd(0, 0)}</span>
          <span>{usd(max)}</span>
        </span>
      </>
    );
  };

  const pickButton = (card: BrokerCardView) => {
    const on = selected.includes(card.id);
    const blocked = !on && full;
    return (
      <button
        type="button"
        className={styles.pick}
        aria-pressed={on}
        aria-disabled={blocked || navigating || undefined}
        title={blocked ? labels.compare.full : undefined}
        onClick={() => {
          if (!blocked) choose(card.id);
        }}
      >
        {on ? <Check size={14} weight="bold" aria-hidden /> : <Plus size={14} weight="bold" aria-hidden />}
        <span className={styles.pickText}>{on ? labels.compare.on : labels.compare.add}</span>
        {blocked && <span className="sr-only">{labels.compare.full}</span>}
      </button>
    );
  };

  const shown = selected.map((id) => byId.get(id)).filter((card): card is BrokerCardView => Boolean(card));

  return (
    <div className="flex flex-col gap-4">
      {/* Denetimler: sıra ve yan yana seçimi. Tek satır, sayfanın seçim
          şeridi (CLAUDE.md ekran düzeni 2). */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-tiny font-semibold text-muted">{labels.sortLabel}</span>
          <span
            className={cn("transition-opacity", navigating && "pointer-events-none opacity-50")}
            aria-busy={navigating || undefined}
          >
            <Segment label={labels.sortLabel}>
              {(["ad", "komisyon"] as const).map((key) => (
                <SegmentItem
                  key={key}
                  href={key === DEFAULT_CARD_SORT ? path : `${path}?${SORT_PARAM}=${key}`}
                  active={sort === key}
                  prefetch={false}
                  shallow
                  disabled={navigating}
                  onClick={(event) => {
                    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    if (navigating) return;
                    writeSearch({ [SORT_PARAM]: key === DEFAULT_CARD_SORT ? null : key });
                  }}
                >
                  {labels.sorts[key]}
                </SegmentItem>
              ))}
            </Segment>
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 className="text-tiny font-semibold text-muted">{labels.compare.stripLabel}</h3>
            <span className="flex items-center gap-3 text-tiny text-muted">
              {selected.length > 0 && (
                <>
                  <span className="numeral">{labels.compare.count.replace("{n}", String(selected.length))}</span>
                  <button type="button" onClick={clear} className={cn(styles.footLink, "cursor-pointer")}>
                    {labels.compare.clear}
                  </button>
                </>
              )}
            </span>
          </div>
          <ChipStrip
            activeKey={selected[selected.length - 1] ?? null}
            className={cn("scroll-x", styles.strip)}
            scrollLabels={{ prev: labels.compare.scrollPrev, next: labels.compare.scrollNext }}
          >
            <div role="group" aria-label={labels.compare.stripLabel} className={styles.stripRow}>
            {nameOrder.map((id) => {
              const card = byId.get(id);
              if (!card) return null;
              const on = selected.includes(card.id);
              const blocked = !on && full;
              return (
                <button
                  key={card.id}
                  type="button"
                  data-key={card.id}
                  className={styles.chip}
                  aria-pressed={on}
                  aria-disabled={blocked || navigating || undefined}
                  title={blocked ? labels.compare.full : undefined}
                  onClick={() => {
                    if (!blocked) choose(card.id);
                  }}
                >
                  <span aria-hidden className={styles.mono}>{card.monogram}</span>
                  {card.name}
                </button>
              );
            })}
            </div>
          </ChipStrip>
          {selected.length < 2 && (
            <p className="text-tiny text-muted">
              {selected.length === 1 ? labels.compare.hintOne : labels.compare.hint}
            </p>
          )}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {spoken}
      </p>

      {shown.length >= 2 && (
        <section id="yan-yana" aria-labelledby="yan-yana-h" className={styles.compare}>
          <h3 id="yan-yana-h" className="mb-2 text-read font-bold text-strong">
            {labels.compare.title}
          </h3>
          <ScrollEdges
            className="scroll-x-hint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
            tabIndex={0}
            role="region"
            aria-label={labels.compare.region}
          >
            <div className={styles.cmpGrid} style={{ "--n": shown.length } as React.CSSProperties}>
              {shown.map((card) => (
                <div key={card.id} className={styles.cmpHead}>
                  <div className={styles.cmpName}>
                    <span aria-hidden className={styles.mono} data-size="sm">
                      {card.monogram}
                    </span>
                    <h4>{card.name}</h4>
                    <button
                      type="button"
                      className={styles.cmpRemove}
                      aria-label={labels.compare.remove.replace("{name}", card.name)}
                      onClick={() => choose(card.id)}
                    >
                      <X size={16} weight="bold" aria-hidden />
                    </button>
                  </div>
                  <LicenceBadge card={card} labels={labels} />
                  <div>
                    <span className={styles.feeLabel}>{labels.feeLabel.replace("{amount}", amount)}</span>
                    {feeBlock(card, true)}
                  </div>
                </div>
              ))}
              {(["commission", ...shown[0].rows.map((row) => row.column)] as BrokerColumn[]).map((column) => {
                const Icon = FEATURE_ICON[column];
                return (
                  <CompareRow key={column}>
                    <div className={styles.cmpLabel}>
                      <span>
                        <Icon size={14} weight="bold" aria-hidden />
                        {column === "commission" ? labels.tariff : labels.columns[column]}
                      </span>
                    </div>
                    {shown.map((card) => {
                      const row = column === "commission" ? card.tariff : card.rows.find((item) => item.column === column);
                      return (
                        <div key={card.id} className={styles.cmpCell}>
                          <div className="min-w-0">{row && <RowValue row={row} labels={labels} />}</div>
                          {row && <Refs refs={row.refs} />}
                        </div>
                      );
                    })}
                  </CompareRow>
                );
              })}
            </div>
          </ScrollEdges>
        </section>
      )}

      <ul className={styles.grid} aria-label={labels.title}>
        {order.map((id, index) => {
          const card = byId.get(id);
          if (!card) return null;
          const on = selected.includes(card.id);
          return (
            <motion.li key={card.id} layout="position" transition={CARD_MOTION} className="min-w-0">
              <article
                id={`kurum-${card.id}`}
                data-broker-card
                data-selected={on || undefined}
                aria-labelledby={`kurum-${card.id}-ad`}
                className={styles.card}
                style={{ "--i": index } as React.CSSProperties}
              >
                <div className={styles.foldHost}>
                <FoldToggle
                  id={`kurum-not-${card.id}`}
                  hiddenCount={1}
                  phone
                  more={labels.fold.more}
                  less={labels.fold.less}
                  mark={
                    card.caveat ? (
                      <span className={styles.caveat}>
                        <Info size={13} weight="bold" aria-hidden />
                        {labels.fold.caveat}
                      </span>
                    ) : undefined
                  }
                >
                <div className={styles.head}>
                  <span aria-hidden className={styles.mono}>
                    {card.monogram}
                  </span>
                  <div className="min-w-0">
                    <h3 id={`kurum-${card.id}-ad`} className={styles.name}>
                      {card.name}
                    </h3>
                    {card.channel && <span className={styles.sub}>{card.channel}</span>}
                    {card.counterparty && (
                      <span className={styles.sub}>
                        {labels.counterparty.replace("{name}", card.counterparty.name)}
                      </span>
                    )}
                  </div>
                  <div className={styles.badgeRow}>
                    <LicenceBadge card={card} labels={labels} />
                    <Refs refs={card.licenceRefs} row />
                    <span className={styles.pickSlot}>{pickButton(card)}</span>
                  </div>
                  {card.licenceNote && (
                    <div data-fold className={styles.badgeNoteWrap}>
                      <p className={styles.badgeNote}>{card.licenceNote}</p>
                    </div>
                  )}
                </div>

                <div className={styles.fee}>
                  <span className={styles.feeLabel}>{labels.feeLabel.replace("{amount}", amount)}</span>
                  {feeBlock(card, false)}
                  <div className={styles.tariff}>
                    <div className={styles.rowMain}>
                      <span className={styles.rowLabel}>{labels.tariff}</span>
                      <RowValue row={card.tariff} labels={labels} />
                    </div>
                    <Refs refs={card.tariff.refs} />
                  </div>
                </div>

                <ul className={styles.rows}>
                  {card.rows.map((row) => {
                    const Icon = FEATURE_ICON[row.column];
                    return (
                      <li key={row.column} className={styles.row}>
                        <span className={styles.rowIcon} aria-hidden>
                          <Icon size={18} />
                        </span>
                        <div className={styles.rowMain}>
                          <span className={styles.rowLabel}>{labels.columns[row.column]}</span>
                          <RowValue row={row} labels={labels} />
                        </div>
                        <Refs refs={row.refs} />
                      </li>
                    );
                  })}
                </ul>

                {/* Künye katlamanın İÇİNDE: telefonda okunduğu gün açık,
                    kaynak listesine giden bağlantı katlı (kaynak satırı). */}
                <div className={styles.foot}>
                  <span>{card.checked}</span>
                  <div data-fold>
                    <a href={`#kaynaklar-${card.id}`} className={styles.footLink}>
                      {labels.sourcesLink.replace("{n}", String(card.sourceCount))}
                      <ArrowDown size={12} weight="bold" aria-hidden />
                    </a>
                  </div>
                </div>
                </FoldToggle>
                </div>
              </article>
            </motion.li>
          );
        })}
      </ul>

      {/* Sıranın anlamı: geçerli sıranın künyesi, tutarıyla. Panelin
          içinde, hairline ile (CLAUDE.md ekran düzeni 6). */}
      <p className="max-w-3xl border-t border-line-soft pt-3 text-tiny leading-relaxed text-muted">
        {sort === "komisyon" ? labels.sortNote.komisyon.replace("{amount}", amount) : labels.sortNote.ad}
      </p>

      {selected.length >= 2 && (
        <button type="button" onClick={seeCompare} className={cn(styles.footLink, "self-start cursor-pointer")}>
          {labels.compare.see}
        </button>
      )}
    </div>
  );
}

/** Satır grubunu `display: contents` ile ızgaraya bırakır — erişilebilir rol "group". */
function CompareRow({ children }: { children: React.ReactNode }) {
  return (
    <div role="group" className="contents">
      {children}
    </div>
  );
}

function LicenceBadge({ card, labels }: { card: BrokerCardView; labels: BrokerCardsLabels }) {
  const Icon = card.licence === "foreign" ? GlobeHemisphereWest : ShieldCheck;
  return (
    <span className={styles.badge}>
      <Icon size={15} weight="bold" aria-hidden />
      {labels.licence[card.licence]}
    </span>
  );
}

/** Değer + durum işareti. ✓ var, ✗ yok, kesik halka belirtilmemiş; renk yok. */
function RowValue({ row, labels }: { row: CardRow; labels: BrokerCardsLabels }) {
  return (
    <>
      <span className={styles.rowValue} data-mark={row.mark}>
        {row.mark === "yes" && <CheckCircle size={17} weight="fill" aria-hidden />}
        {row.mark === "no" && <XCircle size={17} weight="bold" aria-hidden />}
        {row.mark === "unspecified" && <CircleDashed size={17} weight="bold" aria-hidden />}
        <span className={styles.valueText}>
          {row.mark === "unspecified" ? labels.unspecified : row.mark === "no" ? (row.value ?? labels.no) : row.value}
        </span>
      </span>
      {row.note && (
        <div data-fold>
          <span className={styles.rowNote}>{row.note}</span>
        </div>
      )}
    </>
  );
}

function Refs({ refs, row = false }: { refs: CardRef[]; row?: boolean }) {
  if (refs.length === 0) return <span aria-hidden />;
  /* Sarmalayıcı `data-fold`: telefonda kart katlıyken kaynak numaraları da
     katlı (FoldToggle). Stil iç öğede — katlama kuralı açılışta `display:
     revert` yazıyor ve bu, sarmalanmasa modülün flex'ini ezerdi. */
  return (
    <div data-fold>
      <span className={cn(styles.refs, row && styles.refsRow)}>
        {refs.map((ref) => (
          <a key={ref.n} data-ref href={ref.href} aria-label={ref.title} className={styles.ref}>
            {ref.n}
          </a>
        ))}
      </span>
    </div>
  );
}
