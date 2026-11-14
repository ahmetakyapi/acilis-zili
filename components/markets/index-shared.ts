import {
  DOW_MEMBERS,
  NDX_MEMBERS,
  SPX_MEMBERS,
  primaryOnly,
  type IndexMember,
} from "@/db/seed/indices";
import type { Locale } from "@/lib/i18n";
import { LANE_STEPS } from "@/lib/market-scales";
import type { Quote } from "@/lib/providers/types";
import { SIGN_GAP } from "@/lib/utils";

/* Piyasalar ekranının endeks akışının ortak sözleşmesi (10 Kasım 2026:
   paneller `app/(app)/piyasalar/page.tsx`ten kendi dosyalarına taşındı —
   "büyük sayfalar panellere bölünür"; saf görünümler sahte veriyle
   ölçülebilsin diye yükleyici sayfada, çizim burada). */

/* Üyelik listeleri şirket başına tek satır gösterir: endekste iki sınıfı da
   bulunan şirketler (GOOGL/GOOG, FOXA/FOX, NWSA/NWS) yaygın sınıfıyla yer
   alır. Dow'da çok sınıflı üye yoktur, bölen hesabı bundan etkilenmez. */
/* Sıra Nasdaq 100 ile başlıyor: okuyucunun bu siteye gelme sebebi ağırlıkla
   teknoloji hissesi ve gün içi hareketin konuşulduğu endeks o. Dizi hem üstteki
   endeks kartlarını hem seçici çiplerini besliyor, ikisi de aynı sırayı
   izliyor — ve açılıştaki seçili sekme de baştaki endeks. Ardından S&P 500,
   en sonda Dow Jones (17 Ekim, sahibinin isteği: piyasanın genelini anlatan
   S&P 500 ikinci, 30 hisselik fiyat ağırlıklı Dow sonda). */
export const INDEX_TABS = [
  { key: "nasdaq", label: "Nasdaq 100", proxy: "QQQ", members: primaryOnly(NDX_MEMBERS) },
  { key: "sp500", label: "S&P 500", proxy: "SPY", members: primaryOnly(SPX_MEMBERS) },
  { key: "dow", label: "Dow Jones", proxy: "DIA", members: primaryOnly(DOW_MEMBERS) },
] as const;

export type TabKey = (typeof INDEX_TABS)[number]["key"];

/* "hafta": Şirketler dizinindeki anahtarın aynısı (app/(app)/sirketler). */
export const SORT_KEYS = ["degisim", "fiyat", "ad", "katki", "cap", "hafta"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

/**
 * Bir seferde basılan bileşen satırı.
 *
 * S&P 500 sekmesi 499 satırın tamamını basıyordu: 2,3 MB HTML tek sayfada,
 * telefonda saniyelerce süren bir yerleşim. Endeks bileşenleri listesi
 * baştan sona okunan bir şey değil — okuyucu ilk sıralara, yani sıralamanın
 * tepesine bakıyor. Sıralama SATIRLARIN TAMAMI üzerinde yapılıp dilim sonra
 * alınıyor, yani "en çok düşen" ilk 60'ın değil 499'un en çok düşeni.
 * (Aynı ölçü ve aynı gerekçe /sirketler dizininde de var.)
 */
export const PAGE_STEP = 60;
/** Telefonda bileşen tablosunun açık satırı; kalanı katlı (FoldToggle). */
export const PHONE_ROWS = 15;

/**
 * Dow puan katkısı — YAKLAŞIK olduğu görünsün.
 *
 * Katkı, endeks böleninden hesaplanıyor ve bölen DIA fiyatı × 100
 * varsayımından türüyor. DIA gerçek Dow'un tam yüzde biri DEĞİL: temettü
 * dağıtımları ve NAV primi/iskontosu yüzünden bu yaklaşık bir oran. Sonuç iki ondalık haneyle
 * ("+38,42 puan") basılıyordu — yaklaşık bir bölenden çıkan sayıya iki
 * hanelik kesinlik giydirmek, projenin "uydurma kesinlik yok" kuralının
 * tam karşılığı. Tam sayıya yuvarlanıp başına `~` konuyor.
 */
export function approxPoints(value: number, locale: Locale): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  const formatted = new Intl.NumberFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    { maximumFractionDigits: 0 },
  ).format(Math.abs(rounded));
  return `~${sign}${SIGN_GAP}${formatted}`;
}

/** `bodySpan`ın okuduğu yüzdelik: üyelerin dörtte üçü kolun içinde kalır. */
export const BODY_SPAN_QUANTILE = 0.75;

/**
 * Kulvarın tam kolu, listenin GÖVDESİNE göre (14 Kasım 2026, görsel tur).
 *
 * `laneSpan` "body" kipi 90. yüzdeliği ölçer; haftalık değişimde kuyruk
 * uzundur (tek sektörün sert haftası) ve o ölçekte gövdedeki satırlar
 * 3–10 piksellik noktalara düşüyordu (karar: MembersTable.tsx → "HAFTALIK
 * ÖLÇEK GÖVDEYE GÖRE"). Burada ölçü mutlak değerlerin 75. yüzdeliği; taban
 * (`floor`) ve okunur basamaklar (`LANE_STEPS`) `laneSpan` ile aynı, yani
 * künyedeki sayı yine "±%8" gibi yuvarlak. Ölçeği aşan satır kola dayanır
 * ve ucunda kesik taşır (`laneOver`). Sonlu olmayan değer atlanır.
 */
export function bodySpan(values: readonly (number | null | undefined)[], floor: number): number {
  const sorted = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .map((value) => Math.abs(value))
    .sort((a, b) => a - b);
  const mark = sorted.length > 0 ? sorted[Math.max(0, Math.ceil(sorted.length * BODY_SPAN_QUANTILE) - 1)] : 0;
  const need = Math.max(floor, mark);
  return LANE_STEPS.find((step) => need <= step + 1e-9) ?? LANE_STEPS[LANE_STEPS.length - 1];
}

/**
 * Sütunun dayanıklı tavanı: en büyük İKİNCİ mutlak değer (14 Kasım 2026).
 *
 * Emtia panosunda çubuk ölçeği sütunun en büyüğüydü; yılbaşından +%110
 * yapan tek fon (ham petrol) ötekilerin hepsini nokta boyuna indiriyordu.
 * Tek uç değer ölçeği belirlemez (`laneSpan`ın dersi): o satır kola dayanır,
 * ucunda kesik taşır. Tek değerli sütunda o değerin kendisi; boşta 0.
 */
export function robustPeak(values: readonly (number | null | undefined)[]): number {
  const sorted = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .map((value) => Math.abs(value))
    .sort((a, b) => b - a);
  return sorted[1] ?? sorted[0] ?? 0;
}

export type Row = {
  member: IndexMember;
  quote: Quote | undefined;
  /** Yalnızca Dow (fiyat ağırlıklı) için: endeks puanına katkı. */
  contribution: number | null;
  /** Finnhub logosu — tabloda satırı bir bakışta tanınır kılar. */
  logoUrl: string | null;
  /** Piyasa değeri — yalnızca USD cinsinden bilinenler. */
  marketCap: number | null;
  /** Son 5 işlem günündeki değişim, yüzde (`getWeeklyChanges` — Şirketler
      tablosuyla aynı kaynak); bar gelmediyse null ve hücre boş kalır. */
  week: number | null;
};

/** Isı haritasında en çok kaç şirket — piyasa değerine göre ilk 30 (26 Eylül,
    sahibinin isteği): Dow zaten 30 üye, böylece üç endekste de harita aynı
    ızgarada ve her kare logosu, yüzdesi ve künye kartıyla okunacak kadar iri. */
export const HEAT_MAX = 30;
