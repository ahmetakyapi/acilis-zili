import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, TrendDown, TrendUp } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ButtonLink, LogoTile } from "@/components/ui/primitives";
import { checkChartBlock } from "@/lib/daily-chart";
import { boardTiles, ringSlices, splitRows, type TileDir } from "@/lib/daily-chart-board";
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
  /** Grafiğin öznesi: karışık grafikte bir yanda TEK kalan kalem. */
  subject?: "up" | "down";
};

/** Sunucunun bastığı en çok satır; tabanın üstü `hidden` + `data-fill`. */
const ROW_CAP = 12;

type ThumbGroup = {
  /** Karışık grafikte yönün başlığı; tek listede yok. */
  dir: "up" | "down" | null;
  /** Grubun TAMAMI (basılmayanlar dahil) — başlıktaki sayaç. */
  total: number;
  rows: ThumbRow[];
  /** Her zaman açık satır sayısı; kalanı doldurucuya. */
  base: number;
};

/**
 * Grafiğin küçük hâli — ana sayfa paneli (24 Ekim; 31 Ekim'de yeniden;
 * 6 Kasım'da sıralı liste olarak yeniden).
 *
 * TAM GRAFİK DEĞİL, ŞEKLİ: `rows` satır taban; geri kalanı kolonda yer
 * varsa açılır, yoksa dipteki sayaç ve "Grafiği İncele" butonu söyler
 * (10 Kasım, aşağıda). 31 Ekim'de sahibinin itirazı: "bu böyle kabul edilemez,
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
 * sert düşüş başta.
 *
 * 10 KASIM 2026, SAHİBİNİN İTİRAZI: "'1 Kalem Daha' ne, gereksiz, onu
 * gösterme; sadece 1 tane düşen göstermeyi de bilemedim, daha mantıklı ele
 * al." Karışık grafik ORTADAN kesiliyordu (6 Kasım: "iki uç da hikâyedir"):
 * altı kalemde üç yükselen, ortada "1 Kalem Daha →" bağlantısı, altında bir
 * yükselen ve bağlamsız tek düşen. Sıralı listenin ortasındaki bağlantı
 * hem atlanan satırla aynı yeri kaplıyordu (40 piksel; satır 42) hem de
 * kesimin kuralını gizliyordu. Şimdi:
 *   · KARIŞIK grafik iki GRUP: "Yükselenler" ve "Düşenler", yan koldaki
 *     Günün Hareketleri'nin başlığıyla (yön ikonu, ad, sayaç) ve TEK
 *     ölçekte; sıfır çizgisi bütün satırlarda aynı x'te, düşen sola
 *     yükselen sağa. Grup içinde sıra büyüklükten: en sert düşüş başta.
 *     Kesim her grubun SONUNDAN (en ılımlı kalem), ortadan değil; taban
 *     satırlar iki yana paylaştırılır (`splitRows`), azınlık yan hiç
 *     düşmez.
 *   · Bir yanda TEK kalem, ötekinde en az iki kalem varsa o kalem grafiğin
 *     ÖZNESİ ("Nvidia Ters Yönde Geriledi"): satır yön yıkamasıyla vurgulu,
 *     adının üstünde "Tek Düşen" / "Tek Yükselen".
 *   · Ortadaki bağlantı YOK. Sığmayan satır varsa dipte sakin bir sayaç
 *     ("5 / 6 Kalem") ve her zaman grafiğin sayfasına giden tek buton.
 *     Sayaç CSS sayacı: `FillColumn` kolonda yer bulup satır açtığında
 *     (`hidden` + `data-fill`, sunucu `ROW_CAP` kadar basar) sayı kendisi
 *     artar, hepsi açılınca sayaç kalkar; JS kapalıyken taban doğru sayılır.
 *   · Satırlar opaklık 0'dan gelmiyor (`thumb-in` kalktı; metin kaymaz ve
 *     soluklaşarak girmez, `.claude/rules/hareket.md`): hareket çubukta.
 * Paylaşım görseli (`lib/daily-chart-og.tsx`) kendi kesimini korur.
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
  /** Arayüz dilindeki etiketler ("Grafiği İncele", "Değişim"). */
  labels: DailyChartLabels;
  /** Grafiğin sayfası — dipteki butonun hedefi. */
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

  /* GRUPLAR (10 Kasım, gerekçe yukarıda). Karışık işaretli çubuk grafik
     iki yöne ayrılır; öteki her şey (tek yönlü liste, pay, öncesi) tek
     liste. `mixed` yalnız iki yanda da kalem varken: hepsi artı + bir sıfır
     "Yükselenler" başlığı açmaz, sıfır kalem listenin sonunda durur. */
  const ups = items.filter((item) => item.dir === "up");
  const downs = items.filter((item) => item.dir === "down").reverse();
  const flats = items.filter((item) => item.dir === "flat");
  /* Üç kalemlik grafikte (1↑ 1↓ + sıfır) başlık kalemden çok yer tutardı:
     grup ancak bir yanda en az iki kalem ve toplam dört kalem varken. */
  const mixed = !oneSided && ups.length > 0 && downs.length > 0 && Math.max(ups.length, downs.length) >= 2 && items.length >= 4;
  let groups: ThumbGroup[];
  if (mixed) {
    if (downs.length === 1 && ups.length >= 2) downs[0] = { ...downs[0], subject: "down" };
    if (ups.length === 1 && downs.length >= 2) ups[0] = { ...ups[0], subject: "up" };
    const [upBase, downBase] = splitRows(ups.length, downs.length, rows);
    const spare = Math.max(0, rows - upBase - downBase);
    groups = [
      { dir: "up", total: ups.length, rows: ups, base: upBase },
      /* Sıfırda kalan kalem iki grubun arasında, başlıksız: ekseninin
         üstünde duruyor, yönü yok. Tabanda yalnız yer kalırsa. */
      { dir: null, total: flats.length, rows: flats, base: Math.min(flats.length, spare) },
      { dir: "down", total: downs.length, rows: downs, base: downBase },
    ].filter((group) => group.rows.length > 0) as ThumbGroup[];
  } else {
    groups = [{ dir: null, total: items.length, rows: items, base: Math.min(items.length, rows) }];
  }
  /* Tavan: tabanın üstündeki yedek satırlar sırayla dağıtılır (önce
     yükselenler), toplam `ROW_CAP`i geçmez. */
  let budget = ROW_CAP - groups.reduce((sum, group) => sum + group.base, 0);
  const printed = groups.map((group) => {
    const extra = Math.max(0, Math.min(group.rows.length - group.base, budget));
    budget -= extra;
    return { ...group, rows: group.rows.slice(0, group.base + extra) };
  });
  const total = items.length;
  const printedCount = printed.reduce((sum, group) => sum + group.rows.length, 0);
  const baseCount = printed.reduce((sum, group) => sum + group.base, 0);

  let order = 0;
  const row = (item: ThumbRow, hidden: boolean) => {
    const index = order++;
    const code = item.symbol ?? item.fund;
    const body = (
      <>
        {!item.bare && (
          <span className={styles.thumbMark} aria-hidden>
            <Mark item={item} logos={logos} locale={locale} />
          </span>
        )}
        <span className={styles.thumbName}>
          {item.subject && (
            <span className={styles.thumbRole} data-tone={item.subject}>
              {item.subject === "down" ? labels.home.onlyDown : labels.home.onlyUp}
            </span>
          )}
          {item.name}
          {code && <span className={styles.thumbCode}>{code}</span>}
        </span>
        <span className={styles.thumbValue} data-tone={item.dir === "flat" ? undefined : item.dir}>
          {item.display}
        </span>
        {/* ORTAK DEĞER ÇUBUĞU (11 Kasım): kulvar 5, çubuk 8, sıfır çizgisi
            ortak çentik — gerekçe DailyChart.module.css → "ORTAK SINIFLAR". */}
        {item.bar && (
          <span className={`value-lane ${styles.lane}`} aria-hidden>
            {item.bar.size > 0 && (
              <span
                className={`value-bar bar-fill ${styles.bar}`}
                data-tone={item.dir === "flat" ? undefined : item.dir}
                data-neutral={item.dir === "flat" ? "" : undefined}
                data-end={zero !== null && item.dir === "down" ? "start" : "end"}
                style={{ left: `${item.bar.start}%`, width: `${item.bar.size}%` }}
              />
            )}
            {zero !== null && <span className="value-notch" data-quiet="" style={{ left: `${zero}%` }} />}
          </span>
        )}
      </>
    );
    const rowProps = {
      className: styles.thumbRow,
      "data-row": "",
      "data-bar": item.bar ? "" : undefined,
      "data-bare": item.bare ? "" : undefined,
      "data-subject": item.subject,
    };
    return (
      /* Yedek satır `hidden` + `data-fill`: `FillColumn` kolonda yer varsa
         açar (hidrasyondan önce de dokunabilir; uyarı bilerek susturuldu,
         `DayMovers` ile aynı kalıp). */
      <li
        key={`${index}-${item.name}`}
        style={{ "--i": index } as CSSProperties}
        data-fill={hidden ? "" : undefined}
        hidden={hidden}
        suppressHydrationWarning
      >
        {code ? (
          <Link href={`/hisse/${code}`} prefetch={false} {...rowProps}>
            {body}
          </Link>
        ) : (
          <div {...rowProps}>{body}</div>
        )}
      </li>
    );
  };

  const [countLead, countTail] = labels.home.count.replace("{total}", String(total)).split("{shown}");
  return (
    <div className={styles.thumb} data-draw data-cut={printedCount < total ? "" : undefined}>
      {strip}
      {printed.map((group, at) => {
        const list = (
          <ol className={styles.thumbList} aria-label={group.dir ? undefined : label}>
            {group.rows.map((item, index) => row(item, index >= group.base))}
          </ol>
        );
        if (!group.dir) return <div key={at}>{list}</div>;
        const heading = group.dir === "up" ? labels.home.up : labels.home.down;
        return (
          <div key={at} role="group" aria-label={heading} className={styles.thumbGroup}>
            {/* Başlık satırla aynı ızgarada: ikon işaret sütununda, ad
                adların, sayaç değerlerin hattında (`DayMovers` kalıbı). */}
            <p className={styles.groupHead}>
              <span className={styles.groupIcon} data-tone={group.dir} aria-hidden>
                {group.dir === "up" ? <TrendUp size={16} weight="bold" /> : <TrendDown size={16} weight="bold" />}
              </span>
              <span className={styles.groupLabel}>{heading}</span>
              <span className={`numeral ${styles.groupCount}`}>{labels.home.groupCount.replace("{n}", String(group.total))}</span>
            </p>
            {list}
          </div>
        );
      })}
      {foot}
      {/* DİP: sayaç yalnız gizli satır varken (CSS, DailyChart.module.css →
          "DİP"), buton her zaman. `data-base`: JS'siz sayfada sayacın
          göstereceği sayı CSS sayacından; öznitelik ölçüm ve test için. */}
      <div className={styles.thumbEnd} data-base={baseCount}>
        <span className={`numeral ${styles.thumbCount}`}>
          {countLead}
          <i aria-hidden />
          {countTail}
        </span>
        <ButtonLink href={href} prefetch={false} variant="ghost" size="sm" className={styles.thumbOpen}>
          {labels.home.open}
          <ArrowRight size={12} weight="bold" aria-hidden />
        </ButtonLink>
      </div>
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
