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
 * TEK DÜZEN, İKİ GENİŞLİK. Aynı satır telefonda kart (sembol ve değer üstte,
 * ağırlık çubuğu, iki getiri kutusu yan yana, künye), 900 pikselden itibaren
 * hizalı bir satır: her satır aynı `grid-template-columns`u taşıyor, başlık
 * satırı da — sütunlar tablo olmadan hizalı. Kaydırma yok, saklanan da yok.
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
};

/** Giriş kademesi: bundan sonraki satırlar aynı anda girer. */
const STAGGER_CAP = 12;

export function PositionsTable({ rows, manual }: { rows: PositionRow[]; manual: boolean }) {
  const { labels: L, locale, hidden, fresh, openEdit, remove, setExisting, notify } = useWorkbench();

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
      {/* Başlık yalnızca geniş ekranda: telefonda her kutu kendi etiketini
          taşıyor. Satırlarla aynı sütun şablonu. */}
      <div className={styles.posHead} aria-hidden>
        <span>{L.symbol}</span>
        <span>{L.weight}</span>
        <span>{L.value}</span>
        <span>{L.usdReturn}</span>
        <span>{L.tlReturn}</span>
        <span />
      </div>
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
              <div data-col="sym" className={styles.posSym}>
                <LogoTile symbol={row.symbol} logoUrl={row.logoUrl ?? null} size="md" />
                <span className="flex min-w-0 flex-col">
                  <Link href={`/hisse/${row.symbol}`} className={cn("numeral w-fit", styles.posTicker)}>
                    {row.symbol}
                  </Link>
                  {/* Ad KESİLMİYOR: telefonda sembol satırı kartın tam
                      genişliğini alıyor (değer alttaki satıra indi), ad
                      sığmazsa iki satıra iniyor; "Advanced Micro …" diye
                      kesilen ad bir şey söylemiyordu. */}
                  {row.name && <span className={styles.posName}>{row.name}</span>}
                </span>
              </div>

              <div data-col="value" className={styles.posValue}>
                <span className={cn("numeral", styles.posValueUsd)}>
                  {row.price === null ? <span className="text-muted">{L.noQuote}</span> : usd(row.valueUsd)}
                </span>
                <span className={cn("numeral", styles.posValueTl)}>{formatLira(row.valueTl, locale)}</span>
              </div>

              {/* AĞIRLIK BİR BÜYÜKLÜK: sayı portföy içindeki pay, çubuk en
                  büyük pozisyona göre (CLAUDE.md "karşılaştırılan her
                  büyüklük bir de çizgi"). Çubuğun rengi halkadaki dilimin
                  rengi. Fiyatı olmayanın ağırlığı yok. */}
              <div data-col="weight" className={styles.posWeight}>
                <span className={styles.posMobileLabel}>{L.weight}</span>
                <span className={cn("numeral", styles.posWeightPct)}>
                  {row.share === null ? NO_VALUE : formatPercentPlain(row.share, locale, 1)}
                </span>
                <span className={styles.weightBar} aria-hidden>
                  <span className={styles.weightFill} style={{ "--ratio": row.ratio } as CSSProperties} />
                </span>
              </div>

              {(
                [
                  { key: "usd", label: L.usdReturn, value: usd(row.pnlUsd, true), pct: row.pnlUsdPct, tone: row.pnlUsd },
                  { key: "tl", label: L.tlReturn, value: formatLira(row.pnlTl, locale, 2, true), pct: row.pnlTlPct, tone: row.pnlTl },
                ] as const
              ).map((cell) => (
                <div key={cell.key} data-col={cell.key} className={styles.posReturn} data-tone={directionOf(cell.tone)}>
                  <span className={styles.posMobileLabel}>{cell.label}</span>
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

              <div data-col="act" className={styles.rowActions}>
                {editing ? (
                  <>
                    <button
                      type="button"
                      aria-label={L.moveUp.replace("{symbol}", row.symbol)}
                      className={cn(styles.rowAction, styles.rowMove)}
                      onClick={() => move(row.id, -1)}
                      disabled={i === 0}
                    >
                      <CaretUp size={16} weight="bold" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={L.moveDown.replace("{symbol}", row.symbol)}
                      className={cn(styles.rowAction, styles.rowMove)}
                      onClick={() => move(row.id, 1)}
                      disabled={i === visibleRows.length - 1}
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

              {/* KÜNYE BİR IZGARA (2 Ekim). Düz bir satırdı ("14,88 Adet ·
                  Maliyet … · Kur Katkısı …") ve telefonda son öğe tek
                  başına alt satıra düşüyordu. Şimdi her ölçü kendi
                  hücresinde, etiket üstte: telefonda üç sütun, geniş
                  ekranda altı — hiçbir değer satır ortasında kırılmıyor. */}
              <dl data-col="detail" className={styles.posFacts}>
                <div>
                  <dt>{L.quantity}</dt>
                  <dd className="numeral">{quantityText.format(row.quantity)}</dd>
                </div>
                <div>
                  <dt>{L.costShort}</dt>
                  <dd className="numeral">{usd(row.costUsd)}</dd>
                </div>
                <div>
                  <dt>{L.price}</dt>
                  <dd className="numeral">{row.price === null ? NO_VALUE : usd(row.price)}</dd>
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
