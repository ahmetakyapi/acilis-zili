"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowsDownUp, CaretDown, CaretUp, PencilSimple, Trash } from "@phosphor-icons/react";
import { savePortfolioOrderAction } from "@/app/actions/portfolio";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { formatIsoDate, formatLira } from "@/lib/fx";
import { cn, directionOf, formatPercent, formatPercentPlain, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./Portfolio.module.css";
import { useWorkbench } from "./PortfolioWorkbench";
import type { ComposerPosition } from "./PositionComposer";

/**
 * POZİSYON LİSTESİ — istemcide, çünkü satırlar yaşıyor: düzeltme penceresini
 * açıyor, silinince kayarak çıkıyor, eklenince kayarak girip bir an
 * vurgulanıyor. Sayıların hepsi SUNUCUDA hesaplanıp geliyor
 * (`loadPortfolio`); burada hiçbir hesap yok, yalnızca biçim.
 *
 * TABLO DEĞİL, LİSTE (2 Ekim). On sütunlu bir tablo telefonda 980 piksel
 * tabanla kayıyordu ve ilk ekranda yalnızca sembol, ağırlık ve adet
 * görünüyordu — okuyucunun asıl sorusu (ne kadar kazandım) sağa kaydırmanın
 * sonundaydı. Sahibi "kabul edilemez" dedi ve haklıydı. Satır artık beş
 * soru: hangi hisse, ne kadar ağır, ne ediyor, dolarda ne getirdi, lirada ne
 * getirdi. İkincil sayılar (adet, maliyet, fiyat, alış kuru, kurun katkısı)
 * alt satırda düz bir künye.
 *
 * TEK DÜZEN, İKİ GENİŞLİK. 900 pikselden itibaren kartlar hizalı satırlara
 * dönüyordu; 3 Ekim'de sahibi daha görsel kartlar istedi ve satır düzeni
 * kalktı: her genişlikte kart, telefonda tek sütun, 760'tan itibaren iki.
 * Gerekçe ve ölçüler `Portfolio.module.css` → "Pozisyon kartları".
 */

export type PositionRow = ComposerPosition & {
  price: number | null;
  valueUsd: number | null;
  pnlUsd: number | null;
  pnlUsdPct: number | null;
  costTl: number | null;
  valueTl: number | null;
  pnlTl: number | null;
  pnlTlPct: number | null;
  /** Portföy içindeki pay, yüzde. */
  share: number | null;
  /** En büyük pozisyona oran — ağırlık çubuğu. */
  ratio: number;
  rate: { rate: number; bulletin: string } | null;
  /** Lira K/Z'nin kurdan gelen kısmı: lira K/Z − dolar K/Z × bugünün kuru. */
  fxTl: number | null;
  /** Halkadaki dilimin rengi (CSS değişkeni) — kenar şeridi ve ağırlık çubuğu. */
  accent: string;
  /** Getiri çubuklarının ortak ölçeği: listedeki en büyük mutlak yüzde. */
  returnScale: number;
  /** Bu seanstaki değişim — kotasyon seansa ait değilse null (lib/portfolio.ts). */
  dayChangeUsd: number | null;
  dayChangePct: number | null;
  /** Seansın adı ("Seans İçi", "Kapanış Sonrası"…). */
  dayLabel: string | null;
};

/** Giriş kademesi: bundan sonraki satırlar aynı anda girer. */
const STAGGER_CAP = 12;
/** Ağırlık halkası (görüş kutusu 52). */
const WEIGHT_R = 22;
const WEIGHT_C = 2 * Math.PI * WEIGHT_R;

/**
 * Maliyetten bugüne yol: maliyet halka, fiyat dolu nokta, arası kazançta
 * yeşil, kayıpta kırmızı.
 *
 * ÖLÇEK SIFIRDAN BAŞLIYOR. İlk sürümde ölçek iki ucun dörtte biri kadar
 * dışına taşıyordu ve sonuç her kartta AYNI resimdi: noktalar hep altıda
 * bir ile altıda beşte duruyordu, %7'lik MU ile %40'lık SHAZ aynı uzunlukta
 * bir yol çiziyordu (3 Ekim, 1366'da görüldü). Sıfırdan büyük uca (%8 pay)
 * çizilince yolun uzunluğu hareketin yüzdesi oluyor ve kartlar arasında
 * karşılaştırılabiliyor.
 */
function Journey({
  cost,
  price,
  costLabel,
  priceLabel,
  usd,
}: {
  cost: number;
  price: number;
  costLabel: string;
  priceLabel: string;
  usd: (value: number | null) => string;
}) {
  const lo = Math.min(cost, price);
  const hi = Math.max(cost, price);
  const top = hi * 1.08 || 1;
  const at = (value: number) => Math.max(0, value) / top;
  const tone = price > cost ? "up" : price < cost ? "down" : "flat";
  return (
    <div className={styles.journey} data-tone={tone}>
      <span className={styles.journeyTrack} aria-hidden>
        <span className={styles.journeyFill} style={{ "--from": at(lo), "--to": at(hi) } as CSSProperties} />
        <span className={styles.journeyDot} data-kind="cost" style={{ "--at": at(cost) } as CSSProperties} />
        <span className={styles.journeyDot} data-kind="price" style={{ "--at": at(price) } as CSSProperties} />
      </span>
      {/* Uçların etiketleri noktaların sırasıyla: kayıpta fiyat solda. */}
      <span className={styles.journeyEnds}>
        {(price < cost
          ? [
              [priceLabel, price],
              [costLabel, cost],
            ]
          : [
              [costLabel, cost],
              [priceLabel, price],
            ]
        ).map(([label, value]) => (
          <span key={label}>
            {label}
            <b className="numeral">{usd(value as number)}</b>
          </span>
        ))}
      </span>
    </div>
  );
}

export function PositionsTable({ rows, manual }: { rows: PositionRow[]; manual: boolean }) {
  const { labels: L, locale, hidden, fresh, openEdit, openSell, sales, remove, setExisting, notify } = useWorkbench();

  /* ELLE SIRA (2 Ekim). Sunucu satırları zaten doğru sırayla gönderiyor
     (`orderPositions`); burada yalnızca düzenleme sırasındaki yerel sıra
     tutuluyor. Oklar anında taşıyor, "Bitti" bir kez kaydediyor — her ok
     basışında sunucuya gitmek beş taşımada beş yazma olurdu. Düzenleme
     dışında yerel sıra sunucudan gelenle eşitleniyor (ekleme, silme). */
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<string[]>(() => rows.map((row) => row.id));
  const [isManual, setIsManual] = useState(manual);
  const [pending, startTransition] = useTransition();
  const startOrder = useRef<string[]>([]);
  /* Sunucudan yeni satır listesi gelince (ekleme, silme, revalidate) yerel
     sıra RENDER SIRASINDA eşitleniyor — effect içinde setState bir tur geç
     kalıp listeyi bir kare eski sırayla çizerdi. Düzenleme sürerken
     okuyucunun sırası korunuyor. */
  const rowsKey = `${rows.map((row) => row.id).join()}|${manual}`;
  const [syncedKey, setSyncedKey] = useState(rowsKey);
  if (!editing && syncedKey !== rowsKey) {
    setSyncedKey(rowsKey);
    setOrder(rows.map((row) => row.id));
    setIsManual(manual);
  }

  const save = (ids: string[] | null) =>
    startTransition(async () => {
      const result = await savePortfolioOrderAction(ids);
      if (result.status === "error") notify({ message: L.sortFailed, tone: "error" });
    });
  const move = (id: string, step: -1 | 1) =>
    setOrder((current) => {
      const index = current.indexOf(id);
      const target = index + step;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const finish = () => {
    setEditing(false);
    if (order.join() !== startOrder.current.join()) {
      setIsManual(true);
      save(order);
    }
  };
  const reset = () => {
    /* Varsayılan sıra yerelde de hemen kuruluyor; sunucu aynı sırayı
       revalidate ile geri gönderiyor, liste zıplamıyor. */
    const byValue = [...rows].sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1)).map((row) => row.id);
    setOrder(byValue);
    setEditing(false);
    setIsManual(false);
    save(null);
  };

  /* SÖKÜLÜNCE BOŞALT (28 Eylül denetimi). Liste yalnızca tablo varken
     yazılıyordu; portföy boşalınca (içe aktarmayı "Geri Al", son satırı
     silmek) tablo sökülüyor ve içe aktarma SON listeyle çalışıyordu: aynı
     ekstre yeniden yüklendiğinde her lot "Zaten Ekli" görünüyor, tavan
     hesabı da eski sayıyla yapılıyordu. */
  useEffect(() => {
    setExisting(rows.map((row) => ({ symbol: row.symbol, quantity: row.quantity, costUsd: row.costUsd, boughtAt: row.boughtAt })));
    return () => setExisting([]);
  }, [rows, setExisting]);

  const usd = (value: number | null, signed = false) =>
    value === null ? NO_VALUE : `${signed && value > 0 ? "+" : ""}${formatPrice(value, locale, { currency: true })}`;
  const quantityText = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 8 });
  const rank = new Map(order.map((id, index) => [id, index]));
  const visibleRows = rows
    .filter((row) => !hidden.has(row.id))
    .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));

  return (
    <div className={styles.posList} data-editing={editing || undefined}>
      {/* Sıra şeridi: hangi sıranın geçerli olduğu ve tek denetim. Tek
          pozisyonda sıralanacak bir şey yok, şerit basılmıyor. */}
      {rows.length > 1 && (
        <div className={styles.sortBar}>
          <p className={styles.sortState}>
            <ArrowsDownUp size={14} weight="bold" aria-hidden />
            {editing ? L.sortHint : isManual ? L.sortManual : L.sortDefault}
          </p>
          <div className={styles.sortActions}>
            {editing ? (
              <>
                <button type="button" className={styles.sortButton} onClick={reset} disabled={pending}>
                  {L.sortReset}
                </button>
                <button type="button" className={cn(styles.sortButton, styles.sortPrimary)} onClick={finish} disabled={pending}>
                  {L.sortDone}
                </button>
              </>
            ) : (
              <>
                {isManual && (
                  <button type="button" className={styles.sortButton} onClick={reset} disabled={pending}>
                    {L.sortReset}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.sortButton}
                  onClick={() => {
                    startOrder.current = order;
                    setEditing(true);
                  }}
                  disabled={pending}
                >
                  {L.sortEdit}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <ul className={styles.rows} aria-label={L.positionsTitle}>
        <AnimatePresence initial={false}>
          {visibleRows.map((row, i) => (
            <motion.li
              key={row.id}
              layout="position"
              data-pos-row
              className={styles.posRow}
              data-fresh={fresh.has(row.id) || undefined}
              style={{ "--i": Math.min(i, STAGGER_CAP), "--accent": row.accent } as CSSProperties}
              exit={{ opacity: 0, x: -16, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
            >
              <div className={styles.posTop}>
                <LogoTile symbol={row.symbol} logoUrl={row.logoUrl ?? null} size="md" />
                <span className={styles.posSym}>
                  <Link href={`/hisse/${row.symbol}`} className={cn("numeral", styles.posTicker)}>
                    {row.symbol}
                  </Link>
                  {/* Ad KESİLMİYOR: sığmazsa iki satıra iniyor; "Advanced
                      Micro …" diye kesilen ad bir şey söylemiyordu. */}
                  {row.name && <span className={styles.posName}>{row.name}</span>}
                  {/* NOT GÖRÜNÜYOR. Ekleme penceresi "Not Ekle" diyor ve not
                      kaydediliyordu ama kartta hiçbir yerde basılmıyordu:
                      okuyucu notu ancak Düzenle'yi açınca görüyordu (8 Ekim
                      denetimi). Not bir künye — adın altında, soluk, tek
                      satırda kırpılı; tamamı `title`da. */}
                  {row.note && <span className={styles.posNote} title={row.note}>{row.note}</span>}
                </span>
                {/* AĞIRLIK BİR BÜYÜKLÜK: halka portföy içindeki pay kadar
                    dolu, rengi büyük halkadaki dilimin rengi. Fiyatı
                    olmayanın ağırlığı yok. */}
                <span
                  className={styles.posWeight}
                  role="img"
                  aria-label={`${L.weight} ${row.share === null ? NO_VALUE : formatPercentPlain(row.share, locale, 1)}`}
                >
                  <svg viewBox="0 0 52 52" aria-hidden>
                    <circle className={styles.posWeightTrack} cx="26" cy="26" r={WEIGHT_R} />
                    {row.share !== null && row.share > 0 && (
                      <circle
                        className={styles.posWeightArc}
                        cx="26"
                        cy="26"
                        r={WEIGHT_R}
                        strokeDasharray={`${(WEIGHT_C * Math.min(row.share, 100)) / 100} ${WEIGHT_C}`}
                      />
                    )}
                  </svg>
                  <span className={cn("numeral", styles.posWeightPct)} aria-hidden>
                    {row.share === null ? NO_VALUE : formatPercentPlain(row.share, locale, row.share >= 10 ? 0 : 1)}
                  </span>
                </span>
                <div className={styles.rowActions}>
                  {editing ? (
                    <>
                      <button
                        type="button"
                        aria-label={L.moveUp.replace("{symbol}", row.symbol)}
                        className={cn(styles.rowAction, styles.rowMove)}
                        onClick={() => {
                          if (i === 0) return;
                          move(row.id, -1);
                        }}
                        aria-disabled={i === 0}
                      >
                        <CaretUp size={16} weight="bold" aria-hidden />
                      </button>
                      <button
                        type="button"
                        aria-label={L.moveDown.replace("{symbol}", row.symbol)}
                        className={cn(styles.rowAction, styles.rowMove)}
                        onClick={() => {
                          if (i === visibleRows.length - 1) return;
                          move(row.id, 1);
                        }}
                        aria-disabled={i === visibleRows.length - 1}
                      >
                        <CaretDown size={16} weight="bold" aria-hidden />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-label={L.editAria.replace("{symbol}", row.symbol)}
                        className={styles.rowAction}
                        onClick={() => openEdit(row)}
                      >
                        <PencilSimple size={16} weight="duotone" aria-hidden />
                      </button>
                      {/* SAT (9 Ekim) — satış FIFO ile sembole yapılıyor
                          (SellComposer); düğme her partide aynı pencereyi açar. */}
                      {openSell && sales && (
                        <button
                          type="button"
                          aria-label={sales.sellAria.replace("{symbol}", row.symbol)}
                          title={sales.sellAria.replace("{symbol}", row.symbol)}
                          className={cn(styles.rowAction, styles.rowSell)}
                          onClick={() => openSell(row)}
                        >
                          {sales.sell}
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={L.removeAria.replace("{symbol}", row.symbol)}
                        className={cn(styles.rowAction, styles.rowActionDanger)}
                        onClick={() => remove(row)}
                      >
                        <Trash size={16} weight="duotone" aria-hidden />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.posValue}>
                <span className={styles.posLabel}>{L.value}</span>
                <span className={cn("numeral", styles.posValueUsd)}>
                  {row.price === null ? <span className="text-muted">{L.noQuote}</span> : usd(row.valueUsd)}
                </span>
                <span className={cn("numeral", styles.posValueTl)}>{formatLira(row.valueTl, locale)}</span>
                {row.dayChangeUsd !== null && row.dayLabel && (
                  <span className={cn("numeral", styles.posDay)} data-tone={directionOf(row.dayChangeUsd)}>
                    {row.dayLabel} · {usd(row.dayChangeUsd, true)} · {formatPercent(row.dayChangePct, locale)}
                  </span>
                )}
              </div>

              {row.price !== null && <Journey cost={row.costUsd} price={row.price} costLabel={L.costShort} priceLabel={L.price} usd={usd} />}

              <div className={styles.posReturns}>
                {(
                  [
                    { key: "usd", label: L.usdReturn, value: usd(row.pnlUsd, true), pct: row.pnlUsdPct, tone: row.pnlUsd },
                    { key: "tl", label: L.tlReturn, value: formatLira(row.pnlTl, locale, 2, true), pct: row.pnlTlPct, tone: row.pnlTl },
                  ] as const
                ).map((cell) => (
                  <div key={cell.key} className={styles.posReturn} data-tone={directionOf(cell.tone)}>
                    <span className={styles.posLabel}>{cell.label}</span>
                    <span className={cn("numeral", styles.posReturnValue)}>{cell.value}</span>
                    <span className={styles.posReturnFoot}>
                      <span className={cn("numeral", styles.posReturnPct)}>{formatPercent(cell.pct, locale)}</span>
                      {/* İki getiri AYNI ölçekte: listedeki en büyük mutlak
                          yüzde tam boy. Dolar ile lira çubuğu yan yana
                          durunca kurun payı uzunluk farkı olarak okunuyor. */}
                      {cell.pct !== null && row.returnScale > 0 && (
                        <span className={styles.retBar} aria-hidden>
                          <span style={{ "--r": Math.min(1, Math.abs(cell.pct) / row.returnScale) } as CSSProperties} />
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <dl className={styles.posFacts}>
                <div>
                  <dt>{L.quantity}</dt>
                  <dd className="numeral">{quantityText.format(row.quantity)}</dd>
                </div>
                <div>
                  <dt>{L.boughtAt}</dt>
                  <dd className="numeral">{formatIsoDate(row.boughtAt, locale)}</dd>
                </div>
                <div>
                  <dt>{L.buyRateShort}</dt>
                  <dd className="numeral">{row.rate ? `${formatPrice(row.rate.rate, locale, { digits: 2 })} ₺` : NO_VALUE}</dd>
                </div>
                <div>
                  <dt>{L.fxPart}</dt>
                  <dd className="numeral" data-tone={directionOf(row.fxTl)}>
                    {row.fxTl === null ? NO_VALUE : formatLira(row.fxTl, locale, 2, true)}
                  </dd>
                </div>
              </dl>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
