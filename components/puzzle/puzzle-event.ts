/**
 * Bulmacanın durumu değişti (tahmin işlendi, oyun bitti) — sıralama paneli
 * (`PuzzleLeaderboard`) tabloyu bununla tazeler (29 Ekim). Tahta ile panel
 * ayrı bileşenler: panel sunucu ekranında tahtanın altında, tahtaya
 * bağlanmadan dinlesin diye olay adı tek kaynakta (zil olayının kalıbı,
 * `components/today/bell-event.ts`).
 */
export const PUZZLE_UPDATE_EVENT = "az:bulmaca-durum";
