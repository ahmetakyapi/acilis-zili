import { VERDICT_INK, VERDICT_INK_SOFT } from "@/lib/analysis";
import type { AnalystBucket } from "@/lib/analyst-trend";

/**
 * Analist kovalarının TONU — Analist Görüşleri kartı ve "Nasıl Değişti"
 * paneli aynı beş kovayı anlatıyor, renk eşlemesi tek yerde (25 Ekim).
 *
 * GÖRÜŞ RENKLERİ (25 Ekim son düzeltme, sitenin güncel renk kararı:
 * "renkli olabilir, dengesini tutturalım"). Görüş turunda kovalar tek
 * mürekkep ailesine çekilmişti (Güçlü Al en koyu, Güçlü Sat en açık);
 * sahibi ekranların bütünüyle renksiz kalmasını istemedi. Artık görüşler
 * sitenin her yerinde aynı üçlüyle: AL yeşilin YUMUŞAK tonu, TUT pirinç,
 * SAT kırmızının yumuşak tonu. Güçlü uçlar sitenin görüş tonunun KENDİSİ
 * (`VERDICT_INK` → `--verdict-*`, app/globals.css); ara "Al"/"Sat" bir
 * basamak açık (`-soft`). TUT tek basamak: bilanço ve teknik ekranlarındaki
 * TUT ile aynı pirinç. Sıra yeşil → pirinç → kırmızı. Mavi görüş rengi YOK:
 * mavi etkileşim. Kova adları her zaman yazılı (renk tek başına okunmuyor).
 *
 * Önceden burada ayrı bir `color-mix` formülü vardı (%74/%42, TUT %58);
 * aynı "Al" hisse sayfasında başka, bilanço sayfasında başka tonda
 * çıkıyordu. Yüzdeler artık yalnız globals.css'te.
 */
export const BUCKET_INK: Record<AnalystBucket, string> = {
  strongBuy: VERDICT_INK.buy,
  buy: VERDICT_INK_SOFT.buy,
  hold: VERDICT_INK.hold,
  sell: VERDICT_INK_SOFT.sell,
  strongSell: VERDICT_INK.sell,
};
