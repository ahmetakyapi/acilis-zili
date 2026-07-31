# ROUTEMAP — Açılış Zili

> Tek kaynak: proje durumu burada izlenir. Yeni session'da önce bunu oku.

**Son güncelleme:** 2026-08-01
**Durum:** 🟢 CANLI — https://acilis-zili.vercel.app

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

## Deploy durumu (2026-08-01)

- [x] 4/4 sağlayıcı anahtarı alındı ve doğrulandı (Alpaca, Finnhub, FRED, Neon)
- [x] `db:migrate` + `db:seed` uygulandı (23 tatil, 90 olay, 62 sembol)
- [x] GitHub: github.com/ahmetakyapi/acilis-zili (private) — push → otomatik deploy
- [x] Vercel production: acilis-zili.vercel.app · 8 env değişkeni · cron kayıtlı (hafta içi 10:30 UTC)
- [x] Prod cron elle doğrulandı: 1500 bilanço + 60 haber + 6 makro + brief
- [ ] Kayıt→giriş→favori akışının canlıda kullanıcı testi
- [ ] (İsteğe bağlı) Neon şifresi + Finnhub anahtarı rotasyonu — sohbette paylaşıldı
- [ ] (İsteğe bağlı) ANTHROPIC_API_KEY → günlük özet Claude ile yazılsın

## Mimari kararlar

- Next 16: `proxy.ts` (middleware değil), async `params`, `cacheComponents` KAPALI (auth+canlı veri ağırlıklı, klasik fetch-revalidate daha öngörülebilir)
- ET↔UTC tek yerde: `lib/market-hours.ts` (24 birim test scratchpad'de koşturuldu, hepsi geçti)
- Sağlayıcı sözleşmesi: throw yok, `ProviderResult` döner; zincir canlı→yedek→Neon cache; uydurma veri asla
- Ekonomik takvim: Finnhub premium gerektirdiğinden resmî kaynak tohumu (FOMC/CPI/NFP) + FRED actual doldurma
- Tasarım: Mimio mavi+bej DNA'sı; mono display; yön renkleri sakin (yosun/kiremit); imza bileşen Gün Şeridi; `data-theme` + anti-FOUC
