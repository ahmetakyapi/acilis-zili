"use client";

import { Suspense, use, useState, type CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, TimingChip, type LogoTileSize, type TimingTone } from "@/components/ui/primitives";
import type { KarneMark, TileTier } from "@/lib/earnings-horizon";
import type { WeekLane } from "@/lib/earnings-week";
import { NO_VALUE } from "@/lib/utils";
import styles from "./EarningsHorizon.module.css";

/**
 * Ufkun etkileşimli katmanı: ızgara + okuma satırı. Veri sunucuda
 * biçimlenip geliyor (`EarningsHorizon`); burada yalnız SEÇİM durumu var.
 *
 * Karo bir düğme: fareyle üstüne gelmek, klavyeyle odaklamak ya da
 * dokunmak onu seçiyor ve alttaki okuma satırı (`aria-live`) o şirketin
 * gelir ve EPS beklentisini, piyasa değerini ve karnesini yazıyor. Balon
 * değil satır: telefonda karo ekranın kenarındayken balon taşıyordu ve
 * dokunmatikte "üstüne gelme" yok; satır her iki durumda aynı yerde.
 * Seçim sayfayı kaydırmıyor (`aria-pressed` değişiyor, odak karoda).
 *
 * Karne bir SÖZ (`use`): sayfa sağlayıcıyı beklemeden basılıyor, her
 * karonun çentik satırı kendi `Suspense`inde aynı yükseklikte bir yedekle
 * duruyor ve veri gelince yerine oturuyor.
 */

export type HorizonTile = {
  symbol: string;
  name: string;
  logoUrl: string | null;
  /** Kenar oranı 0…1 — alan piyasa değeriyle orantılı (`tileScale`). */
  scale: number;
  /** Çizilen boy: büyük 56, taban 40 piksel (`tileTierOf`). */
  tier: TileTier;
  capText: string | null;
  revenueText: string | null;
  epsText: string | null;
  epsActualText: string | null;
  surprise: "beat" | "miss" | "inline" | null;
  whenText: string;
  lane: WeekLane;
  laneText: string;
  watched: boolean;
  href: string;
  analysisHref: string | null;
  label: string;
};

export type HorizonDay = {
  date: string;
  weekday: string;
  /** "Çar" — telefondaki gün seçicinin adı. */
  short: string;
  /** Günün TÜM açıklayanları (karolar yalnız kayda değerler). */
  count: number;
  dayNumber: string;
  month: string;
  state: "past" | "today" | "ahead";
  closed: boolean;
  countText: string;
  /** Günün tüm açıklayanları / haftanın en kalabalık günü. */
  density: number;
  lanes: Record<WeekLane, HorizonTile[]>;
  /** Hücreye sığmayan şirket sayısı (`capCell`). */
  more: Record<WeekLane, number>;
  /** "+N" çipinin gittiği yer: o günün tam listesi. */
  moreHref: string;
  /** Çipin ekran okuyucu etiketi; `{count}` çizimde dolar. */
  moreLabel: string;
};

export type HorizonLane = {
  key: WeekLane;
  title: string;
  tone: TimingTone;
  clock: string | null;
  clockAlt: string | null;
};

type Labels = {
  revenueEstimate: string;
  epsEstimate: string;
  marketCap: string;
  reported: string;
  beatRecord: string;
  beatRecordLine: string;
  beatRecordAll: string;
  beatRecordNone: string;
  beatCount: string;
  noKarne: string;
  karneLoading: string;
  companyPage: string;
  analysis: string;
  marketClosed: string;
  emptyLane: string;
  today: string;
  hint: string;
  pickDay: string;
  more: string;
};

type Karne = Promise<Record<string, KarneMark[]>>;

/* Logo karonun ~%60'ı: büyük karoda 32, tabanda 26 piksel. Karonun alt
   şeridinde karne çentikleri duruyor, logo onlara binmesin. */
const LOGO_SIZE: Record<TileTier, LogoTileSize> = { big: "md", base: "sm" };

const READOUT_ID = "bilanco-ufku-ayrinti";

export function HorizonGrid({
  days,
  lanes,
  karne,
  initial,
  initialDay,
  labels,
}: {
  days: HorizonDay[];
  lanes: HorizonLane[];
  karne: Karne;
  initial: string | null;
  /** Telefonda açık gün — cümlenin andığı zirve günü. */
  initialDay: string | null;
  labels: Labels;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  const [activeDay, setActiveDay] = useState<string | null>(initialDay ?? days[0]?.date ?? null);
  const all = days.flatMap((day) => [...day.lanes.bmo, ...day.lanes.amc, ...day.lanes.other]);
  const current = all.find((tile) => tile.symbol === selected) ?? all[0] ?? null;
  /* Giriş kademesi haftanın okuma sırasıyla: gün gün, şerit şerit. */
  const order = new Map(all.map((tile, index) => [tile.symbol, index]));

  /* TELEFONDA TEK GÜN (25 Ekim). Beş gün alt alta 390'da 2.679 piksel
     tutuyordu (ölçüldü) — kart duvarının yerine gelen görsel kendisi bir
     duvar olmuştu. Telefonda haftanın şekli gün seçicide (gün başına sayı
     ve yoğunluk çizgisi) ve altında seçili günün iki penceresi; 1180
     pikselden geniş ekranda seçici gizli, beş gün yan yana. Gün değişince o günün en büyük
     karosu seçiliyor ki okuma satırı başka günü anlatmasın. */
  const pickDay = (day: HorizonDay) => {
    setActiveDay(day.date);
    const first = [...day.lanes.bmo, ...day.lanes.amc, ...day.lanes.other].sort((a, b) => b.scale - a.scale)[0];
    if (first) setSelected(first.symbol);
  };

  return (
    <>
      <div className={styles.picker} role="group" aria-label={labels.pickDay}>
        {days.map((day) => (
          <button
            key={day.date}
            type="button"
            className={styles.pick}
            aria-pressed={activeDay === day.date}
            data-state={day.state}
            onClick={() => pickDay(day)}
          >
            <span className={styles.pickName}>{day.short}</span>
            <span className={`figure ${styles.pickNumber}`}>{day.dayNumber}</span>
            <span className={`figure ${styles.pickCount}`}>{day.closed ? NO_VALUE : day.count}</span>
            <span className={styles.density} aria-hidden>
              <span style={{ "--ratio": day.density } as CSSProperties} />
            </span>
          </button>
        ))}
      </div>
      <div className={styles.grid} style={{ "--lanes": lanes.length } as CSSProperties}>
        {/* Sol eksen yalnız geniş ekranda; her hücrede aynı ad dar ekranda
            görünür, geniş ekranda ekran okuyucuya kalır. */}
        <div className={styles.axis} aria-hidden>
          <span />
          {lanes.map((lane) => (
            <span key={lane.key} className={styles.axisLane} data-lane={lane.key}>
              <TimingChip tone={lane.tone} size="sm">
                {lane.title}
              </TimingChip>
              {lane.clock && (
                <span className={styles.axisClock}>
                  <span className="figure">{lane.clock}</span>
                  <span className={`figure ${styles.axisClockAlt}`}>{lane.clockAlt}</span>
                </span>
              )}
            </span>
          ))}
        </div>

        {days.map((day) => (
          <section
            key={day.date}
            className={styles.day}
            data-state={day.state}
            data-active={activeDay === day.date || undefined}
            aria-labelledby={`ufuk-${day.date}`}
          >
            {/* GÜN BAŞLIĞI TEK SATIR (25 Ekim, ikinci tur): gün numarası ve
                adı solda, günün tüm açıklayanları sağda, altında yoğunluk
                çizgisi. Ay adı panelin künyesinde ("26–30 Ekim 2026"); iki
                satırlık başlık sütun başına 24 piksel tutuyordu. */}
            <header className={styles.dayHead}>
              <h3 id={`ufuk-${day.date}`} className={styles.dayName}>
                <span className={`figure ${styles.dayNumber}`}>{day.dayNumber}</span>
                <span className={styles.dayWeekday}>{day.weekday}</span>
                {day.state === "today" && <span className={styles.todayTag}>{labels.today}</span>}
              </h3>
              <p className={`figure ${styles.dayCount}`}>{day.closed ? NO_VALUE : day.countText}</p>
              {/* Günün yoğunluğu bir UZUNLUK: en kalabalık gün tam. */}
              <span className={styles.density} aria-hidden>
                <span style={{ "--ratio": day.density } as CSSProperties} />
              </span>
            </header>
            {day.closed ? (
              <p className={styles.closed}>{labels.marketClosed}</p>
            ) : (
              lanes.map((lane) => {
                const tiles = day.lanes[lane.key];
                const more = day.more[lane.key];
                return (
                  <div key={lane.key} className={styles.lane} data-lane={lane.key} data-empty={tiles.length === 0 || undefined}>
                    <p className={styles.laneHead}>
                      <TimingChip tone={lane.tone} size="sm">
                        {lane.title}
                      </TimingChip>
                    </p>
                    {tiles.length > 0 ? (
                      <ul className={styles.tiles}>
                        {tiles.map((tile) => (
                          <Tile
                            key={tile.symbol}
                            tile={tile}
                            order={order.get(tile.symbol) ?? 0}
                            pressed={current?.symbol === tile.symbol}
                            onSelect={() => setSelected(tile.symbol)}
                            karne={karne}
                          />
                        ))}
                        {more > 0 && (
                          <li className={styles.tileItem} data-tier="base" style={{ "--i": order.size } as CSSProperties}>
                            {day.moreHref.startsWith("#") ? (
                              <a href={day.moreHref} className={`tap-44 ${styles.more}`} aria-label={day.moreLabel.replace("{count}", String(more))}>
                                {labels.more.replace("{count}", String(more))}
                              </a>
                            ) : (
                              <Link href={day.moreHref} prefetch={false} className={`tap-44 ${styles.more}`} aria-label={day.moreLabel.replace("{count}", String(more))}>
                                {labels.more.replace("{count}", String(more))}
                              </Link>
                            )}
                          </li>
                        )}
                      </ul>
                    ) : (
                      <span className={styles.laneEmpty}>{labels.emptyLane}</span>
                    )}
                  </div>
                );
              })
            )}
          </section>
        ))}
      </div>

      <Readout tile={current} karne={karne} labels={labels} />
    </>
  );
}

function Tile({
  tile,
  order,
  pressed,
  onSelect,
  karne,
}: {
  tile: HorizonTile;
  order: number;
  pressed: boolean;
  onSelect: () => void;
  karne: Karne;
}) {
  return (
    <li className={styles.tileItem} data-tier={tile.tier} style={{ "--i": order } as CSSProperties}>
      <button
        type="button"
        className={`tap-44 ${styles.tile}`}
        aria-pressed={pressed}
        aria-label={tile.label}
        aria-controls={READOUT_ID}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") onSelect();
        }}
        onFocus={onSelect}
        onClick={onSelect}
      >
        <LogoTile symbol={tile.symbol} logoUrl={tile.logoUrl} size={LOGO_SIZE[tile.tier]} />
        {tile.watched && (
          <span aria-hidden className={styles.star}>
            ★
          </span>
        )}
        {/* Açıklanmış bilançoda yön glifi (biçim + renk): beklentiye göre. */}
        {tile.surprise && (
          <span aria-hidden className={styles.result} data-dir={tile.surprise}>
            {tile.surprise === "beat" ? "▲" : tile.surprise === "miss" ? "▼" : "="}
          </span>
        )}
        {/* KARNE KARONUN İÇİNDE (25 Ekim, ikinci tur): alt kenarda ince
            şerit. Karonun altında ayrı satırdı ve her karoya 7 piksel
            ekliyordu. */}
        <Suspense fallback={<Notches marks={null} />}>
          <TileNotches karne={karne} symbol={tile.symbol} />
        </Suspense>
      </button>
      <span aria-hidden className={styles.tileSymbol}>
        {tile.symbol}
      </span>
    </li>
  );
}

function TileNotches({ karne, symbol }: { karne: Karne; symbol: string }) {
  const marks = use(karne)[symbol] ?? [];
  return <Notches marks={marks} />;
}

/** Dört çentik, eskiden yeniye; dolu = beklenti aşıldı. `null` = yükleniyor. */
function Notches({ marks, large = false }: { marks: KarneMark[] | null; large?: boolean }) {
  const SLOTS = 4;
  return (
    <span aria-hidden className={styles.notches} data-large={large || undefined} data-pending={marks === null || undefined}>
      {marks === null
        ? Array.from({ length: SLOTS }, (_, index) => <i key={index} />)
        : marks.map((mark, index) => <i key={index} data-beat={mark === "beat" || undefined} />)}
    </span>
  );
}

function ReadoutKarne({ karne, symbol, labels }: { karne: Karne; symbol: string; labels: Labels }) {
  const marks = use(karne)[symbol] ?? [];
  if (marks.length === 0) return <p className={styles.readoutKarneText}>{labels.noKarne}</p>;
  const beat = marks.filter((mark) => mark === "beat").length;
  const sentence = (beat === marks.length ? labels.beatRecordAll : beat === 0 ? labels.beatRecordNone : labels.beatRecordLine)
    .replace("{total}", String(marks.length))
    .replace("{beat}", String(beat));
  return (
    <>
      <p className={styles.readoutKarneCount}>
        {labels.beatCount.replace("{beat}", String(beat)).replace("{total}", String(marks.length))}
      </p>
      <Notches marks={marks} large />
      <p className={styles.readoutKarneText}>{sentence}</p>
    </>
  );
}

function Readout({ tile, karne, labels }: { tile: HorizonTile | null; karne: Karne; labels: Labels }) {
  return (
    <div id={READOUT_ID} className={styles.readout} aria-live="polite">
      {tile ? (
        <>
          <div className={styles.readoutWho}>
            <LogoTile symbol={tile.symbol} logoUrl={tile.logoUrl} size="md" />
            <div className="min-w-0">
              <p className={styles.readoutSymbol}>
                {tile.symbol}
                <span className={styles.readoutName}>{tile.name}</span>
              </p>
              <p className={styles.readoutWhen}>
                {tile.whenText} · {tile.laneText}
              </p>
            </div>
          </div>
          <dl className={styles.readoutFacts}>
            <div>
              <dt>{labels.revenueEstimate}</dt>
              <dd className="numeral">{tile.revenueText ?? NO_VALUE}</dd>
            </div>
            <div>
              <dt>{labels.epsEstimate}</dt>
              <dd className="numeral">{tile.epsText ?? NO_VALUE}</dd>
            </div>
            <div>
              <dt>{labels.marketCap}</dt>
              <dd className="numeral">{tile.capText ?? NO_VALUE}</dd>
            </div>
            {/* Açıklanmışsa gerçekleşen EPS, beklentiye göre yön rengiyle
                ve glifle (renk tek taşıyıcı değil). */}
            {tile.epsActualText && (
              <div>
                <dt>{labels.reported}</dt>
                <dd className="numeral" data-dir={tile.surprise ?? undefined}>
                  {tile.surprise === "beat" ? "▲ " : tile.surprise === "miss" ? "▼ " : ""}
                  {tile.epsActualText}
                </dd>
              </div>
            )}
          </dl>
          <div className={styles.readoutKarne}>
            <p className={styles.readoutKarneLabel}>{labels.beatRecord}</p>
            <Suspense
              fallback={
                <>
                  <p className={styles.readoutKarneCount}>{labels.karneLoading}</p>
                  <Notches marks={null} large />
                </>
              }
            >
              <ReadoutKarne karne={karne} symbol={tile.symbol} labels={labels} />
            </Suspense>
          </div>
          <div className={styles.readoutLinks}>
            <Link href={tile.href} prefetch={false} className={styles.readoutLink}>
              {labels.companyPage}
              <ArrowUpRight size={13} weight="bold" aria-hidden />
            </Link>
            {tile.analysisHref && (
              <Link href={tile.analysisHref} prefetch={false} className={styles.readoutLink}>
                {labels.analysis}
                <ArrowUpRight size={13} weight="bold" aria-hidden />
              </Link>
            )}
          </div>
        </>
      ) : (
        <p className={styles.readoutHint}>{labels.hint}</p>
      )}
    </div>
  );
}
