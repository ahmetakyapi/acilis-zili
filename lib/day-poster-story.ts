import { POSTER_ANCHOR, advanceShare, type DayPoster, type PosterMove } from "./day-poster";

/**
 * GÜNÜN CÜMLESİ (25 Ekim, sahibinin itirazı: "daha anlaşılabilir,
 * açıklayıcı, kullanıcıya bir şeyler anlatabilen bir şey olmalı").
 *
 * Poster önce yalnız sahneydi: noktalar ve etiketsiz kulvarlar. Okuyucu
 * günün NE OLDUĞUNU sahneyi çözerek bulmak zorundaydı. Şimdi sahnenin
 * üstünde tek cümle var: "Geniş Satış: Nasdaq 100'de 74 Hisse Düştü; Yalnız
 * Teknoloji Yükseldi".
 *
 * NASDAQ 100 (25 Ekim, üçüncü kurulum): endeks Nasdaq 100 fonu (QQQ),
 * genişlik yüz üye, "sektörler" siluetin mahalleleri — üyelerin kendi
 * değişimlerinin piyasa değeriyle ağırlıklı ortalaması
 * (`lib/day-skyline.ts` → `districtsOf`). Kurallar ve eşikler aynı; cümle
 * yalnız neye baktığını değiştirdi.
 *
 * CLAUDE YOK, ŞABLON + VERİ. Cümlenin her parçası posterin kendi
 * sayılarından (Nasdaq 100 fonunun değişimi, genişlik, mahalle sırası)
 * kural kuralına seçiliyor; aynı gün her yerde aynı cümle (sayfa, paylaşım
 * görseli, arşiv kartı). Uydurma yok: cümle bir NEDEN söylemiyor ("teknoloji
 * taşıdı" değil "en çok teknoloji yükseldi"), yalnız sahnede görüneni.
 *
 * Bu dosya SAF (tests/day-poster-story.test.ts): sınıflama `posterStory`,
 * metin `storyText` — şablonlar sözlükten (`daySignature.story`).
 */

/**
 * ENDEKSİN "YERİNDE SAYDIĞI" BANT (yüzde puan). Endeks fonu ±%0,10
 * içinde kapandıysa günün yönü endeksten okunmuyor. Aşağıdaki ölçüm S&P
 * 500 dönemindendi (SPY); Nasdaq 100'e geçerken bant aynı kaldı. Bir piyasa kuralı
 * değil, bu sitenin eşiği: 24 Ağustos–23 Ekim arasındaki 43 seansın
 * beşi bu bantta (Alpaca gün barları, 25 Ekim ölçümü) — ±%0,02'lik bir
 * güne "Yükseliş Günü" demek abartı olurdu. Aynı 43 seansın dağılımı:
 * 12 yükseliş, 12 düşüş, 5 yatay, 5 geniş satış, 2 geniş yükseliş,
 * 4 dar düşüş, 3 dar yükseliş.
 */
export const STORY_FLAT_BAND = 0.1;

/**
 * GENİŞ GÜN EŞİĞİ — hareket eden hisselerin en az %70'i aynı yöne.
 * Zilin şiddetinin başladığı yer de burası (`bellEnergy`, lib/day-poster.ts:
 * yarıdan uzaklık 0,4 = %70/%30): sitenin "tek yönlü gün" tanımı tek.
 * Aynı 43 seansta yedi gün geniş (iki yükseliş, beş satış).
 */
export const STORY_BROAD_SHARE = 0.7;

/**
 * "HİSSELERİN ÇOĞU" PAYI — ayrışma (endeks bir yöne, hisselerin çoğu öbür
 * yöne) ancak hareket edenlerin en az %55'i öbür yöndeyse. 16 Ekim'de (S&P 500
 * dönemi) 247 hisse yükseldi, 246 düştü ve endeks %1,11 düştü: bire bir eşitliğe
 * "hisselerin çoğu yükseldi" demek uydurma kesinlik olurdu.
 */
export const STORY_MAJORITY_SHARE = 0.55;

/** Sektör cümlesinde "Yalnız A, B ve C" için en fazla ad; fazlası
 *  önde/geride kalıbına döner (dört adlı liste başlığı uzatıyor). */
export const STORY_MAX_EXCEPTIONS = 3;

/**
 * "YALNIZ" AZINLIK İÇİN (25 Ekim, Nasdaq 100 kurulumu). On bir sektörde üç
 * istisna açık bir azınlıktı; Nasdaq 100'ün yedi mahallesinde üç istisna
 * neredeyse yarı ("Yalnız Teknoloji, İletişim ve Tüketici Ürünleri
 * Yükseldi" dört mahalle düşmüşken abartı). İstisnalar mahallelerin en
 * fazla üçte biri olabilir: yedide iki, on birde üç (eski davranış aynı).
 */
export const STORY_MAX_EXCEPTION_SHARE = 1 / 3;

export type StoryKind =
  | "broadRally"
  | "broadSelloff"
  | "narrowRally"
  | "narrowDecline"
  | "rally"
  | "decline"
  | "flat";

export type StoryTone = "up" | "down" | "flat";

/** Sektör cümlesi: hepsi aynı yöne, birkaç istisna, ya da önde/geride. */
export type SectorClause =
  | { kind: "all"; dir: "up" | "down" }
  | { kind: "only"; dir: "up" | "down"; symbols: string[] }
  | { kind: "leadLag"; lead: string; lag: string };

/** Hisselerin cümlesi (yatay günde): çoğu yükseldi, çoğu düştü, bölündü. */
export type BreadthClause = { kind: "up"; n: number } | { kind: "down"; n: number } | { kind: "split" };

export type PosterStory = {
  kind: StoryKind;
  /** Başlığın tonu — yalnız işaretin rengi için (renk = yön). */
  tone: StoryTone;
  /** Endeks fonunun (Nasdaq 100, QQQ) değişimi (yüzde puan). */
  anchor: number;
  advancing: number | null;
  declining: number | null;
  sectors: SectorClause | null;
  breadth: BreadthClause | null;
  /** Ayrışma günlerinde anılan sektör (en güçlü ya da en zayıf). */
  focus: PosterMove | null;
};

/**
 * Sektörlerin cümlesi, günün yönüne göre. Yön verilmezse (yatay gün)
 * önde/geride. İstisna = günün yönünün tersine giden sektör; değişimi tam
 * sıfır olan istisna sayılmıyor ve "hepsi" demeye de engel oluyor.
 *
 * İSTİSNA DA YATAY BANDI AŞMALI (25 Ekim, son inceleme): istisna yalnız
 * işaretle seçiliyordu; geniş satış gününde +%0,01 kapanan fon için
 * "Yalnız Enerji Yükseldi" yazıyordu: endekste "yatay" saydığımız bir
 * kıpırtıyı sektörde manşete taşıyordu. Endeksin ±%0,10'luk bandı
 * (`STORY_FLAT_BAND`) sektöre de uygulanıyor: bandın içinde ters kapanan
 * bir fon varsa ne "Yalnız …" ne "hepsi" denir, cümle önde/geride
 * kalıbına döner (doğru kalan tek kalıp; o fon günün yönüne de gitmedi).
 */
export function sectorClause(sectors: readonly PosterMove[], dir: "up" | "down" | null): SectorClause | null {
  if (sectors.length === 0) return null;
  const lead = sectors[0];
  const lag = sectors[sectors.length - 1];
  const leadLag: SectorClause = { kind: "leadLag", lead: lead.symbol, lag: lag.symbol };
  if (!dir) return leadLag;
  const withDay = sectors.filter((move) => (dir === "up" ? move.change > 0 : move.change < 0));
  if (withDay.length === sectors.length) return { kind: "all", dir };
  const against = sectors.filter((move) => (dir === "up" ? move.change < 0 : move.change > 0));
  if (withDay.length + against.length !== sectors.length) return leadLag;
  if (against.some((move) => Math.abs(move.change) <= STORY_FLAT_BAND)) return leadLag;
  if (
    against.length > 0 &&
    against.length <= STORY_MAX_EXCEPTIONS &&
    against.length <= sectors.length * STORY_MAX_EXCEPTION_SHARE
  ) {
    return { kind: "only", dir: dir === "up" ? "down" : "up", symbols: against.map((move) => move.symbol) };
  }
  return leadLag;
}

/** Cümlenin girdisi: posterin endeksleri ve genişliği, ve "sektörler" —
 *  siluetin mahalleleri, güçlüden zayıfa (`districtMoves`). */
export type StoryInput = Pick<DayPoster, "indices" | "breadth"> & { sectors: readonly PosterMove[] };

/** Günün sınıfı ve cümlenin parçaları. Kurallar YUKARIDAN AŞAĞI. */
export function posterStory(poster: StoryInput, anchorSymbol: string = POSTER_ANCHOR): PosterStory {
  const anchor = poster.indices.find((move) => move.symbol === anchorSymbol)?.change ?? 0;
  const indexDir = anchor > STORY_FLAT_BAND ? "up" : anchor < -STORY_FLAT_BAND ? "down" : null;
  const breadth = poster.breadth;
  const share = breadth ? advanceShare(breadth) : null;
  const base = {
    anchor,
    advancing: breadth?.advancing ?? null,
    declining: breadth?.declining ?? null,
    breadth: null,
    focus: null,
  };
  const lead = poster.sectors[0] ?? null;
  const lag = poster.sectors[poster.sectors.length - 1] ?? null;

  if (share !== null) {
    /* 1. AYRIŞMA önce: endeks bir yöne, hisselerin belirgin çoğu öbür
          yöne. Günün asıl hikâyesi bu — birkaç büyük şirket endeksi
          taşıdı ya da çekti (neden değil, görünen: en güçlü/en zayıf). */
    if (indexDir === "up" && share <= 1 - STORY_MAJORITY_SHARE) {
      return { ...base, kind: "narrowRally", tone: "up", sectors: null, focus: lead };
    }
    if (indexDir === "down" && share >= STORY_MAJORITY_SHARE) {
      return { ...base, kind: "narrowDecline", tone: "down", sectors: null, focus: lag };
    }
    /* 2. GENİŞ GÜN: hisselerin en az %70'i aynı yöne. */
    if (share >= STORY_BROAD_SHARE) {
      return { ...base, kind: "broadRally", tone: "up", sectors: sectorClause(poster.sectors, "up") };
    }
    if (share <= 1 - STORY_BROAD_SHARE) {
      return { ...base, kind: "broadSelloff", tone: "down", sectors: sectorClause(poster.sectors, "down") };
    }
  }
  /* 3. YATAY: endeks yerinde; hikâye hisselerde (varsa). */
  if (!indexDir) {
    let clause: BreadthClause | null = null;
    if (breadth && share !== null) {
      clause =
        share >= STORY_MAJORITY_SHARE
          ? { kind: "up", n: breadth.advancing }
          : share <= 1 - STORY_MAJORITY_SHARE
            ? { kind: "down", n: breadth.declining }
            : { kind: "split" };
    }
    return {
      ...base,
      kind: "flat",
      tone: "flat",
      breadth: clause,
      sectors: clause ? null : sectorClause(poster.sectors, null),
    };
  }
  /* 4. SIRADAN GÜN: endeksin yönü ve sektörler. */
  return {
    ...base,
    kind: indexDir === "up" ? "rally" : "decline",
    tone: indexDir,
    sectors: sectorClause(poster.sectors, indexDir),
    focus: indexDir === "up" ? lead : lag,
  };
}

/* --------------------------------------------------------------------------
   Metin
   -------------------------------------------------------------------------- */

export type StoryLabels = {
  kinds: Record<StoryKind, string>;
  /** "{title}: {detail}" — başlık ile ayrıntının birleşimi. */
  join: string;
  broadRally: string;
  broadSelloff: string;
  narrowRally: string;
  narrowDecline: string;
  rally: string;
  decline: string;
  flat: string;
  breadthUp: string;
  breadthDown: string;
  breadthSplit: string;
  sectorsAllUp: string;
  sectorsAllDown: string;
  sectorsOnlyUp: string;
  sectorsOnlyDown: string;
  sectorsLeadLag: string;
  /** Ayrışma gününün odağı, başında ayırıcıyla: "; En Çok {name} Yükseldi". */
  focusUp: string;
  focusDown: string;
};

export type StoryText = {
  /** Kısa başlık: "Geniş Satış" (arşiv kartı, başlığın ilk satırı). */
  title: string;
  /** Ayrıntı: "Nasdaq 100'de 74 Hisse Düştü; Yalnız … Yükseldi". */
  detail: string;
  /** Tam cümle: "Geniş Satış: …" (paylaşım görseli, meta açıklaması). */
  sentence: string;
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Cümleyi kurar. `name` mahalle anahtarından ad, `percent` işaretsiz yüzde
 * ("%0,52"), `list` ad listesini dile göre bağlar ("A, B ve C").
 */
export function storyText(
  story: PosterStory,
  labels: StoryLabels,
  { name, percent, list }: { name: (symbol: string) => string; percent: (value: number) => string; list: (items: string[]) => string },
): StoryText {
  const sectors = (() => {
    const clause = story.sectors;
    if (!clause) return "";
    if (clause.kind === "all") return clause.dir === "up" ? labels.sectorsAllUp : labels.sectorsAllDown;
    if (clause.kind === "only") {
      return fill(clause.dir === "up" ? labels.sectorsOnlyUp : labels.sectorsOnlyDown, {
        list: list(clause.symbols.map(name)),
      });
    }
    return fill(labels.sectorsLeadLag, { lead: name(clause.lead), lag: name(clause.lag) });
  })();
  const breadth = (() => {
    const clause = story.breadth;
    if (!clause) return "";
    if (clause.kind === "split") return labels.breadthSplit;
    return fill(clause.kind === "up" ? labels.breadthUp : labels.breadthDown, { n: String(clause.n) });
  })();
  const values = {
    adv: String(story.advancing ?? ""),
    dec: String(story.declining ?? ""),
    index: percent(Math.abs(story.anchor)),
    /* Odak yalnız işareti günün anlattığıyla uyuşuyorsa anılıyor: "en
       çok yükselen" sektör o gün düşmüşse cümleden düşüyor. */
    focus:
      story.focus && story.focus.change > 0 && story.kind !== "narrowDecline"
        ? fill(labels.focusUp, { name: name(story.focus.symbol) })
        : story.focus && story.focus.change < 0 && story.kind !== "narrowRally"
          ? fill(labels.focusDown, { name: name(story.focus.symbol) })
          : "",
    sectors,
    /* Yatay günde hisse cümlesi yoksa (genişlik hesaplanamadı) sektörler
       onun yerine geçiyor. */
    tail: breadth || sectors,
  };
  const detail = fill(labels[story.kind], values);
  const title = labels.kinds[story.kind];
  return { title, detail, sentence: fill(labels.join, { title, detail }) };
}
