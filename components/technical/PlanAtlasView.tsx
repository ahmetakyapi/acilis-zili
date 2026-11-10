"use client";

import { ArrowUpRight, CaretDown } from "@phosphor-icons/react";
import { useState } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { VerdictPill } from "@/components/ui/VerdictPill";
import type { VerdictKey } from "@/lib/analysis";
import type { AtlasGeometry } from "@/lib/technical-visuals";
import { cn } from "@/lib/utils";
import styles from "./TechnicalVisuals.module.css";

export type AtlasRowView = {
  symbol: string;
  company: string | null;
  verdict: VerdictKey;
  stance: string;
  href: string;
  geometry: AtlasGeometry | null;
  /** Kotasyon yok, fiyat analiz anından: çubuk içi boş (yalnız kenar). */
  fromSnapshot: boolean;
  priceText: string;
  priceLabel: string;
  positionText: string | null;
  distance: string;
  distanceTone?: "up" | "down";
  facts: { label: string; value: string; tone?: "up" | "down" }[];
  /** Kartın gerekçe cümlesi (kayıttan) ve dili. */
  headline: string;
  headlineLang: string;
};

export type AtlasGroup = {
  verdict: VerdictKey;
  label: string;
  count: number;
  axisStart: string;
  axisEnd: string;
  column: string;
  note: string | null;
  rows: AtlasRowView[];
};

type Copy = {
  label: string;
  scaleNote: string;
  legendZone: string;
  legendPrice: string;
  legendSnapshot: string;
  legendStop: string;
  legendTarget: string;
  noLevels: string;
  noPlan: string;
  details: string;
  openPlan: string;
  hint: string;
  thesis: string;
};

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

/** Satırda çizilen çentikler: eksenin iki ucu. Gerisi ayrıntıda (gerekçe çubuğun yorumunda). */
const MAIN_TICKS: ReadonlySet<string> = new Set(["stop", "target", "support", "resistance", "sell"]);

/**
 * Atlasın istemci adası — yalnız SEÇİM tutuyor; sayılar sunucuda biçimlendi
 * (`PlanAtlas`).
 *
 * İKİ OKUMA KİPİ, CSS SEÇİYOR. İnce imleç ve geniş ekranda ayrıntı sağdaki
 * sabit okuma panelinde: satırın üstüne gelmek ya da klavyeyle odaklamak
 * paneli o satıra çeviriyor, düzen kıpırdamıyor (satır içinde açılan bir
 * kutu imlecin altındaki her şeyi itiyordu). Dokunmatikte ve dar ekranda
 * satırın sağında 44 piksellik bir düğme var; ayrıntı satırın altında
 * açılıyor — okuyucunun eylemiyle gelen kayma düzen kayması sayılmıyor.
 * Satırın kendisi her kipte planın sayfasına giden bağlantı.
 */
export function PlanAtlasView({
  title,
  sentence,
  basis,
  groups,
  anySnapshot,
  axis,
  copy,
}: {
  title: string;
  sentence: string | null;
  basis: string;
  groups: AtlasGroup[];
  anySnapshot: boolean;
  axis: { zero: number; one: number };
  copy: Copy;
}) {
  const all = groups.flatMap((group) => group.rows);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const shown = all.find((row) => row.symbol === active) ?? all[0];
  /* Giriş sırası bütün atlas boyunca (gruplar arası da) — `--i`. */
  const offsets = groups.map((_, k) => groups.slice(0, k).reduce((sum, group) => sum + group.rows.length, 0));

  return (
    <section className={cn("panel", styles.atlas)} aria-labelledby="plan-atlas-title">
      <header className={styles.head}>
        <h2 id="plan-atlas-title" className={styles.title}>{title}</h2>
        {sentence && <p className={styles.sentence}>{sentence}</p>}
        <p className={styles.meta}>
          <span className={styles.basis}>{basis}</span>
          <span>{copy.scaleNote}</span>
        </p>
        {/* Lejant işaretlerin kendisiyle çiziliyor: satırdaki bant, çubuk,
            çentik ne ise burada da o. */}
        <ul className={styles.legend} aria-hidden>
          <li><i className={styles.legendZone} />{copy.legendZone}</li>
          <li><i className={styles.legendBar} />{copy.legendPrice}</li>
          {anySnapshot && <li><i className={styles.legendBar} data-snapshot />{copy.legendSnapshot}</li>}
          <li><i className={styles.legendTick} data-kind="stop" />{copy.legendStop}</li>
          <li><i className={styles.legendTick} data-kind="target" />{copy.legendTarget}</li>
        </ul>
      </header>

      <div className={styles.body}>
        <div className={styles.groups} aria-label={copy.label} data-draw>
          {groups.map((group, groupIndex) => (
            <div key={group.verdict} className={styles.group} role="group" aria-labelledby={`atlas-${group.verdict}`}>
              <div className={styles.groupHead}>
                <h3 id={`atlas-${group.verdict}`} className={styles.groupTitle} data-verdict={group.verdict}>
                  {group.label}
                  <b className="numeral">{group.count}</b>
                </h3>
                {/* Eksen adları satırların izine hizalı: 0 ve 1'in tam üstünde. */}
                <span className={styles.axisNames} aria-hidden style={{ "--zero": axis.zero, "--one": axis.one } as Vars}>
                  <span data-end="start">{group.axisStart}</span>
                  <span data-end="end">{group.axisEnd}</span>
                </span>
                <span className={styles.columnName}>{group.column}</span>
              </div>
              {group.note && <p className={styles.groupNote}>{group.note}</p>}
              <ol className={styles.rows}>
                {group.rows.map((row, rowIndex) => {
                  const i = offsets[groupIndex] + rowIndex;
                  const isOpen = open === row.symbol;
                  const g = row.geometry;
                  return (
                    <li
                      key={row.symbol}
                      className={styles.row}
                      data-active={shown?.symbol === row.symbol || undefined}
                      data-open={isOpen || undefined}
                      style={{ "--i": i } as Vars}
                    >
                      <Link
                        href={row.href}
                        prefetch={false}
                        className={styles.rowLink}
                        onMouseEnter={() => setActive(row.symbol)}
                        onFocus={() => setActive(row.symbol)}
                      >
                        <span className={styles.symbol}>{row.symbol}</span>
                        <span className={styles.track} style={{ "--zero": axis.zero, "--one": axis.one } as Vars} aria-hidden>
                          <i className={styles.guide} data-at="zero" />
                          <i className={styles.guide} data-at="one" />
                          {g ? (
                            <>
                              <i className={styles.lane} />
                              {g.zone && (
                                <i
                                  className={cn(styles.zone, styles.zoneBand)}
                                  style={{ "--from": g.zone.from, "--to": g.zone.to } as Vars}
                                />
                              )}
                              {/* KALIN ÇUBUK, NOKTA DEĞİL (10 Kasım 2026, sahibinin
                                  sözü: "böyle nokta nokta ne anlatıyor anlamıyorum;
                                  yatayda uzun kalın çizgi seviyorum"). Satırda beş
                                  ayrı im vardı: alım bölgesi, fiyatın 11 piksellik
                                  noktası, stop ve hedef çentikleri, ikinci hedefin
                                  soluk çentiği ve her destek/direnç için gri bir
                                  çentik (16 satırda ~40 gri çizgi). Şimdi satır TEK
                                  şey söylüyor: stoptan (0) fiyatın bugünkü yerine
                                  uzanan 8 piksellik dolu çubuk. Çubuğun ucu fiyat;
                                  stop ve ilk hedef eksenin iki ucu olarak kaldı
                                  (kıyas), alım bölgesi bir aralık olduğu için bant.
                                  Destek/dirençler ve ikinci hedef satırın
                                  ayrıntısında (sayıyla) ve planın kendi sayfasında.
                                  Fiyat stopun altındaysa çubuk sıfırdan SOLA uzar. */}
                              <i
                                className={cn("bar-fill", styles.fill)}
                                data-snapshot={row.fromSnapshot || undefined}
                                data-tone={row.distanceTone}
                                data-side={g.at < axis.zero ? "below" : "above"}
                                style={{
                                  ...(g.at < axis.zero
                                    ? { right: `${((1 - axis.zero) * 100).toFixed(2)}%` }
                                    : { left: `${(axis.zero * 100).toFixed(2)}%` }),
                                  width: `${Math.max(Math.abs(g.at - axis.zero) * 100, 1).toFixed(2)}%`,
                                }}
                              />
                              {g.ticks
                                .filter((tick) => MAIN_TICKS.has(tick.kind))
                                .map((tick, k) => (
                                  <i key={`${tick.kind}-${k}`} className={styles.tick} data-kind={tick.kind} style={{ "--at": tick.at } as Vars} />
                                ))}
                            </>
                          ) : (
                            <span className={styles.noLevels}>{row.verdict === "sell" ? copy.noLevels : copy.noPlan}</span>
                          )}
                        </span>
                        <span className={cn(styles.distance, "numeral")} data-tone={row.distanceTone}>
                          {row.distance}
                        </span>
                        {/* Çizim `aria-hidden`; ekran okuyucu aynı bilgiyi cümleyle alıyor. */}
                        <span className="sr-only">
                          {`, ${row.stance}, ${row.priceLabel} ${row.priceText}${row.positionText ? `, ${row.positionText}` : ""}`}
                        </span>
                      </Link>
                      <button
                        type="button"
                        className={styles.toggle}
                        aria-expanded={isOpen}
                        aria-controls={`atlas-detail-${row.symbol}`}
                        aria-label={`${row.symbol} ${copy.details}`}
                        onClick={() => {
                          setOpen(isOpen ? null : row.symbol);
                          setActive(row.symbol);
                        }}
                      >
                        <CaretDown size={14} weight="bold" aria-hidden />
                      </button>
                      {isOpen && (
                        <div id={`atlas-detail-${row.symbol}`} className={styles.inline}>
                          <Detail row={row} copy={copy} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>

        {/* Okuma paneli — yalnız ince imleçli geniş ekranda (CSS). */}
        <aside className={styles.readout} aria-live="polite">
          {shown ? <Detail row={shown} copy={copy} /> : null}
          <p className={styles.hint}>{copy.hint}</p>
        </aside>
      </div>
    </section>
  );
}

function Detail({ row, copy }: { row: AtlasRowView; copy: Copy }) {
  return (
    <div className={styles.detail}>
      <p className={styles.detailHead}>
        <b>{row.symbol}</b>
        {/* Görüş hapı tek bileşen (10 Kasım): burada elle `verdictPillClass`
            hapı vardı, ikonsuz ve köşeli. */}
        <VerdictPill verdict={row.verdict} label={row.stance} size="xs" />
      </p>
      {row.company && <p className={styles.detailCompany}>{row.company}</p>}
      <p className={styles.detailPrice}>
        <span>{row.priceLabel}</span>
        <strong className="numeral">{row.priceText}</strong>
      </p>
      {row.positionText && <p className={styles.detailPosition} data-tone={row.distanceTone}>{row.positionText}</p>}
      {row.facts.length > 0 && (
        <dl className={styles.facts}>
          {row.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd className="numeral" data-tone={fact.tone}>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {row.headline && (
        <div className={styles.thesis}>
          <span>{copy.thesis}</span>
          <p lang={row.headlineLang}>{row.headline}</p>
        </div>
      )}
      <Link href={row.href} prefetch={false} className={styles.openPlan}>
        {copy.openPlan}
        <ArrowUpRight size={13} weight="bold" aria-hidden />
      </Link>
    </div>
  );
}
