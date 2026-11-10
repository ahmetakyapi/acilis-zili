import type { CSSProperties, ReactNode } from "react";
import { CaretDown, CaretUp, CaretUpDown } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, Skeleton } from "@/components/ui/primitives";
import type { Locale } from "@/lib/i18n";
import { BIG_MOVE, DAY_LANE_SPAN, WEEK_LANE_SPAN, drawStep, laneArm, laneOver, rangeShare } from "@/lib/market-scales";
import { cn, directionOf, formatPercent, formatPrice, NO_VALUE } from "@/lib/utils";
import styles from "./BoardTable.module.css";

/**
 * Pano tablosunun ortak parçaları (10 Kasım 2026, gece).
 *
 * Endeks Bileşenleri (`MembersTable.tsx`) ve Şirketler dizini
 * (`app/(app)/sirketler/page.tsx`) aynı satırı iki kez yazıyordu; ölçüler
 * ilk günden ayrıştı (gerekçe ve görsel dil BoardTable.module.css başında).
 * Buradaki parçalar SUNUCU bileşenidir, veri almaz: çağıran kendi satırını
 * kurar, hücreyi buradan basar. Tablo iskeleti (`<table>`, sütun sırası,
 * hangi sütunun basılacağı) çağıranda kalır — iki tablonun sütunları aynı
 * değil ve "eksik veri sütun basmaz" kararları veriye bağlı.
 *
 * Stil sınıfları da buradan dışa açılır (`board`): çağıran modülü yalnız
 * sütun genişliği ve değişken taşır.
 */
export { styles as board };
export { BoardSortMenu, type BoardSortItem } from "./BoardSortMenu";

export type SortDirection = "asc" | "desc";

/**
 * Telefonda satırın sağ sütunu (10 Kasım 2026, gece; sahibinin sözü:
 * "listeleri kaydırmadan kullanalım, kompakt olsun, yeterli bilgi
 * gözüksün"). <640'ta tablo kompakt LİSTE: solda kimlik, sağda iki sayı
 * üst üste (BoardTable.module.css → "TELEFON: KOMPAKT LİSTE"). Hangi iki
 * hücrenin görüneceğini çağıran söyler: `a` üstte, iri (okurun SIRALADIĞI
 * ölçü — piyasa değerine göre dizdiyse piyasa değeri), `b` altında (çoğu
 * zaman günlük değişim ya da fiyat). Öteki hücreler telefonda basılı ama
 * `display:none`; 640+ hepsi tabloda yerinde.
 *
 *   <td data-slot={slot("cap")}>  →  "a" | "b" | undefined
 */
export function phoneSlots(lead: string, second: string) {
  return (key: string): "a" | "b" | undefined => (key === lead ? "a" : key === second ? "b" : undefined);
}

/**
 * Sıralama başlığı.
 *
 * SIRALAMA DURUMU ÜÇ HÂL (10 Kasım). Üçgen glifleri (▼ ▲ ▽) 8 piksellik
 * `text-micro` ile basılıyordu: sıralı sütun ötekilerden yalnız renkle
 * ayrışıyor, sırasız sütunların içi boş üçgeni "açılır menü" gibi
 * okunuyordu. Şimdi ikon: sıralı sütunda yönü gösteren dolu ok ve başlığın
 * altında 2 piksellik mavi çizgi (`data-active`), ötekilerde sönük çift ok;
 * üzerine gelince koyulaşıyor.
 */
export function BoardSortHead({
  label,
  href,
  active,
  dir,
  className,
  hint,
  children,
}: {
  label: string;
  href: string;
  active: boolean;
  dir: SortDirection;
  className?: string;
  /** Başlığın neyi ölçtüğü — kısaltılmış etiketlerde tanım (`title`). */
  hint?: string;
  /** Başlığın yanındaki ek (piyasa değeri sütununda "Pay" alt başlığı). */
  children?: ReactNode;
}) {
  const Icon = active ? (dir === "desc" ? CaretDown : CaretUp) : CaretUpDown;
  return (
    <th
      scope="col"
      /* Sıralı sütun rengi ve `aria-hidden` bir üçgenle anlatılıyordu; ikisi
         de yardımcı teknolojiye ulaşmıyor — ekran okuyucu kullanıcısı
         tablonun neye göre dizildiğini hiç öğrenemiyordu. `aria-sort` bunu
         doğrudan söylüyor. */
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
      className={cn(styles.sortCell, className)}
      data-active={active || undefined}
    >
      <span className={styles.sortWrap}>
        {/* scroll={false}: sıralama bir gezinme değil, aynı tablonun yeniden
            dizilmesi. Varsayılan davranışta okuyucu tablonun ortasında bir
            başlığa basınca sayfanın en üstüne fırlıyor ve aşağı geri kaydırmak
            zorunda kalıyordu. */}
        {/* MOBİLDE 44px. Sıralama başlığı tablonun ANA denetimi ama dokunma
            hedefi 32 pikseldi. Negatif margin dolguyu emiyor, yani hedef
            büyürken satır yüksekliği değişmiyor; masaüstünde imleç hassas,
            orada 32px yeterli (`.sortLink`). */}
        <Link href={href} scroll={false} title={hint} className={styles.sortLink}>
          {label}
          <Icon aria-hidden size={12} weight={active ? "fill" : "bold"} className={styles.sortIcon} />
        </Link>
        {children}
      </span>
    </th>
  );
}

/**
 * Sıfır ortalı KALIN çubuk: artı sağa, eksi sola (`laneArm`,
 * lib/market-scales.ts). 8 piksellik dolu çubuk (haftalık 6), arkasında 5
 * piksellik kulvar (sahibinin sözü: "yatayda uzun kalın çizgi"). Çizim
 * globals'ın `bar-fill` sınıfıyla dolar (modülde animasyon ADI yazılmaz,
 * `.claude/rules/hareket.md` → Tuzaklar); kapı satırın `data-draw`ında.
 * Tam %0: kulvar ve sıfır çizgisi var, dolgu yok — "değişmedi" bir uzunluk
 * değil.
 *
 * ÖLÇEK ÇAĞIRANDAN (`span`, 10 Kasım gece). Sabah ölçek SABİTTİ (±%3 / ±%8):
 * "en çok düşen" sıralamasında eşiği aşan bütün satırlar aynı dolu kolu
 * çiziyordu. Çağıran artık listesinin ölçeğini verir (`laneSpan`, gerekçe
 * orada); vermeyen eski sabiti (tabanı) alır — sözleşme geriye uyumlu.
 * Ölçeği aşan çubuk kola dayanır ve ucunda KESİK taşır (`data-over`): eksen
 * kırığı, "bu çubuk burada bitmiyor". Kesik bir veri imi değil, çubuğun
 * kendi ucu; büyüklüğü yanındaki sayı söyler.
 */
export function ZeroBar({ value, weight = "day", span, className }: {
  value: number;
  weight?: "day" | "week";
  /** Kulvarın tam kolu, yüzde. Verilmezse taban (`DAY_LANE_SPAN` / `WEEK_LANE_SPAN`). */
  span?: number;
  className?: string;
}) {
  const full = span ?? (weight === "week" ? WEEK_LANE_SPAN : DAY_LANE_SPAN);
  const arm = laneArm(value, full);
  return (
    <span className={cn(styles.lane, className)} data-weight={weight} aria-hidden>
      {arm > 0 && (
        <i
          className={cn("bar-fill", styles.fill)}
          data-tone={value < 0 ? "down" : "up"}
          data-over={laneOver(value, full) ? "" : undefined}
          style={{ width: `${arm.toFixed(2)}%` }}
        />
      )}
    </span>
  );
}

/**
 * Değişim hücresinin içi: kalın çubuk + yön renginde sayı.
 *
 * Günlük (`day`) satırın EN GÜÇLÜ sayısıdır (19/700); |%| ≥ `BIG_MOVE` ise
 * yön renginin yıkamasında hap zemini alır. Haftalık (`week`) ikincil
 * (14/600, çubuk 6 piksel). Yön İŞARETLE söylenir, ok yok — `formatPercent`
 * zaten +/− basıyor. Değer bilinmiyorsa çubuk HİÇ çizilmez: sıfır genişlik
 * "hareket yok" demek olurdu ve o da bir iddia.
 *
 * `note` (10 Kasım gece, Temalar tablosu ortak parçaya geçerken): değer var
 * ama listenin ölçeğine GİRMİYOR (yüzdesi başka seansı anlatıyor, veri
 * dürüstlüğü 4). Çubuğun yerinde sakin künye durur ("Son Kapanış"); telefonda
 * yazı sığmadığı için kesikli kulvar (künye tablonun dibinde).
 */
export function MoveFigure({ value, weight = "day", span, note, locale }: {
  value: number | null | undefined;
  weight?: "day" | "week";
  /** Listenin ölçeği (`laneSpan`); verilmezse taban. */
  span?: number;
  /** Ölçek dışı satırın künyesi; verilirse çubuk çizilmez. */
  note?: string;
  locale: Locale;
}) {
  if (value === null || value === undefined) {
    return (
      <span className={styles.move} data-weight={weight}>
        <span />
        <span className={cn(styles.pct, styles.none)}>{NO_VALUE}</span>
      </span>
    );
  }
  const tone = directionOf(value);
  return (
    <span className={styles.move} data-weight={weight}>
      {note ? (
        <span className={styles.moveNote}>
          <span>{note}</span>
          <i aria-hidden />
        </span>
      ) : (
        <ZeroBar value={value} weight={weight} span={span} />
      )}
      <span
        className={cn("numeral", styles.pct, tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-muted")}
        data-big={weight === "day" && Math.abs(value) >= BIG_MOVE ? tone : undefined}
      >
        {formatPercent(value, locale)}
      </span>
    </span>
  );
}

/**
 * Kimlik hücresi: iri logo, sembol, altında şirket adı (gövde mürekkebi).
 *
 * Bağlantı hücreyi doldurur (dokunma hedefi satır boyu); satırın geri
 * kalanına basış `RowTap` ile buraya taşınır. `data-cc` şirket kartının
 * çapası. Logo `LogoTile lg` kaynağından (44 piksel), kutusu `--logo`.
 */
export function CompanyCell({ symbol, name, logoUrl }: { symbol: string; name: string; logoUrl?: string | null }) {
  return (
    <th scope="row" className={styles.company}>
      <Link href={`/hisse/${symbol}`} prefetch={false} className={styles.companyLink} data-cc={symbol}>
        <LogoTile symbol={symbol} logoUrl={logoUrl} size="lg" className={styles.logo} />
        <span className={styles.companyText}>
          <span className={styles.symbol}>{symbol}</span>
          {/* Sığmayan ad üç noktayla kesilir; tam ad `title`da. */}
          <span title={name} className={styles.name}>{name}</span>
        </span>
      </Link>
    </th>
  );
}

/**
 * Gün aralığı: dip · kalın şerit · tepe.
 *
 * 10 Kasım (gece): ÇENTİK VE NOKTA KALKTI. Önceki çizim önceki kapanışın
 * çentiği, ondan fiyata yarı saydam dolgu ve fiyat noktasıydı — üç im,
 * okurun çözmesi gereken bir şifre (sahibinin sözü: "nokta nokta ne
 * anlatıyor anlamıyorum"). Şimdi tek okuma: dipten FİYATA uzanan 8
 * piksellik dolu şerit ve ucunda dikey "şimdi" imi; "gün aralığının
 * neresinde" bir uzunluk. Önceki kapanışa göre yön zaten yanındaki yüzdede.
 * Aralık yoksa çağıran hiç basmaz (`rangeShare` null).
 */
export function RangeFigure({ low, high, price, label, locale }: { low: number; high: number; price: number; label: string; locale: Locale }) {
  const at = rangeShare(low, high, price) ?? 0;
  return (
    <span
      className={cn("numeral", styles.range)}
      role="img"
      aria-label={`${label}: ${formatPrice(low, locale)} – ${formatPrice(high, locale)}`}
    >
      <span aria-hidden>{formatPrice(low, locale)}</span>
      <i className={styles.rangeLane} aria-hidden>
        <span className={cn("bar-fill", styles.rangeFill)} style={{ width: `${at.toFixed(2)}%` }} />
        <span className={styles.rangeNow} style={{ left: `${at.toFixed(2)}%` }} />
      </i>
      <span aria-hidden>{formatPrice(high, locale)}</span>
    </span>
  );
}

/** Satırın çizim kademesi — `<tr style={rowStep(index)}>` (ilk on satır, ≤ 400 ms). */
export function rowStep(index: number): CSSProperties {
  return { "--i": drawStep(index) } as CSSProperties;
}

/**
 * "Daha Fazla Göster" bandı: sayaç + kalın ilerleme şeridi + buton.
 *
 * Sayaç butondan ÖNCE: asıl soru "listenin neresindeyim". Şerit açılan payı
 * gösterir ("karşılaştırılan büyüklük bir de çizgi olarak okunur").
 * scroll={false}: okuyucu listenin dibinde, yeni satırlar geldiğinde
 * sayfanın başına fırlatılmamalı. Buton telefonda 44 piksel.
 */
export function MoreBand({ count, share, href, label }: { count: string; share: number; href: string; label: string }) {
  return (
    <div className={styles.more}>
      <p className={cn("numeral", styles.moreCount)}>{count}</p>
      <span className={styles.moreLane} aria-hidden data-draw>
        <i className="bar-fill" style={{ width: `${Math.min(100, Math.max(0, share)).toFixed(1)}%` }} />
      </span>
      <Link href={href} scroll={false} className={styles.moreButton}>
        {label}
        <CaretDown aria-hidden size={13} weight="bold" />
      </Link>
    </div>
  );
}

/**
 * yükleme iskeleti — gerçek tablonun ölçüleriyle (panel başlığı 57, sütun
 * başlığı 40, satır 62 / telefonda 56, logo 40 / 32).
 *
 * İki sayfanın iskeleti ayrıydı ve ikisi de eski satıra göreydi (46–54
 * piksel, 28 piksellik logo): içerik gelince tablo ~1.000 piksel uzuyor,
 * altındaki her şey aşağı sıçrıyordu. `phoneRows`: gerçek tablo telefonda
 * katlıysa (Endeks Bileşenleri ilk on beş) iskelet de o kadar basar.
 */
/* 10 Kasım (gece, kompakt liste): telefonda iskelet de listenin ölçüsünde —
   başlık satırının yerinde 44 piksellik sıralama şeridi, satır 60, sağda
   İKİ sayı üst üste (yüzde + fiyat) ve yüzdenin solunda kısa çubuk; 640+
   eskisi gibi yan yana. */
export function BoardTableSkeleton({ rows, phoneRows, className }: { rows: number; phoneRows?: number; className?: string }) {
  return (
    <Panel className={cn(styles.panel, styles.skeleton, className)} data-phone={phoneRows ? "" : undefined} aria-hidden>
      <div className={styles.skeletonTitle}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className={styles.skeletonHead} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.skeletonRow} data-fold={phoneRows !== undefined && i >= phoneRows ? "" : undefined}>
          <Skeleton className={styles.skeletonLogo} />
          <div className={styles.skeletonText}>
            <Skeleton className="h-3.5 w-12" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className={cn(styles.skeletonLane, "h-2 rounded-full")} />
          <div className={styles.skeletonEnd}>
            <Skeleton className="h-4 w-14 shrink-0" />
            <Skeleton className="h-3.5 w-12 shrink-0" />
          </div>
          <Skeleton className={cn(styles.skeletonWide, "h-2 w-14 rounded-full")} />
          <Skeleton className={cn(styles.skeletonWide, "h-3 w-12 shrink-0")} />
          <Skeleton className={cn(styles.skeletonWide, "h-3.5 w-16 shrink-0")} />
        </div>
      ))}
    </Panel>
  );
}
