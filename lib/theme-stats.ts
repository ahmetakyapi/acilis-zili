import type { MarketSession, QuoteBasis } from "@/lib/market-hours";

/**
 * Tema tablosunun GÜN HAREKETİ — hangi yüzdeler aynı seansı anlatıyor.
 *
 * CLAUDE.md "Veri dürüstlüğü" 4: bir yüzde hangi seansı anlattığını
 * kanıtlamalı. Tema bir sepet ve sepetin medyanı ancak AYNI GÜNÜN
 * yüzdelerinden kurulursa bir şey söyler: açılış öncesinde üyelerin bir
 * kısmı bu sabah işlem görmüş (yüzde bugünü anlatıyor), bir kısmı görmemiş
 * (yüzde dünkü kapanışı anlatıyor). İkisinin medyanı hiçbir günün hareketi
 * değil.
 *
 * Kural:
 *   - Bu seansa ait yüzdesi olan üye en az `MIN_SESSION_ROWS` VE yüzdesi
 *     bilinen üyelerin en az YARISI ise yalnızca onlar kullanılır ve künye
 *     "bu seans" der.
 *   - Hiçbir üyede bu seansa ait işlem yoksa (hafta sonu değil — o zaman
 *     seans günü cuma ve cumanın işlemleri seansa ait sayılıyor; asıl hâl
 *     açılış öncesinin ilk dakikaları) hepsi önceki seansı anlatıyor;
 *     medyan onlardan kurulur ve künye "son kapanış" der.
 *   - Arada kalan karışık hâlde medyan HİÇ basılmaz: iki ayrı günden bir
 *     sayı üretmek, sayı göstermemekten kötü.
 *
 * YARI KURALI (28 Eylül denetimi). Eşik yalnızca "en az üç üye"ydi ve
 * temanın boyunu hiç sormuyordu: açılış öncesinin ilk dakikalarında
 * yirmi üyeli bir temanın üç hissesi işlem gördüğünde o üçün medyanı
 * "temanın medyanı" diye sıralamaya giriyordu. Üç hisse bir sepetin
 * ortasını değil o üç hissenin gününü anlatır. 28 Eylül 09:09 ET'de
 * (açılış öncesi, gecikmeli besleme) en seyrek tema Uzun Temettü
 * Geçmişi'ydi ve 20 üyenin 14'ü bu sabah işlem görmüştü; öteki temalarda
 * oran 10/11 ile 20/20 arası. Yani kural gün içinde hiçbir temayı
 * söndürmüyor, yalnızca sabahın ilk saatlerindeki ince örneği ayıklıyor.
 *
 * SON KAPANIŞ TEK GÜN (28 Eylül denetimi). "Bu seansa ait değil" tek bir
 * gün demek değil: sağlayıcı düşüp Neon önbelleğine inildiğinde ya da bir
 * hisse bir gün işlem görmediğinde son kapanış kümesinde iki ayrı günün
 * yüzdesi yan yana durabiliyor. Küme artık yalnızca EN YENİ işlem gününü
 * taşıyan satırlardan kuruluyor; gün bilgisi olmayan satır (eski çağıran)
 * o kısıta takılmıyor.
 *
 * Saf modül; `tests/theme-stats.test.ts` ölçüyor.
 */

/** Bu seansın yüzdesinden medyan kurmak için gereken en az üye. İki
    üyenin medyanı bir ortalama; üç, bir sepetin ortasını göstermeye başlar. */
export const MIN_SESSION_ROWS = 3;
/** Bu seansı anlatan üyelerin, yüzdesi bilinen üyelere en az oranı. */
export const MIN_SESSION_SHARE = 0.5;

export type MoveRow = {
  changePct: number | null;
  basis: QuoteBasis | null;
  /** Son işlemin ET günü ("YYYY-MM-DD") — son kapanış kümesini tek güne indirir. */
  tradedDay?: string | null;
};

export type MoveSet = {
  /** Hangi satırların yüzdesi bu kümede — ölçek çubuğu yalnızca onlara. */
  included: boolean[];
  values: number[];
  basis: "session" | "lastClose";
};

export function sameSessionMoves(rows: readonly MoveRow[]): MoveSet | null {
  const known = rows.map(
    (row) => row.changePct !== null && Number.isFinite(row.changePct) && row.basis !== null,
  );
  const fresh = rows.map((row, i) => known[i] && row.basis !== "lastClose");
  const freshCount = fresh.filter(Boolean).length;
  const knownCount = known.filter(Boolean).length;

  if (freshCount >= MIN_SESSION_ROWS && freshCount >= knownCount * MIN_SESSION_SHARE) {
    return {
      included: fresh,
      values: rows.filter((_, i) => fresh[i]).map((row) => row.changePct!),
      basis: "session",
    };
  }
  if (freshCount > 0) return null;

  const latest = rows.reduce<string | null>(
    (max, row, i) => (known[i] && row.tradedDay && (max === null || row.tradedDay > max) ? row.tradedDay : max),
    null,
  );
  const sameDay = rows.map((row, i) => known[i] && (!row.tradedDay || latest === null || row.tradedDay === latest));
  if (sameDay.filter(Boolean).length >= MIN_SESSION_ROWS) {
    return {
      included: sameDay,
      values: rows.filter((_, i) => sameDay[i]).map((row) => row.changePct!),
      basis: "lastClose",
    };
  }
  return null;
}

/**
 * Ekranın künyesi: sıralamanın ve uç kartlarının başlığı "Günün" mü,
 * "Açılış Öncesi" mi, "Son Kapanış" mı diyor.
 *
 * AÇILIŞ ÖNCESİ "GÜNÜN" DEĞİL (28 Eylül denetimi). Açılış öncesinde
 * `changePct` bu sabahın seyrek ön seans işleminin dünkü kapanışa göre
 * farkı (lib/providers/alpaca.ts → `referenceClose`). Seans kümesi
 * doğru kuruluyordu ama başlık "Günün Sıralaması", "Günün En Güçlü
 * Teması" diyordu; ana sayfanın hareket paneli aynı pencerede zaten
 * "Açılış Öncesi Hareketleri" başlığına geçiyor (DayMovers). Pencere
 * oradaki gibi piyasa durumundan okunuyor, iki panel aynı anda aynı
 * kelimeyi kullansın diye.
 *
 * Kapanış sonrası "Günün" kalıyor: yüzde seans gününün kapanışına kadar
 * (kapanış sonrası işlem dahil) bütün günü anlatıyor ve okuyucu hâlâ o
 * günün akşamında.
 *
 * PİYASA KAPALIYKEN "SON KAPANIŞ" (28 Eylül). Hafta sonu, tatil ve gece
 * (20:00 ET, Türkiye'de 03:00 sonrası) yüzdeler seans gününe ait, yani
 * küme "session" sayılıyor; ama başlık pazar günü "Günün En Güçlü Teması"
 * diyordu ve o gün bir seans yok. Ana sayfanın hareket paneli de aynı
 * pencerede "Son Kapanış" diline geçiyor (DayMovers).
 */
export type ThemePhase = "day" | "pre-market" | "lastClose";

export function themePhase(
  basis: "session" | "lastClose" | null,
  session: MarketSession,
): ThemePhase | null {
  if (basis === null) return null;
  if (basis === "lastClose" || session === "closed") return "lastClose";
  return session === "pre-market" ? "pre-market" : "day";
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
