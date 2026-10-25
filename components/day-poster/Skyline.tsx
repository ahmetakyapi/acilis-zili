"use client";

import { Fragment, useState } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import type { District, SkyModeName, SkyStock } from "@/lib/day-skyline";
import type { StoryTone } from "@/lib/day-poster-story";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, directionOf, directionText, formatMoneyCompact, formatPercent } from "@/lib/utils";
import { SkyScene } from "./SkyScene";
import styles from "./Skyline.module.css";

/**
 * GÜNÜN SİLUETİ — posterin büyük sahnesi (`/gun/[tarih]`, `/gun`). Sahne
 * ana sayfanın şeridiyle ORTAK (`SkyScene.tsx`: gök, yansıma, pencere
 * ritmi, logo karosu, ipucu, klavye, giriş; gerekçeler orada); bu bileşen
 * sayfanın dört düzenini seçiyor ve altına tablo ikizini koyuyor.
 *
 * DÖRT DÜZEN, HEPSİ BASILI (`SKY_MODES`): telefon (üç sıra), tablet (iki
 * sıra), masaüstü ve geniş ekran (tek sıra). Görüneni kabın eni seçiyor
 * (CSS kap sorgusu, SkyScene.module.css); görünmeyen `display:none`.
 *
 * Tam liste "Tüm Şirketler"de, sektör sektör tablo (WCAG tablo ikizi).
 */

type SkyText = Dictionary["daySignature"]["skyline"];

/** Sayfanın düzenleri — SkyScene.module.css'teki kap sorgularıyla aynı sıra. */
const PAGE_MODES = ["narrow", "medium", "wide", "xwide"] as const satisfies readonly SkyModeName[];
/** Yüzde basamağı — posterin geri kalanıyla aynı. */
const PERCENT_DIGITS = 2;

export function Skyline({
  stocks,
  districts,
  names,
  logos,
  sized,
  locale,
  text,
  adv,
  dec,
  tone,
}: {
  stocks: SkyStock[];
  districts: District[];
  /** Mahalle anahtarı → okunur ad. */
  names: Record<string, string>;
  /** Sembol → logo adresi (yalnız depoda olanlar). */
  logos: Record<string, string>;
  sized: boolean;
  locale: Locale;
  text: SkyText;
  adv: number;
  dec: number;
  tone: StoryTone;
}) {
  const [listOpen, setListOpen] = useState(false);
  const pct = (value: number) => formatPercent(value, locale, PERCENT_DIGITS);
  const label = text.sceneLabel.replace("{adv}", String(adv)).replace("{dec}", String(dec));

  return (
    <div className={styles.skyline} data-skyline="">
      <SkyScene
        variant="poster"
        modes={PAGE_MODES}
        stocks={stocks}
        districts={districts}
        names={names}
        logos={logos}
        sized={sized}
        locale={locale}
        text={text}
        tone={tone}
        label={label}
      />
      <div className={styles.listWrap}>
        <button type="button" className={styles.listToggle} aria-expanded={listOpen} onClick={() => setListOpen((open) => !open)}>
          {listOpen ? text.allStocksClose : `${text.allStocks} (${stocks.length})`}
        </button>
        {listOpen && <StockTable stocks={stocks} districts={districts} names={names} text={text} pct={pct} locale={locale} sized={sized} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ TABLO */

function StockTable({
  stocks,
  districts,
  names,
  text,
  pct,
  locale,
  sized,
}: {
  stocks: SkyStock[];
  districts: District[];
  names: Record<string, string>;
  text: SkyText;
  pct: (value: number) => string;
  locale: Locale;
  sized: boolean;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{text.colStock}</th>
            <th scope="col" className={styles.num}>{text.colChange}</th>
            {sized && <th scope="col" className={styles.num}>{text.colCap}</th>}
          </tr>
        </thead>
        <tbody>
          {districts.map((district) => (
            <Fragment key={district.key}>
              <tr className={styles.groupRow}>
                <th scope="colgroup" colSpan={sized ? 3 : 2}>
                  {names[district.key] ?? district.key}{" "}
                  <span className={directionText(directionOf(district.change))}>{pct(district.change)}</span>
                </th>
              </tr>
              {district.members.map((i) => (
                <tr key={stocks[i].symbol}>
                  <td>
                    <Link href={`/hisse/${stocks[i].symbol}`} className={styles.tableLink}>
                      <span className={styles.tableSymbol}>{stocks[i].symbol}</span>
                      <span className={styles.tableName}>{stocks[i].name}</span>
                    </Link>
                  </td>
                  <td className={cn(styles.num, directionText(directionOf(stocks[i].change)))}>{pct(stocks[i].change)}</td>
                  {sized && <td className={styles.num}>{stocks[i].cap !== null ? formatMoneyCompact(stocks[i].cap, locale) : ""}</td>}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
