# ROUTEMAP — Açılış Zili

> Tek kaynak: proje durumu burada izlenir. Yeni session'da önce bunu oku.

**Son güncelleme:** 2026-07-31
**Durum:** Geliştirme tamamlandı — anahtar bekliyor → deploy

## Rotalar

| Route | Durum | Not |
|---|---|---|
| `/` Bugün | ✅ | Gün Şeridi + endeksler + takvim + bilançolar + özet + favoriler + haberler |
| `/takvim` | ✅ | Gün/hafta/ay + önem filtresi, beklenti/gerçekleşen |
| `/bilancolar` | ✅ | 14 günlük, BMO/AMC rozetleri, favori filtresi |
| `/hisse/[symbol]` | ✅ | lightweight-charts (1G→5Y, alan/mum), profil, metrik, analist, haber, geçmiş bilanço, favori yıldızı |
| `/favoriler` | ✅ | Çoklu liste, renk, sembol ekle/sil — korumalı |
| `/haberler` | ✅ | Akış + sembol filtresi |
| `/makro` | ✅ | 6 FRED serisi, sparkline, sonraki açıklama |
| `/giris` `/kayit` `/ayarlar` | ✅ | Credentials auth, proxy.ts ön eleme |
| `/api/chart/[symbol]` | ✅ | range=1D…5Y |
| `/api/search` | ✅ | Yerel + Finnhub birleşik |
| `/api/cron/daily` | ✅ | Bilanço+haber+makro+actual+özet, CRON_SECRET korumalı |
| `/api/debug/providers` | ✅ | Yalnız dev — anahtar sağlık kontrolü |

## Bekleyen

- [ ] Kullanıcı API anahtarlarını alacak (README tablosu)
- [ ] Neon projesi + `db:migrate` + `db:seed`
- [ ] `/api/debug/providers` ile gerçek veri doğrulaması (fiyatları Google Finance ile karşılaştır)
- [ ] Vercel deploy + env + cron doğrulama
- [ ] Kayıt→giriş→favori akışının gerçek DB ile testi

## Mimari kararlar

- Next 16: `proxy.ts` (middleware değil), async `params`, `cacheComponents` KAPALI (auth+canlı veri ağırlıklı, klasik fetch-revalidate daha öngörülebilir)
- ET↔UTC tek yerde: `lib/market-hours.ts` (24 birim test scratchpad'de koşturuldu, hepsi geçti)
- Sağlayıcı sözleşmesi: throw yok, `ProviderResult` döner; zincir canlı→yedek→Neon cache; uydurma veri asla
- Ekonomik takvim: Finnhub premium gerektirdiğinden resmî kaynak tohumu (FOMC/CPI/NFP) + FRED actual doldurma
- Tasarım: Mimio mavi+bej DNA'sı; mono display; yön renkleri sakin (yosun/kiremit); imza bileşen Gün Şeridi; `data-theme` + anti-FOUC
