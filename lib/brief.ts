/**
 * Bülten — paylaşılan tipler.
 *
 * Burada bir dönem sunucu tarafı bülten ÜRETİMİ de vardı: ANTHROPIC_API_KEY
 * varsa Claude, yoksa kural tabanlı bir madde listesi. Günlük cron bunu her
 * gün 13:30'da iki dilde yazıyordu ve BİLEREK KALDIRILDI: mekanik özet günün
 * slotunu dolduruyor, kart 16:00'ya kadar onu "BUGÜN" rozetiyle gösteriyor
 * ve elle yazılmış dünkü bültenle eskime notu hiç görünmüyordu. Bülteni
 * yalnızca claude.ai rutini yazar (16:00 TR, POST /api/brief); o saate kadar
 * kart en son bülteni tarihini söyleyen notla gösterir.
 *
 * Arşivdeki eski kayıtlar `generated_by = "rules"` değerini taşımaya devam
 * eder; ekrandaki "Kural Tabanlı" etiketi onlar için duruyor.
 */

export type BriefPeriod = "daily" | "weekly";
