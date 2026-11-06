import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import { checkChartBlock } from "@/lib/daily-chart";
import { boardTiles, ringSlices, type TileDir } from "@/lib/daily-chart-board";
import type { DailyChartLabels } from "@/lib/i18n/dictionaries/daily-chart";
import { formatPercent } from "@/lib/utils";
import { SECTOR_ICONS } from "./sector-icons";
import styles from "./DailyChart.module.css";

/** `oncesi` değişimi tek ondalık (sayfanın `ShiftTiles`ıyla aynı). */
const DELTA_DIGITS = 1;

type ThumbRow = {
  name: string;
  display: string;
  /** Kulvardaki çubuk: alanın yüzdesi olarak başlangıç ve boy. */
  bar: { start: number; size: number } | null;
  dir: TileDir;
  fund: string | null;
  symbol: string | null;
  /** Pay dilimi: karonun tonu (1–4, 0 = "diğer"); pay değilse yok. */
  tone?: number;
  /** Karo sütunu yok: `oncesi`nin iki hâli ("22 Eylül", "23 Ekim") bir
      kimlik taşımıyor; baş harf karosu orada "2" gibi anlamsız bir sayıydı. */
  bare?: boolean;
};

/**
 * Grafiğin küçük hâli — ana sayfa paneli (24 Ekim; 31 Ekim'de yeniden;
 * 6 Kasım'da sıralı liste olarak yeniden).
 *
 * TAM GRAFİK DEĞİL, ŞEKLİ: `rows` satır, geri kalanı "N Kalem Daha"
 * bağlantısıyla. 31 Ekim'de sahibinin itirazı: "bu böyle kabul edilemez,
 * logolar olsun, daha görsel ve anlaşılır." Eskiden satır düz metin addı
 * ("Advanced Micro De…" kesik), sayı birimsizdi ("-28,58"), katlanan
 * satırlar ortada çıplak bir "+3"tü. Bunlar korunuyor:
 *   · hisse kaleminde şirket logosu ve sembolü (`memberSymbolOf`, yalnız
 *     tek anlamlı eşleşme), sektörde simgesi;
 *   · ad kesilmez (iki satıra iner), değer birimiyle ("−%28,58").
 *
 * 6 KASIM, SAHİBİNİN İTİRAZI: "burası asla sitedeki görsel uyuma ve
 * düzenine uymuyor, çok kötü gözüküyor." 31 Ekim hâlinde ölçüldü (420
 * piksellik sağ kolon, 5 satır): satır 33 + 12 piksel boşluk, kulvar adın
 * altında logodan kopuk ikinci bir satır; tek yönlü düşüş listesinde çubuk
 * SAĞA yaslıydı (ölçek sıfırı sağ uçta — sayfanın iki yönlü ekseni) ve en
 * az düşenin çubuğu en uzun gri kulvarla başlıyordu; eşlenemeyen satırda
 * logo sütunu boş bir delikti; sembol mono ve adın uzağında. Şimdi satır
 * Günün Hareketleri listesinin kalıbında (`DayMovers`): 26 piksellik karo
 * iki satırı birden kaplar (ad + kulvar), ad ve sembol tek hatta, değer
 * sağda aynı hatta, satır hisse sayfasına bağlantı (sektörde fon sayfası)
 * ve bütün satır ışıklanır. Satır 42 piksel, aralık 0 (ölçüm
 * `DailyChart.module.css` → KÜÇÜK GRAFİK).
 *
 * ÇUBUK SIFIRDAN (6 Kasım). Tek yönlü grafikte (hepsi eksi / hepsi artı)
 * çubuk SOLDAN başlar, boyu büyüklük, en büyük değer tam boy; renk yalnız
 * işaretten. Karışık grafikte sıfır kulvarın içinde (`--line-strong`
 * çizgi), eksi sola artı sağa — iki yönü tek ölçekte okumanın yolu bu.
 * Ölçek yine grubun TAMAMINDAN (`boardTiles`; gösterilmeyen satırlar
 * dahil): tek yönlüde `divergingScale`in boyu |değer| / en büyük |değer|,
 * yani sayfanın kartlarıyla aynı oran, yalnız yaslandığı uç farklı.
 *
 * Eşlenemeyen satırın karosu adın baş harfi, çökük zeminde (yer tutucu;
 * sembol uydurulmuyor, sütun boş delik de kalmıyor).
 *
 * Sıra sayfanın kartlarıyla aynı hesap (`boardTiles`): düşüş listesinde en
 * sert düşüş başta. Kesim: tek yönlü grafikte hikâye baştadır, ilk `rows`
 * satır kalır ve bağlantı sonda; karışık grafikte iki uç da hikâyedir,
 * kesim ORTADAN (paylaşım görseli aynı kuralla, `lib/daily-chart-og.tsx`).
 *
 * Bozuk blok hiçbir şey çizmez: yazma yolu bozuk bloğu zaten kabul etmiyor,
 * ama elle düzeltilmiş eski bir kayıt kartı kırmasın.
 */
export function ChartThumb({
  chartMd,
  locale,
  rows = 5,
  logos,
  labels,
  href,
  label,
}: {
  chartMd: string;
  /** Kaydın dili (sayıların yazılışı). */
  locale: string;
  rows?: number;
  /** Sembol → logo adresi (`getChartLogos`); yoksa depodaki logo. */
  logos?: Record<string, string | null>;
  /** Arayüz dilindeki etiketler ("{n} Kalem Daha", "Değişim"). */
  labels: DailyChartLabels;
  /** Grafiğin sayfası — katlanan satırların bağlantısı. */
  href: string;
  /** Listenin ekran okuyucu adı (bloğun etiketi). */
  label: string;
}) {
  const check = checkChartBlock(chartMd, locale);
  if (!check.ok) return null;
  const { block } = check;

  let items: ThumbRow[];
  let oneSided = true;
  let zero: number | null = null;
  let strip: ReactNode = null;
  let foot: ReactNode = null;

  if (block.kind === "share") {
    /* Pay: bütün TEK şeritte (dilimler arası 2 piksel zemin), satırda
       dilimin ton karosu; satır kulvarı yok — şerit zaten büyüklüğü çiziyor. */
    const slices = ringSlices(block.items);
    if (slices.length === 0) return null;
    strip = (
      <div className={styles.shareStrip} aria-hidden>
        {slices.map((slice, index) => (
          <span key={index} style={{ width: `${slice.part}%`, background: toneVar(slice.tone) }} />
        ))}
      </div>
    );
    items = slices.map((slice) => ({
      name: slice.name,
      display: slice.display,
      bar: null,
      dir: "flat" as const,
      fund: null,
      symbol: null,
      tone: slice.tone,
    }));
  } else if (block.kind === "bars") {
    const board = boardTiles(block, locale);
    oneSided = board.trend !== "mixed" || !board.signed;
    const peak = Math.max(...board.tiles.map((tile) => Math.abs(tile.value)), 0);
    zero = !oneSided && board.scale ? board.scale.zero : null;
    items = board.tiles.map((tile) => ({
      name: tile.name,
      display: tile.display,
      /* Tek yönlü: soldan, |değer| / en büyük (gerekçe yukarıda). */
      bar: !tile.bar ? null : oneSided ? { start: 0, size: peak > 0 ? (Math.abs(tile.value) / peak) * 100 : 0 } : tile.bar,
      dir: board.signed ? tile.dir : "flat",
      fund: tile.fund,
      symbol: tile.symbol,
    }));
  } else {
    /* `oncesi` yön taşımıyor (iki hâlin büyüklüğü): iki çubuk da nötr ton;
       değişim satırın altında, hairline'la ayrılmış künye. */
    const peak = Math.max(Math.abs(block.from.value ?? 0), Math.abs(block.to.value ?? 0), 0.01);
    items = [block.from, block.to].map((side) => ({
      name: side.label,
      display: side.display,
      bar: { start: 0, size: (Math.abs(side.value ?? 0) / peak) * 100 },
      dir: "flat" as const,
      fund: null,
      symbol: null,
      bare: true,
    }));
    if (block.deltaPct !== null) {
      const tone = block.deltaPct > 0 ? "up" : block.deltaPct < 0 ? "down" : undefined;
      foot = (
        <div className={styles.thumbFoot}>
          <span>{labels.board.shiftChange}</span>
          <span className={styles.thumbValue} data-tone={tone}>
            {formatPercent(block.deltaPct, locale, DELTA_DIGITS)}
          </span>
        </div>
      );
    }
  }

  const cut = items.length > rows;
  const headCount = !cut ? items.length : oneSided ? rows : Math.ceil(rows / 2);
  const head = items.slice(0, headCount);
  const tail = cut && !oneSided ? items.slice(items.length - (rows - headCount)) : [];
  const rest = items.length - head.length - tail.length;
  /* Katlanan satırlar (31 Ekim → 6 Kasım): önce satır başında yalnız "+6",
     sonra kesik çizginin ortasında "+3", sonra kesik çizgili "3 Kalem
     Daha" künyesi. Künye tıklanmıyordu ve kesik çizgi sitenin başka hiçbir
     listesinde yok. Artık grafiğin sayfasına giden bir BAĞLANTI, adın
     hizasında: karışık grafikte iki ucun arasında, tek yönlüde sonda. */
  const more = rest > 0 && (
    <li key="rest" className={styles.moreRow}>
      <Link href={href} prefetch={false} className={styles.more}>
        {labels.board.moreRows.replace("{n}", String(rest))}
        <ArrowRight size={12} weight="bold" aria-hidden />
      </Link>
    </li>
  );

  const row = (item: ThumbRow, index: number) => {
    const code = item.symbol ?? item.fund;
    const body = (
      <>
        {!item.bare && (
          <span className={styles.thumbMark} aria-hidden>
            <Mark item={item} logos={logos} locale={locale} />
          </span>
        )}
        <span className={styles.thumbName}>
          {item.name}
          {code && <span className={styles.thumbCode}>{code}</span>}
        </span>
        <span className={styles.thumbValue} data-tone={item.dir === "flat" ? undefined : item.dir}>
          {item.display}
        </span>
        {item.bar && (
          <span
            className={styles.lane}
            data-zero={zero !== null ? "" : undefined}
            style={zero !== null ? ({ "--zero": `${zero}%` } as CSSProperties) : undefined}
            aria-hidden
          >
            {item.bar.size > 0 && (
              <span
                className={styles.bar}
                data-tone={item.dir === "flat" ? "neutral" : item.dir}
                data-from={zero !== null && item.dir === "down" ? "right" : undefined}
                style={{ left: `${item.bar.start}%`, width: `${item.bar.size}%` }}
              />
            )}
          </span>
        )}
      </>
    );
    return (
      <li key={`${index}-${item.name}`} style={{ "--i": index } as CSSProperties}>
        {code ? (
          <Link href={`/hisse/${code}`} prefetch={false} className={styles.thumbRow} data-row="" data-bar={item.bar ? "" : undefined} data-bare={item.bare ? "" : undefined}>
            {body}
          </Link>
        ) : (
          <div className={styles.thumbRow} data-row="" data-bar={item.bar ? "" : undefined} data-bare={item.bare ? "" : undefined}>
            {body}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className={styles.thumb}>
      {strip}
      <ol className={styles.thumbList} aria-label={label}>
        {head.map(row)}
        {!oneSided && more}
        {tail.map((item, index) => row(item, head.length + index))}
        {oneSided && more}
      </ol>
      {foot}
    </div>
  );
}

function toneVar(tone: number): string {
  return tone === 0 ? "var(--share-rest)" : `var(--share-${tone})`;
}

function Mark({ item, logos, locale }: { item: ThumbRow; logos?: Record<string, string | null>; locale: string }) {
  if (item.symbol) return <LogoTile symbol={item.symbol} logoUrl={logos?.[item.symbol] ?? null} size="sm" />;
  const Icon = item.fund ? SECTOR_ICONS[item.fund] : undefined;
  if (Icon) {
    return (
      <span className={styles.thumbIcon}>
        <Icon size={15} weight="duotone" />
      </span>
    );
  }
  if (item.tone !== undefined) return <span className={styles.thumbSwatch} style={{ background: toneVar(item.tone) }} />;
  return (
    <span className={styles.thumbInitial}>
      {Array.from(item.name.trim())[0]?.toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US") ?? ""}
    </span>
  );
}
