import type { ReactNode } from "react";
import { TrendDown, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ChangePill, Panel, Skeleton } from "@/components/ui/primitives";
import { RollingFigure } from "@/components/ui/RollingFigure";
import type { Dictionary, Locale } from "@/lib/i18n";
import { changeHistogram, histogramShare, HISTOGRAM_LIMIT } from "@/lib/market-scales";
import type { ThemePhase } from "@/lib/theme-stats";
import { cn, formatPercent, formatPercentPlain } from "@/lib/utils";
import { INDEX_TABS, type TabKey } from "./index-shared";
import styles from "./MarketExperience.module.css";

/* ---- Endeks seçici + piyasa genişliği ----

   İkisi tek panelde: seçici başıboş bir düğme satırıydı, genişlik ise tek
   bir çubuk için ayrı bir paneldi. Bilgi olarak da aynı şeye bakıyorlar —
   "hangi endeks" ve "o endeksin bugünü". Ayrı dururken sayfada iki blok
   yüksekliği harcıyor, birleşince seçimin karşılığı hemen altında okunuyor.
   Sonraki yükleme düzeninde seçimler sonuç sınırının dışına çıktı: veri
   beklenirken çipler kaybolmaz veya devre dışı kalmaz; genişlik yine altındadır. */

export function IndexTabs({ tab, aside, identity }: { tab: TabKey; locale: Locale; t: Dictionary; aside?: ReactNode; identity?: ReactNode }) {
  return <Panel className={styles.indexTabs}>
      {/* TEK ŞERİT, ÜÇ BÖLME (6 Kasım). Çipler kutusuz, medyan çerçevesiz,
          pay kendi kenarlıklı kutusunda duruyordu: üç ayrı yükseklik
          (1440: çipler 38, medyan ~46, pay kutusu 90 piksel), üç ayrı dil
          ve aralarında hizasız boşluklar. Şimdi tek panel; seçim, medyan ve
          pay aynı yüzeyde üç bölme, aralarında saç çizgisi, üçü de dikeyde
          ortalı. Pay kutusunun kenarlığı kalktı — panelin kendisi kutu. */}
      {/* `data-aside`: pay basılmazsa ızgara iki kolona düşer (6 Kasım,
          inceleme; MarketExperience.module.css → `.toolbarLayout`). */}
      <div className={styles.toolbarLayout} data-aside={aside ? "" : undefined}>
        <div className={styles.indexChoices}>
        {/* "Piyasa Genişliği" künyesi çiplerin üstündeydi; 9 Ekim 2026'da
            bütün bölüm künyeleriyle kalktı (`PageHeader` yorumu). Çiplerin
            ne seçtiği adlarından, genişlik de "Yükselenlerin Payı"ndan okunuyor. */}
        {/* ÜÇ ÇİP MOBİLDE TEK SATIRDA. `flex-wrap` ile diziliyorlardı ve
            üçüncü çip (S&P 500) 390 pikselde alt satıra düşüyordu: üç eşit
            seçenek iki-bir diye kırılınca denetim tek bir seçici olmaktan
            çıkıp iki ayrı satır gibi okunuyordu. Dar ekranda üçlü ızgara,
            geniş ekranda eskisi gibi doğal genişlikte akıyorlar.
            Üye sayısı dar ekranda düşüyor: 106 piksellik hücreye sığmıyor ve
            zaten bir alttaki "102 şirketin 5 tanesi" künyesinde yazılı. */}
        <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-wrap">
          {INDEX_TABS.map((entry) => {
            const activeTab = entry.key === tab;
            return (
              <Link
                key={entry.key}
                href={`/piyasalar?endeks=${entry.key}`}
                aria-current={activeTab ? "page" : undefined}
                scroll={false}
                className={cn(
                  /* Basış evin tek lehçesinde (BUTTON_BASE): ekranın ana
                     seçicisi dokunuşa sessiz kalıyordu — sunucu gezinmesi
                     dönene kadar hiçbir şey değişmiyordu (14 Ekim). */
                  "flex min-h-11 items-center justify-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,scale] active:scale-[0.97] motion-reduce:active:scale-100 sm:min-h-[38px] sm:px-4 sm:text-sm",
                  activeTab
                    ? "bg-primary text-on-primary"
                    : "border border-line bg-surface text-soft hover:border-line-strong hover:text-strong",
                )}
              >
                {entry.label}
                <span
                  className={cn(
                    "numeral hidden text-xs font-normal sm:inline",
                    /* Saydamlık yerine punto — gerekçe şirketler dizininde. */
                    activeTab ? "text-on-primary" : "text-muted",
                  )}
                >
                  {entry.members.length}
                </span>
              </Link>
            );
          })}
        </div>
        </div>
        {identity}
        {/* SAĞDA YÜKSELENLERİN PAYI (26 Eylül). Pay genişlik kartının sağ
            yarısını tutuyordu; satırın sağı ise yalnızca liste tarihini
            taşıyordu. Pay buraya çıkınca kartın sağı ısı haritasına kaldı.
            Liste tarihi kartın kimlik bloğuna indi. */}
        {aside && <div className={styles.tabsAside}>{aside}</div>}
      </div>

  </Panel>;
}

/* Seçili endeksin kendi değişimi, yükselen şirketlerin payından farklıdır:
   birkaç ağır şirket, üyelerin çoğu düşerken endeksi yukarı taşıyabilir.
   Gösterilen fiyat endeks seviyesi değil onu izleyen fonun kotasyonudur;
   fon sembolü bu yüzden fiyatın yanında kalır. Eksik değişimler sayaca
   katılmaz; gerçek kapsam toplam üye sayısıyla ayrıca gösterilir.
   18 Ekim: fonun fiyatı ve yüzdesi buradan kalktı (üstteki kartın tekrarı);
   yerine üyelerin medyan değişimi — gerekçe IndexDetail → "MEDYAN HİSSE". */
export function IndexIdentity({ tab, proxy, median: medianMove, phase, moves = null, locale, t, loading = false }: {
  tab: TabKey; proxy: string; median: number | null; phase: ThemePhase | null;
  /** Medyanın kurulduğu yüzdeler (aynı seans kümesi) — dağılım çizimi için. */
  moves?: readonly number[] | null;
  locale: Locale; t: Dictionary; loading?: boolean;
}) {
  const label = INDEX_TABS.find((entry) => entry.key === tab)?.label;
  /* Medyanın künyesi pencereye göre (tema ekranlarının kuralı, `themePhase`):
     açılış öncesinde "Günün" değil, piyasa kapalıyken "Son Kapanış". */
  const medianLabel =
    phase === "pre-market" ? t.markets.medianPreMarket : phase === "lastClose" ? t.markets.medianLastClose : t.markets.medianStock;
  /* FON SEMBOLÜ VE AD KALKTI (6 Kasım). "QQQ Nasdaq 100" satırı, fon
     fiyatı burada dururken onun künyesiydi; fiyat 18 Ekim'de kalkınca
     künye yalnız kaldı ve hemen solundaki seçili çipin ADINI tekrar
     ediyordu (fon sembolü üstteki kartta zaten yazılı). Blok artık tek iş
     yapıyor: medyan ve onun tek cümlelik açıklaması. Seçili endeksin adı
     ekran okuyucuya `role="group"` + `aria-label` ile gidiyor (6 Kasım,
     inceleme: rolsüz div'in `aria-label`ı ekran okuyucularca okunmuyordu;
     grup rolüyle ad, içindeki medyana girerken duyuluyor). */
  /* MEDYAN BİR DE ÇİZİM (10 Kasım). Bölme hap + tek cümleydi ve 1440'ta
     ~420 piksellik alanın yarısı boştu; "medyan endeksten ayrışabilir"
     cümlesi de neden ayrıştığını göstermiyordu. Yanına üyelerin günlük
     değişim DAĞILIMI geldi: yarım puanlık kutular, sıfırın solunda düşenler
     sağında yükselenler, medyan dağılımın üstünde bir im. Kaç şirketin ne
     kadar oynadığı ve medyanın nerede durduğu tek bakışta; veri medyanın
     kurulduğu aynı küme (`sameSessionMoves`), yani küme karışıksa çizim de
     yok. Kutular `changeHistogram` (lib/market-scales.ts, testli). */
  const histogram = !loading && medianMove !== null && moves && moves.length > 0 ? changeHistogram(moves) : null;
  return <div role="group" className={styles.toolbarIdentity} aria-label={`${label} · ${proxy}`} data-chart={histogram ? "" : undefined}>
    {loading ? <Skeleton className="h-7 w-48 max-w-full" /> : medianMove !== null ? (
      <div className={styles.selectedIndexReading}>
        <span className={styles.medianLabel}>{medianLabel}</span>
        <ChangePill changePct={medianMove} locale={locale} className={styles.medianPill} />
        <p className={styles.medianHint}>{t.markets.medianHint}</p>
      </div>
    ) : <span className={styles.selectedIndexEmpty}>{t.markets.medianMissing}</span>}
    {histogram && histogram.peak > 0 && medianMove !== null && (
      <figure
        className={styles.dist}
        role="img"
        aria-label={t.markets.distributionAria
          .replace("{n}", String(histogram.total))
          .replace("{median}", formatPercent(medianMove, locale))}
      >
        <div className={styles.distPlot} aria-hidden>
          {histogram.bins.map((bin) => (
            <span key={bin.from} className={styles.distSlot}>
              <i
                data-side={bin.side}
                data-empty={bin.count === 0 || undefined}
                data-motion-draw="bar"
                style={{ height: bin.count === 0 ? undefined : `${Math.max(6, (bin.count / histogram.peak) * 100).toFixed(1)}%` }}
              />
            </span>
          ))}
          <b className={styles.distMedian} style={{ left: `${(histogramShare(medianMove) * 100).toFixed(2)}%` }} />
        </div>
        <figcaption className={cn("numeral", styles.distAxis)} aria-hidden>
          <span>≤ {formatPercent(-HISTOGRAM_LIMIT, locale, 0)}</span>
          <span>{t.markets.distributionCaption}</span>
          <span>≥ {formatPercent(HISTOGRAM_LIMIT, locale, 0)}</span>
        </figcaption>
      </figure>
    )}
  </div>;
}

/**
 * Yükselenlerin payı — sekme satırının sağında, sıkı hâliyle (26 Eylül).
 * Büyük yüzde, üç renkli ray ve artı/yatay/eksi sayıları tek blokta.
 */
export function BreadthSummary({
  share, advancing, flat, declining, locale, t,
}: {
  share: number; advancing: number; flat: number; declining: number; locale: Locale; t: Dictionary;
}) {
  const parts = [
    { key: "up", value: advancing, fill: "bg-up", tone: "text-up", label: t.markets.advancing },
    { key: "flat", value: flat, fill: "bg-flat/50", tone: "text-muted", label: t.markets.unchanged },
    { key: "down", value: declining, fill: "bg-down", tone: "text-down", label: t.markets.declining },
  ];
  return (
    <div className={styles.shareBox}>
      <div className={styles.shareHead}>
        <span>{t.markets.advancingShare}</span>
        {/* SEKME DEĞİŞİNCE SAYI YUVARLANIR (10 Kasım): pay, seçimin ilk
            cevabı; sekmeye basınca Suspense sınırı yeniden bağlanıyor ve
            `RollingFigure` (CSS, sunucuda) o an bir kez dönüyor. Şerit ilk
            ekranda (1440×900'de y≈350), bileşenin kuralına uygun. */}
        <strong className="numeral"><RollingFigure value={formatPercentPlain(share, locale, 0)} /></strong>
      </div>
      {/* Ray TEK süpürmeyle açılıyor (14 Ekim). Üç dilimin her biri ayrı
          `bar-fill` + `data-motion-draw` taşıyordu ve her dilim KENDİ sol
          kenarından scaleX ile büyüyordu: flex kutuları yerinde durduğu
          için giriş "üç kopuk dilim" olarak okunuyordu. Süpürme rayın
          kendisinde (`rail-sweep`, MarketExperience.module.css). */}
      {/* YARI ÇİZGİSİ (10 Kasım). Ray payı gösteriyordu ama çoğunluğun
          hangi tarafta olduğu ancak "%39" okununca anlaşılıyordu. Rayın
          ortasında, onu 4'er piksel aşan bir çentik: yeşil dilim çentiği
          geçiyorsa çoğunluk artıda. Dilimler arasında 2 piksel boşluk;
          sayaçlar dilimlerin altında sayı önde (büyük, yön tonunda), ad
          arkada — "Artıda 39" yerine "39 Artıda". */}
      <div className={styles.breadthRailWrap} aria-hidden>
        <div className={styles.breadthRail}>
          {parts.map((part) => part.value > 0 && <span key={part.key} className={part.fill} style={{ flex: part.value }} />)}
        </div>
      </div>
      <dl className={styles.shareCounts}>
        {parts.map((part) => (
          <div key={part.key}>
            <dd className={cn("numeral", part.tone)}>
              {part.key === "up" && <TrendUp size={14} weight="bold" aria-hidden />}
              {part.key === "down" && <TrendDown size={14} weight="bold" aria-hidden />}
              {part.value}
            </dd>
            <dt>{part.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
