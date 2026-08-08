import type { Locale } from "@/lib/i18n/config";

/**
 * Ekonomik olay açıklamaları — "bu veri ne, neden önemli".
 *
 * Takvim satırları yalnızca saat ve başlık taşıyordu: "TÜFE — Temmuz Verisi"
 * satırı, TÜFE'nin ne olduğunu bilmeyen okuyucuya hiçbir şey söylemiyor ve
 * sitenin geri kalanındaki öğretici ton takvimde kesiliyordu.
 *
 * Metinler ŞEMADA DEĞİL burada duruyor. Sebebi: aynı olay her ay tekrar
 * ediyor (cpi-2026-08-12, cpi-2026-09-11, …) ve açıklama olayın kendisine
 * değil TÜRÜNE ait. Veritabanına yazmak aynı cümleyi yüzlerce satıra
 * kopyalamak olurdu; üstelik metni düzeltmek migration gerektirirdi.
 *
 * Anahtar, slug'ın tarih ekinden arındırılmış hâli. Tanımadığı tür için
 * `null` döner ve satır eskisi gibi yalnızca başlıkla basılır — listeye yeni
 * bir olay türü girdiğinde ekran bozulmaz, sadece o satır sessiz kalır.
 */

type Explainer = { tr: string; en: string };

const EXPLAINERS: Record<string, Explainer> = {
  cpi: {
    tr: "Tüketici fiyatlarındaki değişim — enflasyonun en çok izlenen ölçüsü. Beklentinin üstü, Fed'in faiz indirmesini zorlaştırır.",
    en: "Change in consumer prices — the most watched inflation gauge. A hotter print makes Fed rate cuts harder to justify.",
  },
  "core-cpi": {
    tr: "Gıda ve enerji hariç TÜFE. O iki kalem çok oynak olduğu için asıl eğilim buradan okunur.",
    en: "CPI excluding food and energy. Those two swing wildly, so the underlying trend shows up here.",
  },
  "fred-core-pce": {
    tr: "Fed'in enflasyonda birinci sırada baktığı ölçü. TÜFE'den farklı bir sepet kullanır, o yüzden iki sayı ayrışabilir.",
    en: "The Fed's preferred inflation gauge. It uses a different basket than CPI, so the two can diverge.",
  },
  nfp: {
    tr: "Bir ayda tarım dışı sektörlerde eklenen ya da kaybedilen iş sayısı. Ekonominin gidişatına dair en yakından izlenen tek veri.",
    en: "Jobs added or lost outside farming in a month. The single most closely watched read on the economy.",
  },
  unemployment: {
    tr: "İş arayanların işgücüne oranı. Düşmesi güçlü ekonomi demek, ama ücret baskısıyla enflasyonu da besleyebilir.",
    en: "Share of the labor force looking for work. Falling means a strong economy — but can also feed wage pressure.",
  },
  "jobless-claims": {
    tr: "Haftalık ilk işsizlik maaşı başvuruları. En taze istihdam sinyali; tek bir hafta değil, birkaç haftalık eğilim okunur.",
    en: "Weekly first-time unemployment filings. The freshest labor signal — read the multi-week trend, not one print.",
  },
  "fomc-rate": {
    tr: "Fed'in politika faizi kararı. Kararın kendisi çoğu zaman sürpriz değildir; sürpriz, kararın yanındaki cümlelerdedir.",
    en: "The Fed's policy rate decision. The decision itself is rarely the surprise — the language beside it is.",
  },
  "fomc-presser": {
    tr: "Fed Başkanı'nın karar sonrası soruları yanıtladığı toplantı. Piyasa yönünü çoğu zaman kararda değil burada bulur.",
    en: "The Fed Chair's post-decision press conference. Markets often find their direction here, not in the decision.",
  },
  "fomc-sep": {
    tr: "Fed üyelerinin faiz, büyüme ve enflasyon tahminleri — nokta grafiği. Yılın kalanına dair patika buradan okunur.",
    en: "Fed officials' rate, growth and inflation projections — the dot plot. It maps the path for the rest of the year.",
  },
};

/** Slug'ın tarih ekinden arındırılmış hâli: "cpi-2026-08-12" → "cpi". */
export function eventKind(slug: string): string {
  return slug.replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

/** Olayın açıklaması; tanınmayan türde `null`. */
export function eventExplainer(slug: string, locale: Locale): string | null {
  const entry = EXPLAINERS[eventKind(slug)];
  if (!entry) return null;
  return locale === "tr" ? entry.tr : entry.en;
}
