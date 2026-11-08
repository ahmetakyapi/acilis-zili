# Bülten Rutini

Bu görevin tam ve güncel talimatı tek yerde duruyor:

**[`docs/claude-rutinler.md`](./claude-rutinler.md) → "1 · Günlük Bülten"
ve "2 · Haftalık Bülten"**

Orada zamanlama (günlük 08:55 New York, haftalık Pazartesi 09:30 TR),
canlı rutinin kopyala-yapıştır prompt'u, model, ağ izni şartı ve arşivi
geriye doldurma adımları birlikte bulunuyor. Ortak yazım kuralları
`content/kurallar/ortak.md`, `gunluk.md` ve `haftalik.md`de; rutin onları
her koşuda `/api/kurallar` ile okur.

İki dosya tutulmuyor çünkü ikisi ayrı ayrı güncellendiğinde birbirinden
kayıyordu: bu dosya 29 Ekim 2026'ya kadar eski bir kopyayı taşıyordu (09:00
zamanlaması, 6–10 cümlelik gövde) ve rutinin gerçek prompt'undan ayrı
düşmüştü. Rutine yapıştırılan metnin tek bir kaynağı olması gerekiyor.
