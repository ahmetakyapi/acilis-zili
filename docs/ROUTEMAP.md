# Proje durumu — Açılış Zili

> **Bu belge bir rota listesi değil, bir DURUM kaydıdır.** Rotaların tamamı,
> ne yaptıkları ve mimari kararlar `README.md` içinde. Burada yalnızca
> zamanla değişen şey duruyor: neyin canlı olduğu, neyin yarım kaldığı,
> neyin bilinçli olarak yapılmadığı.
>
> Dosyanın adı geçmişten kalma; bir dönem rota listesi tutuyordu ve **tam da
> bu yüzden güncelliğini yitirdi** — 2026-08-01'de donmuş bir tabloda on üç
> rota eksikti ve okuyan onu güncel sanıyordu. İki yerde tutulan bir liste er geç
> birbirinden ayrı düşer. Rota tablosu artık yalnızca README'de.

**Son güncelleme:** 2026-09-28
**Durum:** 🟢 CANLI — https://aciliszili.com

---

## Canlıda ne var

| | |
|---|---|
| Sayfa rotası | 51 (42 açık, 9 yönetim; `/en` önekiyle ikinci bir adreste daha) |
| API ucu | 24 |
| Veritabanı tablosu | 27 · 22 migration (0000–0021; **0020 üretimde uygulanmadı**, aşağıda; 0021 `.env.local`in işaret ettiği veritabanına 28 Eylül'de uygulandı) |
| Sağlayıcı | Alpaca · Finnhub · FRED · TCMB · SEC EDGAR · OpenFIGI · House Clerk · TCMB EVDS (isteğe bağlı) |
| Ortam değişkeni | 16 (`.env.example`) |
| Cron | `/api/cron/daily` — hafta içi 10:30 UTC (13:30 TR) |
| İçerik rutini | 5 adet, claude.ai üzerinde elle kurulu (teknik analiz günde üç koşu) |

**Tohumlanan veri:** 23 NYSE tatili (üçü yarım gün) · CPI/FOMC/istihdam yayın
takvimi · 81 temel sembol · 635 endeks üyesi (S&P 500 + Nasdaq 100 + Dow,
GICS sektörleriyle).

**Depo herkese açık.** `BRIEF_SECRET` ve `CRON_SECRET` asla commit'lenmez;
gerçek değerlerin bulunduğu `docs/rutinler.local.md` gitignore'da.

---

## Açık işler

Sıra öncelikli değil, hepsinin bilinçli olarak beklediği yerler.

- [ ] **Ünlü yatırımcılar (migration 0021).** Beş tablo: `investor_filings`,
      `investor_holdings`, `cusip_tickers`, `congress_filings`,
      `congress_trades`. 28 Eylül'de `.env.local`in veritabanına uygulandı ve
      `npx tsx scripts/sync-investors.ts` ile ilk doldurma yapıldı (15 yatırımcı
      × 8 çeyrek, Pelosi'nin 2025-2026 PTR'leri). Üretim veritabanı farklıysa
      orada da `npm run db:migrate` ve betik koşmalı; tablo yokken ekran "Henüz
      Veri Yok" der, hisse paneli basılmaz, cron adımı raporda "hata" yazar
      ve devam eder.
- [ ] **`OPENFIGI_API_KEY` isteğe bağlı.** Anahtarsız cron koşum başına 40
      CUSIP çözüyor; 13F sezonunda Bridgewater'ın yüzlerce yeni pozisyonunun
      logosu birkaç günde geliyor (o arada ad yazılıyor). Anahtar bunu tek
      koşuma indirir.
- [ ] **ARK günlük ETF işlemleri yapılmadı.** Cathie Wood sayfası yalnızca
      13F'i (çeyreklik) gösteriyor; ARK'ın günlük holdings CSV'lerinden
      "dünkü alım/satım" katmanı ikinci aşama.

- [ ] **Migration 0020 üretimde uygulanmadı.** Dört yeni tablo:
      `symbol_metrics`, `portfolio_positions`, `earnings_analysis_extras`,
      `app_errors`. Kod tablo yokken sessizce düşüyor, yani uygulanana kadar
      skor kartı "Hazırlanıyor" der, portföy açılmaz, bilanço ekleri
      (30 Saniyede, segment, KPI) yazılamaz ve hata kaydı hiçbir şey tutmaz.
      Üretim `DATABASE_URL`iyle `npm run db:migrate`.
- [ ] **`npm run db:seed` canlı deploy'dan SONRA koşturulmalı.** Beş yeni
      makro serisi (`ICSA`, `RSAFS`, `M2SL`, `SAHMREALTIME`, `T10Y3M`)
      `macro_series`e tohumla giriyor; değerleri sonra cron dolduruyor.
- [ ] **`EVDS_API_KEY` alınınca seri kodları ilk çağrıda doğrulanmalı.**
      TÜFE `TP.TUKFIY2025.GENEL`, Yİ-ÜFE `TP.TUFE1YI.T1`
      (`lib/providers/evds.ts`). Kodlar belgelerden doğrulandı ama gerçek
      bir anahtarla hiç çağrılmadı. Anahtar yokken Reel TL kapalı, vergi
      hesaplayıcısı Yİ-ÜFE'yi okuyucudan istiyor.
- [ ] **Bilanço rutini prompt'u claude.ai'ye yapıştırılmalı.**
      `docs/claude-rutinler.md` § 4 artık `takeaways`, `segments`,
      `segments_source` ve `kpis` alanlarını istiyor; kurulu rutin eski
      prompt'la koştukça ekler boş kalır.
- [ ] **`/api/health` bir uptime izleyicisine bağlanmalı** (UptimeRobot,
      Better Stack). İki kural: kod 200 değilse "site düştü", gövde
      `degraded` içeriyorsa "içerik gecikti".
- [ ] **Duman testinin yazma akışı hiç koşturulmadı.** Birim testleri
      (`tests/`, 37 dosya) ve duman testi (`npm run smoke`, GitHub Actions
      `smoke.yml`) var (README → Doğrulama). Açık kalan: kayıt → giriş →
      favori → hesap silme akışı `SMOKE_ALLOW_WRITES=1` ile gerçek bir
      veritabanına karşı bir kez bile koşmadı.
- [x] **Teknik analiz rutini claude.ai'de kurulu** — tek görev, günde üç
      koşu (`docs/claude-rutinler.md` § 5). `/teknik` canlıda dolu.
- [ ] (İsteğe bağlı) Neon şifresi + Finnhub anahtarı rotasyonu.

---

## Bilinçli olarak yapılmayanlar

Bunlar eksik değil, **karar**. Yeniden gündeme gelirse gerekçesiyle birlikte
gelsin.

- **Tam CSP yok.** Next'in satır içi önyükleme script'i ve satır içi stilleri
  `unsafe-inline` gerektiriyor; o da CSP'nin XSS'e karşı faydasının büyük
  kısmını götürüyor. Nonce tabanlı doğru bir CSP ayrı bir iş, yarım hâli
  yanlış bir güvenlik hissi verir. `frame-ancestors`, `nosniff`, HSTS ve
  `Permissions-Policy` yerinde (`next.config.ts`).
- **`cacheComponents` kapalı.** Ürün auth ve canlı veri ağırlıklı; klasik
  fetch-revalidate daha öngörülebilir.
- **`loading.tsx` yok.** Bulunduğu segmentte bir Suspense sınırı açıyor ve
  Next yanıtı oraya kadar hemen akıtıyor — durum kodu da o an yazılıyor.
  Sonuç: `notFound()` çağıran her dinamik rota 404 ekranını basıp **HTTP 200**
  dönüyordu. Sayfaların yavaş parçaları zaten kendi Suspense adalarında.
- **Emtia spot değil fon üzerinden.** Ücretsiz sağlayıcılarımızın hiçbirinde
  canlı emtia spotu yok; FRED'in EIA serisi günlerce geriden geliyor (Brent
  kartı bu yüzden kaldırıldı). Piyasalar'daki Emtia paneli borsada işlem
  gören fonları (GLD, SLV, USO, UNG, CPER, DBA, IBIT, ETHA) fon fiyatı
  olarak gösteriyor ve künyesinde spottan ayrışabileceğini yazıyor.
- **Tek tek analist notları ve hedef fiyat yok.** Finnhub'ın
  `/stock/upgrade-downgrade` ve `/stock/price-target` uçları ücretsiz
  katmanda 403. Elimizde yalnızca aylık dağılım var; Analist Dağılımı
  Değişimi onun farkını gösteriyor ve hangi kurumun ne yaptığını
  söylemiyor. Olmayan bir kaynaktan not uydurulmuyor (`lib/analyst-trend.ts`).
- **`/sektor/*` sayfaları yok.** İçerik `/sirketler?sektor=` ile birebir
  aynı olurdu; ikinci bir adres aynı listeyi iki kez dizinletmekten başka
  bir şey eklemiyor.
- **Bilançolarda `Event` ve `FAQPage` yapısal verisi yok.** Google'ın
  etkinlik yönergesi katılım olmayan tarihleri dışlıyor, SSS zengin sonucu
  yalnızca devlet ve sağlık sitelerine gösteriliyor ve sayfada görünen bir
  soru-cevap bloğu da yok. Gerekçe `components/seo/JsonLd.tsx`te.
- **Mercek yazılarında kapak görseli alanı yok.** Şema bir kez `image_url`
  aldı ve hemen geri alındı; görsel dili metinden çizilen `:::` blokları.
- **Yönetim yetkisi ortam değişkeninde değil veritabanında**, ve yetkisiz
  istek 404 görüyor — "yetkiniz yok" demek panelin varlığını ele verirdi.
- **Panelden YENİ içerik üretilmiyor.** Yazılar ekranı (`/admin/yazilar`) var
  olan mercek yazısını ve bülteni düzeltiyor; yeni kayıt yazmak rutinlerin
  işi. İki giriş de aynı doğrulamadan ve aynı upsert'ten geçiyor
  (`lib/content-write.ts`) — ikinci bir yazma yolu açmak bir dönem bu işi
  tümüyle engelleyen gerekçenin kendisiydi.
- **Bilanço analizi panelden düzenlenmiyor.** Analiz serbest metin değil, on
  beş alanlı yapılandırılmış bir kayıt; bir metin kutusuna indirmek
  düzenlemek değil bozmak olurdu. Eksikleri İçerik ekranı listeliyor.
- **Masthead tek şerit: beş sekme ve "Daha Fazla".** Piyasalar, Teknik
  Analiz, Şirketler, Bilançolar ve Mercek şeritte (21 Eylül sadeleşmesi;
  önceki yedi sekmeli ölçüm `components/layout/nav-items.ts` içinde karar
  kaydı olarak duruyor). Makro, Takvim, Karşılaştır, Temalar, Rehber,
  Sözlük, Vergi Hesaplayıcı, Haberler ve Bülten Arşivi "Daha Fazla"da;
  Favoriler ve Portföy hesap panelinde. Büyütülmüş yazıda sekmeler öncelik
  sırasıyla o panele iniyor.

---

## Bakım ritmi

| Ne | Ne zaman | Nasıl |
|---|---|---|
| Tatil takvimi | yılda bir | `db/seed/holidays.ts` elle güncellenir, NYSE resmî takviminden |
| FOMC takvimi | yılda bir | `db/seed/economic-events.ts` — Fed toplantı tarihleri elle |
| Endeks bileşimi | çeyrekte bir | `scripts/sync-indices.ts` |
| Şirket profilleri | kendiliğinden | cron turu + sayfa isteği |
| Temalar ve karşılaştırma çiftleri | üyelik değişince | `content/themes.ts` ve `content/compare-pairs.ts` elle; endeks bileşiminden türemiyorlar |
| Vergi eşikleri | her yıl başında | `lib/tax.ts` → `TAX_YEARS`: gelir vergisi tarifesi ve temettü beyan sınırı (2026: 22.000 TL), yeni yılın satırı GİB rehberi ve tarife tebliğinden, kaynağıyla |
| Skor kartı metrikleri | kendiliğinden | cron koşum başına 15 sembol + sayfa isteği (`lib/symbol-metrics.ts`) |
| Hata kaydı | kendiliğinden | 30 günden eskisini günlük cron siler |
| İçerik rutinleri | değişince | `docs/claude-rutinler.md`, claude.ai arayüzünden |

---

## Belgeler

| Dosya | Ne için |
|---|---|
| `README.md` | Ürünün tamamı: rotalar, mimari, veri modeli, kurulum, sınırlar |
| `CLAUDE.md` | Kod üzerinde çalışırken bilinmesi gerekenler — kurallar ve tuzaklar |
| `docs/claude-rutinler.md` | İçerik rutinlerinin prompt'ları ve `:::` blok sözdizimi |
| `docs/claude-brief-agent.md` | Bülten ajanının ayrıntılı yönergesi |
| `docs/claude-mercek-ajani.md` | Mercek ajanının kısa yönergesi |
| `docs/design/` | Tasarım notları |
| bu dosya | Durum: canlıda ne var, ne bekliyor, ne bilinçli olarak yok |
