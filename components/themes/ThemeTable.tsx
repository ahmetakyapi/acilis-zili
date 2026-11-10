"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { CaretDown, CaretUp, CaretUpDown } from "@phosphor-icons/react/dist/ssr";
import { BoardSortMenu, CompanyCell, MoveFigure, board, phoneSlots, rowStep } from "@/components/markets/BoardTable";
import { RowFlip, RowTap } from "@/components/markets/RowFlip";
import { FoldToggle } from "@/components/ui/FoldToggle";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import type { Locale } from "@/lib/i18n";
import { DAY_LANE_SPAN, laneOver, laneSpan } from "@/lib/market-scales";
import type { MoveSet } from "@/lib/theme-stats";
import type { ThemeRow } from "@/lib/themes-data";
import { cn, formatMoneyCompact, formatPercentPlain, formatPrice, NO_VALUE } from "@/lib/utils";
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
 * ORTAK PARÇAYA GEÇTİ (10 Kasım gece, ana oturumun kararı). Yukarıdaki
 * "terfi" yapıldı: başlık, sıralama imi, kimlik hücresi, kalın çubuk, sayı
 * ölçüleri, satır cevabı ve künye artık `components/markets/BoardTable`ın
 * parçaları (`board` sınıfları, `CompanyCell`, `MoveFigure`); bu tablonun
 * kopya CSS'i silindi (195 satır → sütun düzeni). Aile ölçüleri: satır 62
 * (telefonda 56), logo 40 / 32, sembol 16/700, ad 14 gövde, yüzde 19/700,
 * fiyat 16/700, piyasa değeri 15/600. Değişenler:
 *   - Fiyat 15/600 → 16/700, piyasa değeri 15/700 → 15/600 (ailenin
 *     hiyerarşisi: yüzde > fiyat > değer).
 *   - Şerit ölçeği: üyelerin EN BÜYÜK hareketi → `laneSpan` (üyelerin 90.
 *     yüzdeliğinin basamağı, taban ±%3; Endeks Bileşenleri'yle aynı
 *     fonksiyon). En büyüğe göre ölçekte tek bir %12'lik üye öteki yirmisini
 *     çizgiye indiriyordu; şimdi o üye kola dayanır, ucu kesik. Ölçek
 *     tablonun dibindeki künyede yazıyor. Sıralama istemcide ve ölçek
 *     sıralamaya bağlı DEĞİL (hep "body"): başlığa basınca çubuklar yeniden
 *     çizilmez, yalnız satırlar kayar.
 *   - Sıfır HER ZAMAN ortada (ailenin kuralı; önce listede eksi yoksa şerit
 *     soldan başlıyordu ve aynı %1 temadan temaya başka yere düşüyordu).
 *   - Satırın tamamı hisse sayfasına gider (`RowTap`), sıralı sütun gövdede
 *     de tonlu (`data-sorted`), çizim kapısı satırda (`data-draw`).
 * Şerit yine sütunun ESNEK genişliğinde (tabloda dört sütun var; ailenin
 * 72–120 piksellik sabit kulvarıyla Şirket ile Değişim arasında ~600 piksel
 * boş kalırdı): `--day-lane` burada `minmax(…,1fr)`.
 *
 * Kurallar (karşılaştırma tablosundan, değişmedi):
 *   - Karşılaştırılan büyüklük bir de ÇİZGİ. Son fiyatta çizgi YOK — farklı
 *     şirketlerin hisse fiyatı karşılaştırılabilir bir ölçü değil.
 *   - Kaydırma saklanmaz: 390'da Şirket sütunu yapışkan, Değişim ve Fiyat
 *     kaydırmadan okunuyor, piyasa değeri sağdaki solma kuşağında başlıyor.
 *     TARİHÇE (10 Kasım gece, son tur; sahibinin sözü: "tablolar sağa sola
 *     kaymasın"): kaydırma kalktı. Telefonda kompakt liste (kimlik +
 *     sıralanan ölçü + günlük yüzde, sıralama şeritteki menüden),
 *     640–767'de sıra numarası düşer; hiçbir genişlikte kap kaymıyor
 *     (ölçüm ThemeTable.module.css → "ÖLÇÜM 4").
 *
 * GÜNLÜK DEĞİŞİMİN SEANSI (Veri dürüstlüğü 4). Şerit yalnızca medyana giren
 * (aynı günü anlatan) satırlara basılıyor. Yüzdesi son kapanışa ait satırda
 * şeridin yerinde "Son Kapanış" yazıyor (640+); telefonda yazı sığmadığı
 * için kulvar KESİKLİ ve tablonun dibinde bir satır künye var. Renk son
 * kapanışta da işaretten (15 Ekim, sahibinin isteği). (`MoveFigure note`.)
 *
 * SIRALAMA İSTEMCİDE (28 Eylül). Yirmi satırlık bir tablo için sunucuya
 * dönmek ve adrese bir parametre eklemek gereksiz: adres ve arama motoruna
 * giden HTML aynı kalıyor (piyasa değerine göre), başlık yalnızca satırların
 * sırasını değiştiriyor. 10 Kasım: satır kayması `motion` `layout` yerine
 * sitenin ortak FLIP yaprağıyla (`components/markets/RowFlip.tsx`): başlıktaki
 * bağlantıya basış anında satır konumlarını kaydediyor (`thead a`), yeni
 * sıra boyanmadan önce yalnız `translate` oynatıyor. Başlık bu yüzden bir
 * BAĞLANTI (`role="button"`; JS yokken tabloya çapa) ve ortak parçanın
 * `BoardSortHead`i değil: o bir adrese gider, bu durumu değiştirir. Sınıfları
 * ortak (`board.sortCell`…), görünüm aynı.
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
    (966 → 552 piksel; gece turunda satır 62: 744); 14 üyeli Bulut ve
    Yazılım katlanmıyor. */
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
  locale: Locale;
  labels: {
    region: string;
    company: string;
    price: string;
    day: string;
    cap: string;
    lastClose: string;
    lastCloseNote: string;
    /** "Şeridin tam boyu …{day}" — tablonun gerçek ölçeği. */
    scaleNote: string;
    overNote: string;
    sortBy: string;
    /** Telefondaki sıralama şeridi: "Sırala", yön adları (BoardSortMenu). */
    phoneSort: string;
    /** Şeridin sağındaki künyede günlük değişimin kısa adı ("Değişim"). */
    dayShort: string;
    sortAsc: string;
    sortDesc: string;
    showAll: string;
    showLess: string;
  };
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "cap", dir: "desc" });

  /* Ölçeğe yalnız medyana giren (aynı seansı anlatan) satırlar girer. */
  const { scaled, span, anyStale, anyOver } = useMemo(() => {
    const inScale = rows.map((row, i) => Boolean(moves?.included[i]) && row.changePct !== null);
    const full = laneSpan(rows.map((row, i) => (inScale[i] ? row.changePct : null)), DAY_LANE_SPAN);
    return {
      scaled: rows.map((row, i) => ({ row, inScale: inScale[i] })),
      span: full,
      anyStale: rows.some((row, i) => row.changePct !== null && !inScale[i]),
      anyOver: rows.some((row, i) => inScale[i] && laneOver(row.changePct!, full)),
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

  const header = (key: SortKey, label: string, className?: string) => {
    const active = sort.key === key;
    const Icon = active ? (sort.dir === "desc" ? CaretDown : CaretUp) : CaretUpDown;
    return (
      <th
        scope="col"
        className={cn(board.sortCell, className)}
        data-active={active || undefined}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span className={board.sortWrap}>
          <a
            href={`#${SCOPE}`}
            role="button"
            className={cn(board.sortLink, styles.sortButton)}
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
            <Icon aria-hidden size={12} weight={active ? "fill" : "bold"} className={board.sortIcon} />
          </a>
        </span>
      </th>
    );
  };

  const hidden = rows.length > FOLD_OVER ? rows.length - FOLD_ROWS : 0;
  const leadSort = sort.key === "day";
  /* TELEFONDA KOMPAKT LİSTE (10 Kasım gece, son tur; sahibinin sözü:
     "tablolar sağa sola kaymasın, kompakt olsun"). Satırın sağında iki
     sayı: üstte sıralanan ölçü (varsayılan piyasa değeri), altında günlük
     yüzde; ada ya da değişime göre diziliyse yüzde + fiyat (`phoneSlots`,
     components/markets/BoardTable.tsx). Sıralama başlık satırı yerine
     şeritteki menüden, aynı `toggle` ile. */
  const lead: SortKey = sort.key === "company" ? "day" : sort.key;
  const second: SortKey = lead === "day" ? "price" : "day";
  const slot = phoneSlots(lead, second);
  const slotLabel: Record<SortKey, string> = { company: labels.company, day: labels.day, price: labels.price, cap: labels.cap };

  return (
    <div id={SCOPE} className={styles.wrap}>
      <RowFlip scope={SCOPE} token={token} order={`${sort.key}:${sort.dir}`} />
      <RowTap scope={SCOPE} />
      <BoardSortMenu
        items={(["cap", "day", "price", "company"] as SortKey[]).map((key) => ({ key, label: slotLabel[key], active: sort.key === key }))}
        dir={sort.dir}
        label={labels.phoneSort}
        caption={[lead, second].map((key) => (key === "day" ? labels.dayShort : slotLabel[key])).join(" · ")}
        ascLabel={labels.sortAsc}
        descLabel={labels.sortDesc}
        onSelect={(key) => toggle(key as SortKey)}
      />
      <FoldToggle
        id="tema-uyeleri-kat"
        narrow={false}
        hiddenCount={hidden}
        more={labels.showAll.replace("{count}", String(rows.length))}
        less={labels.showLess}
      >
        <ScrollEdges
          fixedStart
          className={cn("scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)", board.scroller)}
          tabIndex={0}
          role="region"
          aria-label={labels.region}
        >
          <table className={cn(board.table, styles.table)}>
            <thead>
              <tr>
                <th scope="col" className={board.rankHead}>#</th>
                {header("company", labels.company, board.companyHead)}
                {header("day", labels.day, styles.changeHead)}
                {header("price", `${labels.price} ($)`, styles.priceHead)}
                {/* PİYASA DEĞERİ DOĞRUDAN (10 Kasım, birleştirme): onluk eksendeki
                    nokta kalktı — sahibinin Endeks Bileşenleri kararı ("piyasa değerini
                    direkt yazsak daha doğru olacak"); aile tek dil konuşuyor. */}
                {header("cap", labels.cap, styles.capHead)}
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ row, inScale }, index) => (
                <tr
                  key={row.symbol}
                  data-row={row.symbol}
                  data-fold={hidden > 0 && index >= FOLD_ROWS ? "" : undefined}
                  /* İlk üç yalnız değişime göre sıralıyken; çizim kapısı ve
                     kademe satırda — gerekçeleri MembersTable.tsx'te. */
                  data-lead={leadSort && index < 3 ? "" : undefined}
                  data-draw
                  style={rowStep(index)}
                >
                  <td className={cn("numeral", board.rank)}>{index + 1}</td>
                  <CompanyCell symbol={row.symbol} name={row.name ?? NO_VALUE} logoUrl={row.logoUrl} />
                  <td className={styles.changeCell} data-sorted={sort.key === "day" || undefined} data-slot={slot("day")}>
                    <MoveFigure
                      value={row.changePct}
                      span={span}
                      note={row.changePct !== null && !inScale ? labels.lastClose : undefined}
                      locale={locale}
                    />
                  </td>
                  <td className={cn("numeral", board.price, styles.priceCell, row.price === null && board.none)} data-sorted={sort.key === "price" || undefined} data-slot={slot("price")}>
                    {row.price !== null ? formatPrice(row.price, locale) : NO_VALUE}
                  </td>
                  <td className={cn("numeral", board.strong, styles.capCell, !row.marketCap && board.none)} data-sorted={sort.key === "cap" || undefined} data-slot={slot("cap")}>
                    {row.marketCap ? formatMoneyCompact(row.marketCap, locale) : NO_VALUE}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollEdges>
      </FoldToggle>
      {/* KÜNYE: şeridin gerçek ölçeği; taşan varsa kesik ucun anlamı; son
          kapanış satırı varsa (telefonda yazısı yok) onun cümlesi. */}
      <p className={board.note}>
        {labels.scaleNote.replace("{day}", `±${formatPercentPlain(span, locale, 0)}`)}
        {anyOver && ` ${labels.overNote}`}
        {anyStale && <span className={styles.staleNote}>{` ${labels.lastCloseNote}`}</span>}
      </p>
    </div>
  );
}
