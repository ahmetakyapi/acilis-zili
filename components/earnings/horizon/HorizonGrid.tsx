"use client";

import { Suspense, use, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { buttonClass, LogoTile, TimingChip, type TimingTone } from "@/components/ui/primitives";
import { KarneStrip } from "@/components/earnings/KarneStrip";
import { karneSlots, type KarneMark, type KarneSlot, type TileTier } from "@/lib/earnings-horizon";
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
 * karonun kare satırı kendi `Suspense`inde aynı yükseklikte bir yedekle
 * duruyor ve veri gelince yerine oturuyor.
 *
 * KART TURU (25 Ekim, üçüncü tur). Sahibinin sözü: "çok daha görsel ve
 * daha okunaklı; logolar, kartlar kompakt; bazı yerler çok uzun kalmış".
 * Ölçülen sorunlar (1440, TR): iki boy karo (56 / 40) hücrede dağınıktı ve
 * tek büyük karo satırı 155 piksele çıkarıyordu; karo altındaki 2
 * piksellik çentikler okunmuyordu; okuma satırı telefonda 308 piksel.
 * Şimdi: her hücre dört sütunlu düzenli bir kart ızgarası, karolar tek boy
 * (büyük şirket çerçeveyle ve başta), karonun TAMAMI (logo, sembol, dört
 * kare) tek düğme; karne dört okunur kare (dolu = aşıldı, boş = aşılmadı,
 * soluk = veri yok). Ölçüm `EarningsHorizon.module.css` başında.
 *
 * LOGO TURU (6 Kasım, sahibinin sözü: "beklenti 3 çeyrekte aşılmış ama 4
 * gibi gözüküyor; logolar daha güzel gözüksün, kolay seçilsin, alanı güzel
 * kullanalım"). Masaüstünde hücre dört sütun kaldı, logo 32 → 40 (kartın
 * iç boşluğu daraldı); aşılmadı parçası kırmızı; logonun köşesindeki sonuç işareti
 * zeminli rozet. Ölçüm ve gerekçe CSS'te ("AŞILMADI KIRMIZI", `.result`)
 * ve `CELL_MAX_SLOTS` yorumunda.
 *
 * TELEFON KARTLARI (27 Ekim, sahibinin isteği: "mobilde kartlar daha
 * okunaklı, daha görsel; en kritik olanlar daha okunaklı ve görsel bir
 * temada"). Masaüstünün 46 piksellik ikon ızgarası telefonda da aynıydı:
 * 12,5 piksellik sembol ve 6 piksellik kareler, MSFT ile FTNT aynı ağırlıkta.
 * 1180'in altında hücre iki kademe: hücrenin ilk dört BÜYÜK karosu
 * (`tileTierOf`) ve pencerenin en büyük ikisi "öne çıkan" kart — logo 40, sembol, ad,
 * piyasa değeri ve karne; kalanlar üç sütunlu yatay kart (logo, sembol,
 * kareler). Tek sayıda öne çıkanın sonuncusu tam satır, boşluk kalmasın.
 * Masaüstü ızgarası değişmedi (ad ve değer orada `display: none`).
 *
 * TAŞMA TURU (31 Ekim, sahibinin sözü: "bazı yerler taşmış, böyle kabul
 * edilemez"). 1440'ta ölçülenler: eksen sütunu 104 piksel sabitti ve
 * "Kapanış Sonrası" hapı pazartesiye 23 piksel biniyordu; saati belirsiz
 * satırında kart başka biçimdeydi (yatay 104×44, öteki satırlar dikey
 * 50×68); dört 6 piksellik kare uzaktan nokta gibi okunuyordu. Şimdi eksen
 * `max-content`, her satırda tek kart biçimi (logo hep `md`), karne
 * kartın genişliğinde dört parçalı ince şerit. Ölçüm CSS'te.
 */

export type HorizonTile = {
  symbol: string;
  name: string;
  logoUrl: string | null;
  /** Kenar oranı 0…1 (`tileScale`): gün değişince ilk seçilecek karo. */
  scale: number;
  /** Büyük şirket çerçeveli karo (`tileTierOf`); boy herkes için aynı. */
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
  /** Haftanın en kalabalık günü (`peakDay`): başlıkta "Zirve" rozeti. */
  peak: boolean;
  /** Geniş ekranda günün karo sütunu (`horizonShape`); 0 = karosuz gün,
      ince şerit. */
  columns: number;
  /** Yarım günde kapanış sonrası penceresinin o güne özgü saati ("~21:00");
      öteki günlerde null (eksendeki saat geçerli). */
  amcNote: string | null;
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
  peak: string;
  peakLabel: string;
  beatRecordAll: string;
  beatRecordNone: string;
  beatCount: string;
  noKarne: string;
  karneLoading: string;
  companyPage: string;
  analysis: string;
  marketClosed: string;
  emptyLane: string;
  emptyDay: string;
  today: string;
  hint: string;
  pickDay: string;
  more: string;
  dayList: string;
};

type Karne = Promise<Record<string, KarneMark[]>>;

const READOUT_ID = "bilanco-ufku-ayrinti";

/* HAFTA DEĞİŞİMİNİN YÖNÜ (10 Kasım, görsel kalite turu). Izgara hafta
   değişince `key` ile yeniden kuruluyor ve 4 piksel aşağıdan beliriyordu:
   ileri de geri de aynı hareket, okur hangi yöne gittiğini hareketten
   okuyamıyordu. Şimdi yeni hafta GELDİĞİ yönden kayıyor (sonraki hafta
   sağdan, önceki soldan; 14 piksel + saydamlık, CSS `weekIn`).
   Önceki hafta modül değişkeninde: bileşen yeniden kurulduğu için durumda
   tutulamaz. Yalnız İSTEMCİDE ve yerleşim efektinde yazılıyor — sunucuda
   modül değişkeni istekler arası ortak olurdu ve işaretleme sunucu
   çıktısına sızıp hidrasyonu bozardı. */
let lastMonday: string | null = null;
const LANE_TONE: Record<WeekLane, TimingTone> = { bmo: "pre", amc: "post", other: "neutral" };

export function HorizonGrid({
  days,
  lanes,
  karne,
  initial,
  initialDay,
  labels,
  monday,
  rows = 1,
}: {
  /** Ufkun haftası — geçişin yönü bundan (bkz. `lastMonday`). */
  monday?: string;
  days: HorizonDay[];
  lanes: HorizonLane[];
  karne: Karne;
  initial: string | null;
  /** Telefonda açık gün — cümlenin andığı zirve günü. */
  initialDay: string | null;
  labels: Labels;
  /** Hücredeki karo sırası (`horizonShape`). */
  rows?: number;
}) {
  const [selected, setSelected] = useState<string | null>(initial);
  const [activeDay, setActiveDay] = useState<string | null>(initialDay ?? days[0]?.date ?? null);
  const gridRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!monday) return;
    const previous = lastMonday;
    lastMonday = monday;
    if (previous && previous !== monday && gridRef.current) gridRef.current.dataset.from = monday > previous ? "next" : "prev";
  }, [monday]);
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

  /* IZGARA VERİNİN ŞEKLİNDE (10 Kasım 2026, sahibinin sözü: "boş günler
     olunca kötü duruyor; orayı çok güzel ele almak lazım, her şekle uygun
     olmalı"). Beş eşit gün × üç sabit satır vardı: karosuz cuma 229×395
     piksellik gri alan, on karolu pazartesi iki sıraya sıkışık, boş dilim
     "Yok" yazılı kutu. Şimdi (≥1180):
       - Sütun HATLARI karo birimi: gün, `columns` kadar birim kaplar
         (`horizonShape`), gün kutusu ve hücreleri bu hatları `subgrid` ile
         paylaşır, yani her karo aynı genişlikte ve seyrek haftada birim
         kendiliğinden genişler (karo zengin karta döner, CSS kap sorgusu).
       - Karosuz gün dar, çerçeveli bir ŞERİT: gün, ölçer, sayı. Tam tatil
         taralı. Hafta beş günüyle yerinde, yer kaplamadan.
       - Haftada hiç dolmayan pencerenin satırı yok (sunucu `lanes`i süzer).
       - Günün yoğunluğu başlıktaki dikey ÖLÇER: eşit olmayan sütunlarda
         yatay şerit yanlış okunurdu (oran × farklı genişlik); dikey ölçer
         beş günde aynı boyda, yan yana haftanın ritmi.
     Telefon ve tablet (gün seçici + tek gün) aynı veriyi okur; ölçer
     seçicide de aynı çizim. Ölçüm `EarningsHorizon.module.css` sonunda. */
  const quiet = all.length === 0;
  const tracks: string[] = quiet ? [] : ["max-content"];
  const placed = days.map((day) => {
    if (quiet) {
      tracks.push("minmax(0, 1fr)");
      return { start: tracks.length, span: 1 };
    }
    tracks.push("var(--hz-gutter)");
    const start = tracks.length + 1;
    if (day.columns > 0) for (let index = 0; index < day.columns; index += 1) tracks.push("minmax(0, 1fr)");
    else tracks.push("var(--hz-spine)");
    return { start, span: Math.max(1, day.columns) };
  });

  const countNode = (day: HorizonDay) => {
    if (day.closed) return <p className={styles.dayCount}>{labels.marketClosed}</p>;
    /* SAYI KOYU, BİRİM SOLUK (10 Kasım): "307 Şirket" tek ağırlıkta 12
       pikseldi; sayılar birimleriyle aynı gürültüde okunuyordu. Sayı
       `day.count`, metnin kalanı sözlükteki kalıptan (sıra dile göre
       değişebilir). Sayı o günün tam listesine bağlantı: karosuz günde
       tek çıkış yolu bu. */
    const parts = day.countText.split(String(day.count)).map((part, index) => (
      <span key={index}>
        {index > 0 && <b>{day.count}</b>}
        {part}
      </span>
    ));
    if (day.count === 0) return <p className={`figure ${styles.dayCount}`}>{parts}</p>;
    const label = labels.dayList.replace("{day}", day.weekday).replace("{count}", String(day.count));
    return day.moreHref.startsWith("#") ? (
      <a href={day.moreHref} className={`figure ${styles.dayCount}`} aria-label={label}>
        {parts}
      </a>
    ) : (
      <Link href={day.moreHref} prefetch={false} className={`figure ${styles.dayCount}`} aria-label={label}>
        {parts}
      </Link>
    );
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
            data-peak={day.peak || undefined}
            onClick={() => pickDay(day)}
          >
            <span className={styles.pickName}>{day.short}</span>
            <span className={`figure ${styles.pickNumber}`}>{day.dayNumber}</span>
            <span className={`figure ${styles.pickCount}`}>{day.closed ? NO_VALUE : day.count}</span>
            <Meter ratio={day.closed ? 0 : day.density} />
            {day.peak && <span className="sr-only">{labels.peakLabel}</span>}
          </button>
        ))}
      </div>
      <div
        ref={gridRef}
        className={styles.grid}
        data-quiet={quiet || undefined}
        data-rows={rows}
        style={{ "--lanes": Math.max(1, lanes.length), "--tracks": tracks.join(" ") } as CSSProperties}
      >
        {/* Sol eksen yalnız geniş ekranda; her hücrede aynı ad dar ekranda
            görünür, geniş ekranda ekran okuyucuya kalır. */}
        {!quiet && (
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
        )}

        {days.map((day, dayIndex) => (
          <section
            key={day.date}
            className={styles.day}
            data-state={day.state}
            data-columns={day.columns}
            data-closed={day.closed || undefined}
            data-peak={day.peak || undefined}
            data-active={activeDay === day.date || undefined}
            aria-labelledby={`ufuk-${day.date}`}
            style={{ "--start": placed[dayIndex].start, "--span": placed[dayIndex].span } as CSSProperties}
          >
            {/* GÜN BAŞLIĞI: solda ölçer, yanında numara + ad (dar sütunda
                kısa ad) ve rozet (bugün / zirve), altında günün tüm
                açıklayanlarının sayısı. Başlık kendi genişliğine göre
                dizilir (kap sorgusu): gün iki birimlik de olabilir, on dört
                birimlik de. */}
            <header className={styles.dayHead}>
              <div className={styles.dayHeadIn}>
                <Meter ratio={day.closed ? 0 : day.density} />
                <h3 id={`ufuk-${day.date}`} className={styles.dayName}>
                  <span className={`figure ${styles.dayNumber}`}>{day.dayNumber}</span>
                  <span className={styles.dayWeekday}>{day.weekday}</span>
                  {/* Dar başlıkta tam ad yerine kısa ad (CSS kap sorgusu
                      birini gösterir, öteki `display: none`). */}
                  <span className={styles.dayShort}>{day.short}</span>
                </h3>
                {/* Rozetler ayrı satırlarda (bugün adın, zirve sayının
                    yanında): ikisi aynı güne düşünce gün adı kırpılmasın. */}
                {day.state === "today" && <span className={styles.todayTag}>{labels.today}</span>}
                {day.peak && (
                  <span className={styles.peakTag} title={labels.peakLabel}>
                    <span aria-hidden>{labels.peak}</span>
                    <span className="sr-only">{labels.peakLabel}</span>
                  </span>
                )}
                {countNode(day)}
              </div>
            </header>
            {day.closed ? (
              <p className={styles.closed}>{labels.marketClosed}</p>
            ) : day.columns === 0 ? (
              /* KAROSUZ GÜN. Geniş ekranda şeridin kendisi cevap (başlıktaki
                 sayı bağlantı); bu satır yalnız telefonda ve tablette, gün
                 seçiciden o gün açıldığında: tek satır + günün tam listesi.
                 Sahne yok: panel içi boş durum kuralı. */
              <p className={styles.voidDay}>
                <span>{labels.emptyDay}</span>
                {day.count > 0 &&
                  (day.moreHref.startsWith("#") ? (
                    <a href={day.moreHref} className={`tap-44 ${styles.voidLink}`}>
                      {day.countText}
                      <ArrowUpRight size={12} weight="bold" aria-hidden />
                    </a>
                  ) : (
                    <Link href={day.moreHref} prefetch={false} className={`tap-44 ${styles.voidLink}`}>
                      {day.countText}
                      <ArrowUpRight size={12} weight="bold" aria-hidden />
                    </Link>
                  ))}
              </p>
            ) : (
              lanes.map((lane) => {
                const tiles = day.lanes[lane.key];
                const more = day.more[lane.key];
                const moreText = labels.more.replace("{count}", String(more));
                const moreLabel = day.moreLabel.replace("{count}", String(more));
                return (
                  <div key={lane.key} className={styles.lane} data-lane={lane.key} data-empty={tiles.length === 0 || undefined}>
                    <p className={styles.laneHead}>
                      <TimingChip tone={lane.tone} size="sm">
                        {lane.title}
                      </TimingChip>
                      {lane.clock && (
                        <span className={`figure ${styles.laneClock}`}>{lane.key === "amc" && day.amcNote ? day.amcNote : lane.clock}</span>
                      )}
                    </p>
                    {lane.key === "amc" && day.amcNote && tiles.length > 0 && (
                      <span className={`figure ${styles.laneNote}`}>{day.amcNote}</span>
                    )}
                    {tiles.length > 0 ? (
                      <ul className={styles.tiles}>
                        {tiles.map((tile, index) => (
                          <Tile
                            key={tile.symbol}
                            tile={tile}
                            feature={featureOf(tiles, index)}
                            order={order.get(tile.symbol) ?? 0}
                            pressed={current?.symbol === tile.symbol}
                            onSelect={() => setSelected(tile.symbol)}
                            karne={karne}
                          />
                        ))}
                        {more > 0 && (
                          <li className={styles.tileItem} data-more style={{ "--i": order.size } as CSSProperties}>
                            {day.moreHref.startsWith("#") ? (
                              <a href={day.moreHref} className={`tap-44 ${styles.more}`} aria-label={moreLabel}>
                                {moreText}
                              </a>
                            ) : (
                              <Link href={day.moreHref} prefetch={false} className={`tap-44 ${styles.more}`} aria-label={moreLabel}>
                                {moreText}
                              </Link>
                            )}
                          </li>
                        )}
                      </ul>
                    ) : (
                      /* Boş değer sitenin her yerinde "–" (10 Kasım tutarlılık
                         denetimi; ortalanmış gri "Yok" kalktı). Ekran
                         okuyucu sözcüğü duyar. */
                      <span className={styles.laneEmpty}>
                        <span aria-hidden>{NO_VALUE}</span>
                        <span className="sr-only">{labels.emptyLane}</span>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </section>
        ))}
      </div>

      {!quiet && <Readout tile={current} karne={karne} labels={labels} />}
    </>
  );
}

/** Günün yoğunluğu (o günün tüm açıklayanları / haftanın en kalabalık günü)
    dikey bir ölçer: kulvar üstünde alttan dolan şerit. */
function Meter({ ratio }: { ratio: number }) {
  return (
    <span className={styles.meter} aria-hidden>
      <span style={{ "--ratio": ratio } as CSSProperties} />
    </span>
  );
}

/** Telefonda kartın kademesi: pencerenin en büyük ikisi ve ilk dördün
    içindeki haftalık büyükler (`tileTierOf`) öne çıkan kart; tek sayıdaysa
    sonuncusu tam satır (`wide`). Yalnız haftalık büyükler sayılsaydı MSFT'siz
    bir günde (salı: UNH, V) hiç öne çıkan olmuyordu. Masaüstü yok sayar. */
function featureOf(tiles: HorizonTile[], index: number): "wide" | "feature" | undefined {
  const featured = Math.max(Math.min(2, tiles.length), tiles.slice(0, 4).filter((tile) => tile.tier === "big").length);
  if (index >= featured) return undefined;
  return featured % 2 === 1 && index === featured - 1 ? "wide" : "feature";
}

function Tile({
  tile,
  feature,
  order,
  pressed,
  onSelect,
  karne,
}: {
  tile: HorizonTile;
  feature: "wide" | "feature" | undefined;
  order: number;
  pressed: boolean;
  onSelect: () => void;
  karne: Karne;
}) {
  return (
    <li className={styles.tileItem} data-tier={tile.tier} data-feature={feature} style={{ "--i": order } as CSSProperties}>
      {/* KARONUN TAMAMI TEK DÜĞME: logo, sembol ve kareler. Yalnız logo
          düğmeyken sembole dokunmak boşa gidiyordu. */}
      <button
        type="button"
        className={styles.tile}
        aria-pressed={pressed}
        aria-label={tile.label}
        aria-controls={READOUT_ID}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") onSelect();
        }}
        onFocus={onSelect}
        onClick={onSelect}
      >
        <span className={styles.karo}>
          {/* `lg` kaynağı (44 px, 2× yoğunlukta 88): geniş ekranda karo 52'ye
              kadar büyüyor, 32'lik görsel bulanıklaşırdı. Boy CSS'ten. */}
          <LogoTile symbol={tile.symbol} logoUrl={tile.logoUrl} size="lg" className={styles.logo} />
          {tile.watched && (
            <span aria-hidden className={styles.star}>
              ★
            </span>
          )}
          {/* Açıklanmış bilançoda yön glifi (biçim + renk): beklentiye göre. */}
          {tile.surprise && (
            <span aria-hidden className={styles.result} data-dir={tile.surprise}>
              <span>{tile.surprise === "beat" ? "▲" : tile.surprise === "miss" ? "▼" : "="}</span>
            </span>
          )}
        </span>
        {/* Masaüstünde `display: contents` (karo, sembol, kareler alt
            alta); telefonda kartın sağ kolonu. Ad ve değer yalnız öne
            çıkan kartta görünür. */}
        <span aria-hidden className={styles.tileText}>
          <span className={styles.tileSymbol}>{tile.symbol}</span>
          <span className={styles.tileName}>{tile.name}</span>
          <span className={styles.tileFoot}>
            <Suspense fallback={<Squares slots={null} />}>
              <TileSquares karne={karne} symbol={tile.symbol} />
            </Suspense>
            {tile.capText && <span className={`figure ${styles.tileCap}`}>{tile.capText}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

function TileSquares({ karne, symbol }: { karne: Karne; symbol: string }) {
  return <Squares slots={karneSlots(use(karne)[symbol] ?? [])} />;
}

/** Dört parça, eskiden yeniye. Çizim ve renk kuralı ortak bileşende
    (`KarneStrip`, 10 Kasım: karne her ekranda aynı çizim); burada yalnız
    yuva sayısı (`karneSlots`) ve boy. `null` = yükleniyor (dört soluk yuva,
    aynı yükseklik). */
function Squares({ slots, large = false }: { slots: KarneSlot[] | null; large?: boolean }) {
  return <KarneStrip marks={slots ?? karneSlots([])} size={large ? "md" : "sm"} pending={slots === null} className={styles.squares} />;
}

function ReadoutKarne({ karne, symbol, labels }: { karne: Karne; symbol: string; labels: Labels }) {
  const marks = use(karne)[symbol] ?? [];
  if (marks.length === 0) {
    return (
      <>
        <Squares slots={karneSlots([])} large />
        <span className={styles.readoutKarneNote}>{labels.noKarne}</span>
      </>
    );
  }
  const beat = marks.filter((mark) => mark === "beat").length;
  const sentence = (beat === marks.length ? labels.beatRecordAll : beat === 0 ? labels.beatRecordNone : labels.beatRecordLine)
    .replace("{total}", String(marks.length))
    .replace("{beat}", String(beat));
  return (
    <>
      <Squares slots={karneSlots(marks)} large />
      <span className={styles.readoutKarneCount} aria-hidden>
        {labels.beatCount.replace("{beat}", String(beat)).replace("{total}", String(marks.length))}
      </span>
      <span className="sr-only">{sentence}</span>
    </>
  );
}

/* OKUMA ŞERİDİ TEK SATIR (kart turu): kim · üç sayı · karne · buton.
   Karne cümlesi ("Son 4 çeyreğin 2 tanesinde…") görselde "2/4 Çeyrekte
   Aşıldı" ile aynı şeyi söylüyordu; ekran okuyucuya kalıyor. Telefonda
   üç kısa satır: kim + buton, sayılar, karne. */
function Readout({ tile, karne, labels }: { tile: HorizonTile | null; karne: Karne; labels: Labels }) {
  return (
    <div id={READOUT_ID} className={styles.readout} aria-live="polite">
      {tile ? (
        <>
          <div className={styles.readoutWho}>
            <LogoTile symbol={tile.symbol} logoUrl={tile.logoUrl} size="lg" className={styles.readoutLogo} />
            <div className="min-w-0">
              <p className={styles.readoutSymbol}>
                {tile.symbol}
                <span className={styles.readoutName}>{tile.name}</span>
              </p>
              <p className={styles.readoutWhen}>
                <span className={styles.readoutDay}>{tile.whenText}</span>
                <TimingChip tone={LANE_TONE[tile.lane]} size="sm">
                  {tile.laneText}
                </TimingChip>
              </p>
            </div>
          </div>
          <dl className={styles.readoutFacts}>
            {/* EKSİK ÖLÇÜ YER TUTMAZ (10 Kasım): beklentisi olmayan küçük
                şirkette şerit "Gelir Beklentisi –" basıyordu. Bilinmeyen
                ölçünün sütunu hiç çizilmez; kalanlar eşit paylaşır. */}
            {tile.revenueText && (
              <div>
                <dt>{labels.revenueEstimate}</dt>
                <dd className="numeral">{tile.revenueText}</dd>
              </div>
            )}
            {tile.epsText && (
              <div>
                <dt>{labels.epsEstimate}</dt>
                <dd className="numeral">{tile.epsText}</dd>
              </div>
            )}
            {tile.capText && (
              <div>
                <dt>{labels.marketCap}</dt>
                <dd className="numeral">{tile.capText}</dd>
              </div>
            )}
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
            <div className={styles.readoutKarneRow}>
              <Suspense
                fallback={
                  <>
                    <Squares slots={null} large />
                    <span className={styles.readoutKarneNote}>{labels.karneLoading}</span>
                  </>
                }
              >
                <ReadoutKarne karne={karne} symbol={tile.symbol} labels={labels} />
              </Suspense>
            </div>
          </div>
          <div className={styles.readoutLinks}>
            <Link href={tile.href} prefetch={false} className={buttonClass({ variant: "ghost", size: "sm", className: styles.readoutButton })}>
              {labels.companyPage}
              <ArrowUpRight size={13} weight="bold" aria-hidden />
            </Link>
            {tile.analysisHref && (
              <Link href={tile.analysisHref} prefetch={false} className={buttonClass({ variant: "quiet", size: "sm", className: styles.readoutButton })}>
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
