import { Skeleton } from "@/components/ui/primitives";
import { getSymbolNames } from "@/lib/data";
import { getEarningsCalendar } from "@/lib/providers/finnhub";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { bandFiyatiKapsiyorMu } from "@/lib/utils";

/* ==========================================================================
   Profil / metrikler / analistler / bilançolar / haberler
   ========================================================================== */

/** Bilanço kayıtlarının ortak biçimi — DB satırı da sağlayıcı girdisi de buna iner. */
export type EarningsItem = {
  reportDate: string;
  hour: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  quarter: number | null;
  year: number | null;
};

/**
 * Sembolün bilanço geçmişi + geleceği. Yerel takvim tablosu yalnızca yakın
 * aralığı tutar; kapsam dışı kalan sembollerde Finnhub'ın sembol bazlı
 * takvimi devreye girer (geçmiş ~13 ay, gelecek ~4 ay — 6 saat önbellekli).
 */
export async function symbolEarnings(symbol: string): Promise<EarningsItem[]> {
  const today = todayEt();
  const result = await getEarningsCalendar(
    addEtDays(today, -400),
    addEtDays(today, 120),
    symbol,
  );
  return result.ok ? result.data : [];
}

/**
 * Sembolün para birimi — `formatPrice`/`formatMoneyCompact`e verilecek biçimde.
 *
 * NEDEN: sağlayıcının bilanço rakamları dolar değil, ŞİRKETİN ANA BORSASININ
 * parasında geliyor. /hisse/TSM'de "Gelir Beklentisi 1,47 T $" yazıyordu —
 * bir çeyrekte bir buçuk trilyon dolar; sayı doğru, para birimi (TWD) yanlıştı.
 *
 * Kural bu sayfada üç yerde uygulanmıştı (anahtar metrikler, yaklaşan bilanço
 * kartı, karşılaştırma tablosu) ama GEÇMİŞ BİLANÇOLAR tablosu dışarıda
 * kalmıştı: orada her hücre koşulsuz `{ currency: true }` ile basılıyordu.
 * Sonuç TSM'de 27,25 TWD'nin "27,25 $" görünmesi, PDD'de 118 milyar CNY'nin
 * "118 Mr $" görünmesiydi — yedi kat şişik bir sayı, üstelik ekranın en
 * güvenilir görünen yerinde, bir tablonun içinde.
 *
 * Üç ayrı kopya yerine tek yardımcı: dördüncü bir kullanım yeri çıktığında
 * kuralın yeniden unutulacağı bir yer kalmasın. `getSymbolNames` istek içinde
 * önbellekli, yani ikinci çağrı sağlayıcıya gitmiyor.
 *
 * `true` "dolar olarak biçimlendir" demek — `formatPrice`in sözleşmesi bu.
 */
export async function paraSecenegi(symbol: string): Promise<string | true> {
  const meta = await getSymbolNames([symbol]);
  const kod = meta[symbol]?.currency ?? null;
  return kod && kod !== "USD" ? kod : true;
}

/** `formatMoneyCompact` kod ya da `null` ister; `true` orada geçmiyor. */
export function paraKoduOf(opt: string | true): string | null {
  return typeof opt === "string" ? opt : null;
}


/**
 * 52 hafta bandı — iki kartın (profil ve ortalamalar) ortak kuralı.
 *
 * BANT YALNIZCA PARA BİRİMİ AYNIYSA CETVELE GİRER. Metrik ucu bandı şirketin
 * ana borsasının parasında veriyor; TSM'de dolar fiyatıyla aynı eksene
 * konsaydı fiyat bandın çok dışına düşerdi. Orada uçlar kendi para
 * birimiyle yazılıyor, cetvel ve konum yok. `bandFiyatiKapsiyorMu` da şart:
 * BRK.B'de band A sınıfının (gerekçe MetricsCard'da).
 */
export function week52Band(
  m: { low52: number | null; high52: number | null } | null,
  price: number | null,
  currency: string | null,
) {
  const homeCurrency = Boolean(currency && currency !== "USD");
  if (!m || m.low52 === null || m.high52 === null || !(m.high52 > m.low52)) return null;
  if (!homeCurrency && !bandFiyatiKapsiyorMu(price, m.low52, m.high52)) return null;
  const onRail = !homeCurrency;
  return {
    low: m.low52,
    high: m.high52,
    onRail,
    para: homeCurrency ? currency! : (true as const),
    position:
      onRail && price !== null
        ? Math.min(100, Math.max(0, ((price - m.low52) / (m.high52 - m.low52)) * 100))
        : null,
  };
}

export function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:px-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
