"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { CaretDown, CaretUp, CaretUpDown } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { RowFlip } from "@/components/markets/RowFlip";
import { FoldToggle } from "@/components/ui/FoldToggle";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { LogoTile } from "@/components/ui/primitives";
import type { MoveSet } from "@/lib/theme-stats";
import type { ThemeRow } from "@/lib/themes-data";
import {
  cn,
  directionOf,
  formatMoneyCompact,
  formatPercent,
  formatPrice,
  NO_VALUE,
} from "@/lib/utils";
import styles from "./ThemeTable.module.css";

/**
 * Tema tablosu — şirket, günlük değişim, son fiyat, piyasa değeri.
 *
 * TEK KATLI SATIR, TABLO AİLESİ (10 Kasım 2026, yeniden tasarım). Satır iki
 * katlıydı (sembol üstte, ad altta; sayının ALTINDA 96 piksellik ölçek
 * çubuğu): 21 üyeli Yarı İletkenler'de 55 piksel × 21 = 1.160 piksellik bir
 * duvar, Şirket adı ile Son Fiyat arasında ~440 piksel boş (1440, canlı).
 * Şimdi Piyasalar'ın Endeks Bileşenleri (components/markets/MembersTable)
 * ve Şirketler tablosuyla (components/companies/CompanyTable.module.css)
 * AYNI dil: 46 piksellik tek katlı satır, sembol ve ad aynı hatta, 40
 * piksellik batık başlık, değişim sayısının YANINDA sütunun esnek
 * genişliğini kaplayan ayrışan şerit (sıfır ortada; sıralı listede şeritler
 * alt alta tek bir dağılım çiziyor), piyasa değeri onluk eksende nokta
 * (`capAxis`, lib/market-scales.ts — doğrusal çubukta devin yanında on
 * dokuz üye 3 pikselin altında kalıyordu). Sütun sırası da aile ile aynı:
 * Değişim fiyattan önce. Stil kendi modülünde (ThemeTable.module.css);
 * ortak modüle terfi ana oturumun kararı.
 *
 * Kurallar (karşılaştırma tablosundan, değişmedi):
 *   - Karşılaştırılan büyüklük bir de ÇİZGİ. Son fiyatta çizgi YOK — farklı
 *     şirketlerin hisse fiyatı karşılaştırılabilir bir ölçü değil.
 *   - Kaydırma saklanmaz: 390'da Şirket sütunu yapışkan, Değişim ve Fiyat
 *     kaydırmadan okunuyor, piyasa değeri sağdaki solma kuşağında başlıyor.
 *
 * GÜNLÜK DEĞİŞİMİN SEANSI (Veri dürüstlüğü 4). Şerit yalnızca medyana giren
 * (aynı günü anlatan) satırlara basılıyor. Yüzdesi son kapanışa ait satırda
 * şeridin yerinde "Son Kapanış" yazıyor (640+); telefonda yazı sığmadığı
 * için kulvar KESİKLİ ve tablonun dibinde bir satır künye var. Renk son
 * kapanışta da işaretten (15 Ekim, sahibinin isteği).
 *
 * SIRALAMA İSTEMCİDE (28 Eylül). Yirmi satırlık bir tablo için sunucuya
 * dönmek ve adrese bir parametre eklemek gereksiz: adres ve arama motoruna
 * giden HTML aynı kalıyor (piyasa değerine göre), başlık yalnızca satırların
 * sırasını değiştiriyor. Ölçek oranları sıralamadan ÖNCE hesaplanıp satıra
 * bağlanıyor. 10 Kasım: satır kayması `motion` `layout` yerine sitenin
 * ortak FLIP yaprağıyla (`components/markets/RowFlip.tsx`): başlıktaki
 * bağlantıya basış anında satır konumlarını kaydediyor (`thead a`), yeni
 * sıra boyanmadan önce yalnız `translate` oynatıyor. Başlık bu yüzden bir
 * BAĞLANTI (`role="button"`; JS yokken tabloya çapa).
 *
 * KALABALIK TEMA KATLI (10 Kasım). On beşten fazla üyede ilk on iki satır
 * açık, kalanı JS'siz anahtarla (`FoldToggle`) yerinde açılıyor: satırlar
 * sunucuda yine çiziliyor. Dilim SIRALAMADAN SONRA: "En çok düşen on iki"
 * de okunur.
 *
 * ÖLÇÜT FONU SATIRI KALKTI (10 Kasım). Tablonun dibinde ayrı bir grup
 * olarak duruyordu (ölçeğe ve sıralamaya girmeden: bir fon ile şirketleri
 * aynı şeritte sıralamak, fonu sepetin bir üyesi gibi gösterirdi). Fon
 * artık kapakta, medyanın yanında ve şeritte bir im olarak (`ThemeReading`;
 * adı fonun sayfasına bağlantı): aynı yüzde sayfada iki kez yazılmıyor.
 */

/** Katlama eşiği ve açık satır sayısı. Yarı İletkenler 21 → 12 açık
    (966 → 552 piksel); 14 üyeli Bulut ve Yazılım katlanmıyor. */
const FOLD_OVER = 15;
const FOLD_ROWS = 12;
const SCOPE = "tema-uyeleri";

type SortKey = "company" | "day" | "price" | "cap";
type SortDir = "asc" | "desc";

/** İlk tıklamada hangi yön: sayılarda büyükten küçüğe, adda A'dan Z'ye. */
const FIRST_DIR: Record<SortKey, SortDir> = { company: "asc", price: "desc", day: "desc", cap: "desc" };

export function ThemeTable({
  rows,
  moves,
  token,
  locale,
  labels,
}: {
  rows: ThemeRow[];
  moves: MoveSet | null;
  /** Temanın kimliği: satır kayması başka temanın kaydıyla oynamasın. */
  token: string;
  locale: string;
  labels: {
    region: string;
    company: string;
    price: string;
    day: string;
    cap: string;
    lastClose: string;
    lastCloseNote: string;
    sortBy: string;
    showAll: string;
    showLess: string;
  };
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "cap", dir: "desc" });

  const { scaled, signed, anyStale } = useMemo(() => {
    const inScale = rows.map((row, i) => (moves?.included[i] && row.changePct !== null ? row.changePct : null));
    const peak = Math.max(0.01, ...inScale.map((value) => Math.abs(value ?? 0)));
    return {
      scaled: rows.map((row, i) => ({ row, ratio: inScale[i] === null ? null : Math.min(1, Math.abs(inScale[i]!) / peak) })),
      /* Listede eksi var mı — şeridin sıfırı ortada mı. */
      signed: inScale.some((value) => value !== null && value < 0),
      anyStale: rows.some((row, i) => row.changePct !== null && inScale[i] === null),
    };
  }, [rows, moves]);

  const sorted = useMemo(() => {
    const value = (row: ThemeRow): number | string | null =>
      sort.key === "company" ? row.symbol : sort.key === "price" ? row.price : sort.key === "day" ? row.changePct : row.marketCap;
    const factor = sort.dir === "asc" ? 1 : -1;
    /* Değeri olmayan satır yön ne olursa olsun sonda kalır. */
    return [...scaled].sort((a, b) => {
      const av = value(a.row);
      const bv = value(b.row);
      if (av === null && bv === null) return a.row.symbol.localeCompare(b.row.symbol);
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv)) * factor;
      return (av - bv) * factor;
    });
  }, [scaled, sort]);

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: FIRST_DIR[key] },
    );

  const header = (key: SortKey, label: string, className?: string, extra?: ReactNode) => {
    const active = sort.key === key;
    const Icon = active ? (sort.dir === "desc" ? CaretDown : CaretUp) : CaretUpDown;
    return (
      <th
        scope="col"
        className={cn(styles.sortCell, className)}
        data-active={active || undefined}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span className={styles.sortWrap}>
          <a
            href={`#${SCOPE}`}
            role="button"
            className={styles.sortLink}
            aria-label={labels.sortBy.replace("{column}", label)}
            onClick={(event: MouseEvent) => {
              event.preventDefault();
              toggle(key);
            }}
            onKeyDown={(event: KeyboardEvent) => {
              if (event.key !== " ") return;
              event.preventDefault();
              (event.currentTarget as HTMLElement).click();
            }}
          >
            {label}
            <Icon aria-hidden size={12} weight={active ? "fill" : "bold"} className={styles.sortIcon} />
          </a>
          {extra}
        </span>
      </th>
    );
  };

  const company = (row: ThemeRow) => (
    <th scope="row" className={styles.company}>
      {/* Bağlantı hücreyi dolduruyor: dokunma hedefi satır yüksekliği kadar.
          Şirket kartı: components/ui/CompanyCard.tsx. */}
      <Link href={`/hisse/${row.symbol}`} prefetch={false} className={styles.companyLink} data-cc={row.symbol}>
        <LogoTile symbol={row.symbol} logoUrl={row.logoUrl} size="md" className={styles.logo} />
        <span className={styles.companyText}>
          <span className={cn("numeral", styles.symbol)}>{row.symbol}</span>
          <span className={styles.name} title={row.name ?? undefined}>
            {row.name ?? NO_VALUE}
          </span>
        </span>
      </Link>
    </th>
  );

  const change = (row: ThemeRow, ratio: number | null, inScale: boolean) => {
    const tone = directionOf(row.changePct);
    return (
      <td className={styles.changeCell}>
        <span className={styles.change}>
          {row.changePct === null ? (
            <span />
          ) : inScale && ratio !== null ? (
            <span className={styles.lane} data-motion-track aria-hidden>
              {/* Tam %0: ray ve sıfır çizgisi var, dolgu yok — "değişmedi"
                  bir uzunluk değil. */}
              {row.changePct !== 0 && (
                <i
                  className={styles.fill}
                  data-tone={tone}
                  data-motion-draw="line"
                  style={{
                    width: `${(signed ? ratio * 50 : ratio * 100).toFixed(2)}%`,
                    transformOrigin: row.changePct < 0 ? "right center" : "left center",
                  }}
                />
              )}
            </span>
          ) : (
            <span className={styles.stale}>
              <span className={styles.staleText}>{labels.lastClose}</span>
              <span className={styles.staleLane} aria-hidden />
            </span>
          )}
          <span
            className={cn(
              "numeral",
              styles.changeNum,
              row.changePct === null ? "text-muted" : tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted",
            )}
          >
            {row.changePct === null ? NO_VALUE : formatPercent(row.changePct, locale)}
          </span>
        </span>
      </td>
    );
  };

  const hidden = rows.length > FOLD_OVER ? rows.length - FOLD_ROWS : 0;

  return (
    <div id={SCOPE} className={styles.wrap}>
      <RowFlip scope={SCOPE} token={token} order={`${sort.key}:${sort.dir}`} />
      <FoldToggle
        id="tema-uyeleri-kat"
        narrow={false}
        hiddenCount={hidden}
        more={labels.showAll.replace("{count}", String(rows.length))}
        less={labels.showLess}
      >
        <ScrollEdges
          fixedStart
          className={cn("scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)", styles.scroller)}
          tabIndex={0}
          role="region"
          aria-label={labels.region}
        >
          <table className={styles.table} data-signed={signed || undefined}>
            <thead>
              <tr>
                <th scope="col" className={styles.rankHead}>#</th>
                {header("company", labels.company, styles.companyHead)}
                {header("day", labels.day, styles.changeHead)}
                {header("price", `${labels.price} ($)`)}
                {/* PİYASA DEĞERİ DOĞRUDAN (10 Kasım, birleştirme): onluk eksendeki
                    nokta kalktı — sahibinin Endeks Bileşenleri kararı ("piyasa değerini
                    direkt yazsak daha doğru olacak"); aile tek dil konuşuyor. */}
                {header("cap", labels.cap, styles.capHead)}
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ row, ratio }, index) => (
                <tr key={row.symbol} data-row={row.symbol} data-fold={hidden > 0 && index >= FOLD_ROWS ? "" : undefined}>
                  <td className={cn("numeral", styles.rank)}>{index + 1}</td>
                  {company(row)}
                  {change(row, ratio, ratio !== null)}
                  <td className={cn("numeral", styles.price)}>
                    {row.price !== null ? formatPrice(row.price, locale) : NO_VALUE}
                  </td>
                  <td className={styles.capCell}>
                    <span className={styles.cap}>
                      <span className={cn("numeral", row.marketCap ? styles.capValue : "text-muted")}>
                        {row.marketCap ? formatMoneyCompact(row.marketCap, locale) : NO_VALUE}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollEdges>
      </FoldToggle>
      {anyStale && <p className={styles.note}>{labels.lastCloseNote}</p>}
    </div>
  );
}
